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
    maxTokens?: number;
  }): Promise<z.infer<Schema>>;
}

/** Raised when the AI could not give a usable answer; callers show a plain message and let the person continue by hand. */
export class AiUnavailableError extends Error {}
