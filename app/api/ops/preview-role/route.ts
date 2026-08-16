import { relativeRedirect303 } from "@/lib/server/relative-redirect";
import {
  OPS_INTERNAL_URL_BASE,
  OPS_PREVIEW_ROLE_COOKIE,
} from "@/lib/server/runtime-identifiers";

const ALLOWED_ROLES = new Set([
  "executive",
  "facilities",
  "regional",
  "store_manager",
  "finance",
]);

function safeReturnPath(value: FormDataEntryValue | null): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/app/overview";
  }

  try {
    const url = new URL(value, OPS_INTERNAL_URL_BASE);
    if (url.origin !== OPS_INTERNAL_URL_BASE || !url.pathname.startsWith("/app")) {
      return "/app/overview";
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/app/overview";
  }
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const requestedRole = formData.get("role");
  const returnTo = safeReturnPath(formData.get("returnTo"));

  if (typeof requestedRole !== "string" || !ALLOWED_ROLES.has(requestedRole)) {
    return Response.json({ error: "Choose a supported preview role." }, { status: 422 });
  }

  const response = relativeRedirect303(returnTo);
  const forwardedProtocol = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();
  response.cookies.set(OPS_PREVIEW_ROLE_COOKIE, requestedRole, {
    httpOnly: true,
    sameSite: "lax",
    secure: forwardedProtocol ? forwardedProtocol === "https" : new URL(request.url).protocol === "https:",
    path: "/app",
    maxAge: 60 * 60 * 8,
  });
  return response;
}
