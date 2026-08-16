type RuntimeEnvironment = Partial<Record<"RENDER" | "OPS_RUNTIME" | "TRACEOPS_RUNTIME" | "NODE_ENV", string | undefined>>;

export function isRenderNodeRuntime(environment: RuntimeEnvironment = process.env) {
  const configuredRuntime = environment.OPS_RUNTIME?.trim()
    || environment.TRACEOPS_RUNTIME?.trim();
  return environment.RENDER === "true" || configuredRuntime === "render";
}

export function isLocalRenderDevelopment(environment: RuntimeEnvironment = process.env) {
  return isRenderNodeRuntime(environment)
    && environment.RENDER !== "true"
    && environment.NODE_ENV !== "production";
}
