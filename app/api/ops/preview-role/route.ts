import { relativeRedirect303 } from "@/lib/server/relative-redirect";
import { setPreviewCookie } from "@/lib/server/preview-cookie";
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
  setPreviewCookie(response, request, OPS_PREVIEW_ROLE_COOKIE, requestedRole);
  return response;
}
