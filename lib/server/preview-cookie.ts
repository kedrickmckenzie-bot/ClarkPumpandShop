import type { NextResponse } from "next/server";

/** Preview preferences must accompany both /app pages and /api commands. */
export function setPreviewCookie(response: NextResponse, request: Request, name: string, value: string) {
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  const secure = forwardedProtocol ? forwardedProtocol === "https" : new URL(request.url).protocol === "https:";
  response.cookies.set(name, value, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  // Older previews used /app. Expire that separate cookie so it cannot shadow
  // the root preference on pages while APIs see the new value. Append directly:
  // ResponseCookies indexes by name and cannot retain both paths for one name.
  response.headers.append("Set-Cookie", `${name}=; Path=/app; Max-Age=0; HttpOnly; SameSite=lax${secure ? "; Secure" : ""}`);
}
