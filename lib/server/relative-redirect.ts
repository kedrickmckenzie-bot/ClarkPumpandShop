import { NextResponse } from "next/server";

const RELATIVE_REDIRECT_BASE = "https://traceops-relative.invalid";

/**
 * Creates a same-origin form redirect without trusting the server-facing
 * request URL. Reverse proxies may expose an internal host such as 0.0.0.0;
 * a relative Location lets the browser retain the public origin it used.
 */
export function relativeRedirect303(destination: string): NextResponse {
  if (!destination.startsWith("/") || destination.startsWith("//")) {
    throw new TypeError("Redirect destination must be a same-origin relative path");
  }

  const parsed = new URL(destination, RELATIVE_REDIRECT_BASE);
  if (parsed.origin !== RELATIVE_REDIRECT_BASE) {
    throw new TypeError("Redirect destination must remain on the current origin");
  }

  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: `${parsed.pathname}${parsed.search}${parsed.hash}`,
    },
  });
}
