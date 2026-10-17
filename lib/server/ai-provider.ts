import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { AiUnavailableError, type AiClient } from "@/lib/ops/ai";

// Chosen with the tricky-case tests (tests/ai-eval.test.ts): the cheapest models that passed.
const DEFAULT_SMART_MODEL = "claude-sonnet-5-5";
const DEFAULT_FAST_MODEL = "claude-haiku-4-5";

/**
 * The AI connection is opt-in. OPS_AI_PROVIDER=anthropic with ANTHROPIC_API_KEY turns it on.
 * OPS_AI_MODEL sets the model for troubleshooting ("smart") and OPS_AI_FAST_MODEL the model for checkout chat and
 * notes ("fast"); see docs/RENDER_DEPLOYMENT.md for the tested defaults. Without these, AI stays hidden and forms work by hand.
 */
export function getAiClient(): AiClient | undefined {
  if (process.env.OPS_AI_PROVIDER !== "anthropic" || !process.env.ANTHROPIC_API_KEY?.trim()) return undefined;
  const model = process.env.OPS_AI_MODEL?.trim() || DEFAULT_SMART_MODEL;
  const fastModel = process.env.OPS_AI_FAST_MODEL?.trim() || DEFAULT_FAST_MODEL;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 60_000, maxRetries: 1 });
  return {
    provider: "anthropic",
    model,
    async json({ system, prompt, schema, effort = "low", maxTokens = 4000, tier = "smart", images = [] }) {
      const chosen = tier === "fast" ? fastModel : model;
      let response;
      try {
        response = await client.beta.messages.parse({
          model: chosen,
          max_tokens: maxTokens,
          system,
          messages: [{ role: "user", content: images.length ? [...images.map((image) => ({ type: "image" as const, source: { type: "base64" as const, media_type: image.mediaType, data: image.base64 } })), { type: "text" as const, text: prompt }] : prompt }],
          // Haiku models don't take an effort setting.
          output_config: { ...(chosen.startsWith("claude-haiku") ? {} : { effort }), format: betaZodOutputFormat(schema) },
          // If this model declines, Anthropic retries on a suitable model instead of failing the tech.
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
        });
      } catch (error) {
        if (error instanceof Anthropic.RateLimitError) throw new AiUnavailableError("The AI is busy right now. Try again in a minute, or fill the form in yourself.");
        if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) throw new AiUnavailableError("The AI connection isn't set up correctly. Fill the form in yourself and tell your manager.");
        if (error instanceof Anthropic.APIError) throw new AiUnavailableError("The AI couldn't answer just now. Fill the form in yourself, or try again.");
        throw error;
      }
      if (response.stop_reason === "refusal" || !response.parsed_output)
        throw new AiUnavailableError("The AI couldn't fill this in. Please fill the form in yourself.");
      return response.parsed_output;
    },
    // A manual lookup loop: the model asks for lookups, the server runs them, and the results go back until it answers.
    async toolChat({ system, messages, tools, runTool, maxRounds = 6 }) {
      const history: Anthropic.MessageParam[] = messages.map(message => ({ role: message.role, content: message.content }));
      try {
        for (let round = 0; round < maxRounds; round++) {
          const response = await client.messages.create({
            model, max_tokens: 4000, system, messages: history, tools: tools as Anthropic.Tool[],
            ...(model.startsWith("claude-haiku") ? {} : { thinking: { type: "adaptive" as const }, output_config: { effort: "low" as const } }),
          });
          if (response.stop_reason === "refusal") throw new AiUnavailableError("Ask couldn't answer that one.");
          history.push({ role: "assistant", content: response.content });
          const calls = response.content.filter((block): block is Anthropic.ToolUseBlock => block.type === "tool_use");
          if (response.stop_reason !== "tool_use" || !calls.length) {
            const text = response.content.flatMap(block => block.type === "text" ? [block.text] : []).join("").trim();
            if (!text) throw new AiUnavailableError("Ask didn't come back with an answer. Try asking another way.");
            return text;
          }
          const results: Anthropic.ToolResultBlockParam[] = [];
          for (const call of calls) {
            let content: string, isError = false;
            try { content = await runTool(call.name, (call.input ?? {}) as Record<string, unknown>); }
            catch (error) { content = error instanceof Error ? error.message : "That lookup failed."; isError = true; }
            results.push({ type: "tool_result", tool_use_id: call.id, content, ...(isError ? { is_error: true } : {}) });
          }
          history.push({ role: "user", content: results });
        }
      } catch (error) {
        if (error instanceof AiUnavailableError) throw error;
        if (error instanceof Anthropic.RateLimitError) throw new AiUnavailableError("Ask is busy right now. Try again in a minute.");
        if (error instanceof Anthropic.APIError) throw new AiUnavailableError("Ask couldn't answer just now. Try again.");
        throw error;
      }
      throw new AiUnavailableError("That question needed too many lookups. Try asking something more specific.");
    },
    // On unless OPS_AI_WEB_SEARCH=off. Searches are capped per question and the results are labeled as web sources.
    ...(process.env.OPS_AI_WEB_SEARCH === "off" ? {} : {
      async webSearch({ system, prompt, maxSearches }: { system: string; prompt: string; maxSearches: number }) {
        const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];
        let response: Anthropic.Message | undefined;
        try {
          for (let round = 0; round < 3; round++) {
            // Haiku models use the basic search tool and no effort setting.
            response = await client.messages.create(model.startsWith("claude-haiku")
              ? { model, max_tokens: 3000, system, messages, tools: [{ type: "web_search_20250305", name: "web_search", max_uses: maxSearches }] }
              : { model, max_tokens: 3000, system, messages, tools: [{ type: "web_search_20260209", name: "web_search", max_uses: maxSearches }], output_config: { effort: "low" } });
            // A long search can pause; send the turn back once or twice to let it finish.
            if (response.stop_reason !== "pause_turn") break;
            messages.push({ role: "assistant", content: response.content });
          }
        } catch (error) {
          if (error instanceof Anthropic.APIError) throw new AiUnavailableError("The web search didn't work just now.");
          throw error;
        }
        if (!response || response.stop_reason === "pause_turn" || response.stop_reason === "refusal") throw new AiUnavailableError("The web search didn't finish.");
        const text = response.content.flatMap(block => block.type === "text" ? [block.text] : []).join("").trim();
        const cited = response.content.flatMap(block => block.type === "text" ? (block.citations ?? []).flatMap(c => c.type === "web_search_result_location" ? [{ title: c.title ?? c.url, url: c.url }] : []) : []);
        const found = response.content.flatMap(block => block.type === "web_search_tool_result" && Array.isArray(block.content) ? block.content.map(r => ({ title: r.title, url: r.url })) : []);
        const sources = [...new Map((cited.length ? cited : found.slice(0, 3)).map(source => [source.url, source])).values()].slice(0, 5);
        return { text: text.slice(0, 4000), sources };
      },
    }),
  };
}
