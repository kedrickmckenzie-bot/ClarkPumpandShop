export class OpsDomainError extends Error {
  constructor(
    public readonly code: "VALIDATION" | "NOT_FOUND" | "CONFLICT" | "FORBIDDEN",
    message: string,
  ) {
    super(message);
    this.name = "OpsDomainError";
  }
}
