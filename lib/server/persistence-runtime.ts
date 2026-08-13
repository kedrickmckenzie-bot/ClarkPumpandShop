type RuntimeEnvironment = Partial<Record<"RENDER" | "TRACEOPS_RUNTIME" | "NODE_ENV", string | undefined>>;

export function isRenderNodeRuntime(environment: RuntimeEnvironment = process.env) {
  return environment.RENDER === "true" || environment.TRACEOPS_RUNTIME === "render";
}

export function isLocalRenderDevelopment(environment: RuntimeEnvironment = process.env) {
  return isRenderNodeRuntime(environment)
    && environment.RENDER !== "true"
    && environment.NODE_ENV !== "production";
}
