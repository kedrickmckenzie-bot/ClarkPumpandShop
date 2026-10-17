import type { z } from "zod/v4";

/**
 * Provider-neutral AI connection. Features ask for a JSON answer that matches a schema;
 * the server picks the provider (Anthropic today, a self-hosted model later) from settings.
 */
export interface AiClient {
  provider: string;
  model: string;
  json<Schema extends z.ZodType>(request: {
    system: string;
    prompt: string;
    schema: Schema;
    /** How hard the model should think; small extraction jobs use "low". */
    effort?: "low" | "medium" | "high";
    /** "fast" for simple form-filling and note-writing, "smart" for troubleshooting judgment. Each can use a different (cheaper) model. */
    tier?: "fast" | "smart";
    maxTokens?: number;
    /** Photos to read with the prompt, such as an equipment tag. */
    images?: { mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; base64: string }[];
  }): Promise<z.infer<Schema>>;
  /**
   * Optional internet look-up. Returns a short plain summary and the pages it came from.
   * Providers without web access leave it out, and features work without it.
   */
  webSearch?(request: { system: string; prompt: string; maxSearches: number }): Promise<{ text: string; sources: { title: string; url: string }[] }>;
  /**
   * Optional: answer a conversation using only the given lookups. The model chooses lookups and their inputs;
   * runTool executes them on the server and returns JSON text. Returns the final answer text.
   */
  toolChat?(request: {
    system: string;
    messages: { role: "user" | "assistant"; content: string }[];
    tools: { name: string; description: string; input_schema: Record<string, unknown> }[];
    runTool(name: string, input: Record<string, unknown>): Promise<string>;
    maxRounds?: number;
  }): Promise<string>;
}

/** Raised when the AI could not give a usable answer; callers show a plain message and let the person continue by hand. */
export class AiUnavailableError extends Error {}
