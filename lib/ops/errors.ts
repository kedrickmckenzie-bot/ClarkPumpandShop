export class OpsDomainError extends Error {
  constructor(
    public readonly code: "VALIDATION" | "NOT_FOUND" | "CONFLICT" | "FORBIDDEN",
    message: string,
    public readonly details?: { kind: "schedule_warning"; warnings: string[] },
  ) {
    super(message);
    this.name = "OpsDomainError";
  }
}
