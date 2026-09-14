import "server-only";
import { OpsDomainError } from "@/lib/ops/errors";
import { isRenderNodeRuntime } from "./persistence-runtime";

export const OPS_ORGANIZATION_COOKIE = "ops-organization";

/** Preview is an explicit deployment choice, never an identity fallback. */
export function isFictionalPreview(environment: Record<string, string | undefined> = process.env): boolean {
  if (environment.OPS_ACCESS_MODE) return environment.OPS_ACCESS_MODE === "preview";
  return environment.NODE_ENV !== "production" && !environment.DATABASE_URL?.trim() && environment.RENDER !== "true";
}

export function trustsSitesIdentity(environment: Record<string, string | undefined> = process.env): boolean {
  return environment.OPS_IDENTITY_PROVIDER === "sites" && !isRenderNodeRuntime(environment);
}

export class OperatorAccessError extends OpsDomainError {
  constructor(public readonly reason: "sign_in" | "company" | "membership" | "configuration", message: string) {
    super("FORBIDDEN", message);
    this.name = "OperatorAccessError";
  }
}

export function requirePreviewMode() {
  if (!isFictionalPreview()) throw new OperatorAccessError("membership", "Preview controls are unavailable in this workspace.");
}
