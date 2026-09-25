/** Browser-owned Fetch Metadata survives reverse proxies that rewrite request.url.
 * Scripts cannot forge Sec-* headers. It is CSRF evidence, never authentication.
 * Without it, retain the exact Origin comparison; never trust forwarded hosts.
 */
export function isWorkspaceOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  const origin = request.headers.get("origin");
  if (site === "cross-site" || origin === "null") return false;
  if (origin) {
    try {
      const parsed = new URL(origin);
      if (!["https:", "http:"].includes(parsed.protocol) || parsed.origin !== origin) return false;
    } catch { return false; }
  }
  if (site === "same-origin") return true;
  return !origin || origin === new URL(request.url).origin;
}
