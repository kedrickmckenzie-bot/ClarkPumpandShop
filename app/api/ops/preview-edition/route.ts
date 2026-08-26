import { demoEditionAllowsPath, isDemoEdition } from "@/components/ops/demo-edition";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";
import {
  OPS_INTERNAL_URL_BASE,
  OPS_PREVIEW_EDITION_COOKIE,
} from "@/lib/server/runtime-identifiers";

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
  const requestedEdition = formData.get("edition");
  if (typeof requestedEdition !== "string" || !isDemoEdition(requestedEdition)) {
    return Response.json({ error: "Choose a supported demo package." }, { status: 422 });
  }

  const requestedReturn = safeReturnPath(formData.get("returnTo"));
  const returnTo = demoEditionAllowsPath(requestedEdition, requestedReturn)
    ? requestedReturn
    : "/app/overview";
  const response = relativeRedirect303(returnTo);
  const forwardedProtocol = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();
  response.cookies.set(OPS_PREVIEW_EDITION_COOKIE, requestedEdition, {
    httpOnly: true,
    sameSite: "lax",
    secure: forwardedProtocol ? forwardedProtocol === "https" : new URL(request.url).protocol === "https:",
    path: "/app",
    maxAge: 60 * 60 * 8,
  });
  return response;
}
