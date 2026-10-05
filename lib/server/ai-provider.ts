import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { AiUnavailableError, type AiClient } from "@/lib/ops/ai";

/**
 * The AI connection is opt-in. OPS_AI_PROVIDER=anthropic with ANTHROPIC_API_KEY turns it on;
 * OPS_AI_MODEL overrides the model. Without these, AI buttons stay hidden and forms work by hand.
 */
export function getAiClient(): AiClient | undefined {
  if (process.env.OPS_AI_PROVIDER !== "anthropic" || !process.env.ANTHROPIC_API_KEY?.trim()) return undefined;
  const model = process.env.OPS_AI_MODEL?.trim() || "claude-opus-5-5";
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 60_000, maxRetries: 1 });
  return {
    provider: "anthropic",
    model,
    async json({ system, prompt, schema, effort = "low", maxTokens = 4000 }) {
      let response;
      try {
        response = await client.beta.messages.parse({
          model,
          max_tokens: maxTokens,
          system,
          messages: [{ role: "user", content: prompt }],
          output_config: { effort, format: betaZodOutputFormat(schema) },
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
  };
}
