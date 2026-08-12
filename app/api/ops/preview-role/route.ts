import { NextResponse } from "next/server";

const PREVIEW_ROLE_COOKIE = "traceops-preview-role";
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
    const url = new URL(value, "https://traceops.local");
    if (url.origin !== "https://traceops.local" || !url.pathname.startsWith("/app")) {
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

  const response = NextResponse.redirect(new URL(returnTo, request.url), 303);
  response.cookies.set(PREVIEW_ROLE_COOKIE, requestedRole, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
    path: "/app",
    maxAge: 60 * 60 * 8,
  });
  return response;
}
