import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/ops/preview-role/route";

function previewRoleRequest({
  role = "executive",
  returnTo = "/app/overview",
  url = "http://127.0.0.1:8788/api/ops/preview-role",
  forwardedProtocol,
}: {
  role?: string;
  returnTo?: string;
  url?: string;
  forwardedProtocol?: string;
} = {}) {
  const body = new FormData();
  body.set("role", role);
  body.set("returnTo", returnTo);
  const headers = new Headers();
  if (forwardedProtocol) headers.set("x-forwarded-proto", forwardedProtocol);
  return new Request(url, { method: "POST", headers, body });
}

describe("preview role switch", () => {
  it("returns a relative redirect when the hosted request exposes an internal origin", async () => {
    const response = await POST(previewRoleRequest({
      returnTo: "/app/lifecycle?asset=asset-115-beer-cave#comparison",
      forwardedProtocol: "https",
    }));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "/app/lifecycle?asset=asset-115-beer-cave#comparison",
    );
    expect(response.headers.get("location")).not.toContain("127.0.0.1");
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("ops-preview-role=executive");
    expect(cookie).toContain("Path=/app");
    expect(cookie).toMatch(/;\s*HttpOnly/i);
    expect(cookie).toMatch(/;\s*SameSite=lax/i);
    expect(cookie).toMatch(/;\s*Secure/i);
  });

  it("keeps a local HTTP preview cookie usable without Secure", async () => {
    const response = await POST(previewRoleRequest({ role: "regional" }));
    const cookie = response.headers.get("set-cookie") ?? "";

    expect(response.headers.get("location")).toBe("/app/overview");
    expect(cookie).toContain("ops-preview-role=regional");
    expect(cookie).not.toMatch(/;\s*Secure/i);
  });

  it.each([
    "//evil.example/app",
    "https://evil.example/app",
    "/api/ops/preview-role",
    "not-a-path",
  ])("falls back to the overview for an unsafe return path: %s", async (returnTo) => {
    const response = await POST(previewRoleRequest({ returnTo }));
    expect(response.headers.get("location")).toBe("/app/overview");
  });

  it("rejects an unsupported role without setting redirect or cookie headers", async () => {
    const response = await POST(previewRoleRequest({ role: "administrator" }));

    expect(response.status).toBe(422);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
