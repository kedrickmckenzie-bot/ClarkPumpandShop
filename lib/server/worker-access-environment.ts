/** Bridge explicit Worker bindings to the shared Node/Worker access policy. */
export function applyWorkerAccessEnvironment(
  bindings: { OPS_ACCESS_MODE?: string; OPS_IDENTITY_PROVIDER?: string },
  target: Record<string, string | undefined> = process.env,
) {
  for (const key of ["OPS_ACCESS_MODE", "OPS_IDENTITY_PROVIDER"] as const) {
    if (typeof bindings[key] === "string") target[key] = bindings[key];
    else delete target[key];
  }
}
