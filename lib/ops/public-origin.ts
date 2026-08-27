export function normalizeHttpOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

export function isLocalHttpOrigin(origin: string | null): boolean {
  if (!origin) return false;
  const hostname = new URL(origin).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1";
}

/**
 * A public configured origin remains authoritative during local development,
 * while a real deployed browser origin replaces a missing or stale localhost
 * value. This keeps printed/demo QR codes usable even when a hosting service
 * was deployed before NEXT_PUBLIC_SITE_URL was corrected.
 */
export function selectPublicQrOrigin(
  configuredOrigin: string | undefined,
  runtimeOrigin: string | undefined,
): string | null {
  const configured = normalizeHttpOrigin(configuredOrigin);
  const runtime = normalizeHttpOrigin(runtimeOrigin);

  if (runtime && !isLocalHttpOrigin(runtime)) return runtime;
  if (configured && !isLocalHttpOrigin(configured)) return configured;
  return runtime ?? configured;
}
