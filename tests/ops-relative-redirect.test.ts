import { describe, expect, it } from "vitest";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

describe("same-origin operator form redirects", () => {
  it("returns a relative 303 Location so a reverse proxy's internal origin cannot leak", () => {
    const response = relativeRedirect303("/app/work-orders/wo-123?updated=true#work-control");

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "/app/work-orders/wo-123?updated=true#work-control",
    );
    expect(response.headers.get("location")).not.toContain("0.0.0.0");
  });

  it.each([
    "https://evil.example/app",
    "//evil.example/app",
    "/\\evil.example/app",
    "app/overview",
  ])("rejects a redirect destination that can leave the current origin: %s", (destination) => {
    expect(() => relativeRedirect303(destination)).toThrow(/same-origin|current origin/i);
  });
});
