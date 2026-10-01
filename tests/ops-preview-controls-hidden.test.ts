import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { OperatorSession } from "@/components/ops/data-contract";
import { PlatformShell } from "@/components/ops/platform-shell";

vi.mock("next/navigation", () => ({ usePathname: () => "/app/overview", useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const base: OperatorSession = { organizationId: "org-1", userId: "user-1", displayName: "Jordan Lee", email: "jordan@example.test", organizationName: "Example", scopeLabel: "Companywide", role: "facilities", permissions: ["ops:*"], demoEdition: "complete" };
const render = (session: OperatorSession) => renderToStaticMarkup(createElement(PlatformShell, { session }, createElement("p", null, "Body")));

describe("preview controls", () => {
  it("shows the role picker and demo package only in preview", () => {
    const preview = render({ ...base, accessMode: "preview" });
    expect(preview).toMatch(/Preview role/i);
    expect(preview).toMatch(/Demo package/i);
  });

  it("hides them for signed-in workspaces", () => {
    const signedIn = render({ ...base, accessMode: "authenticated" });
    expect(signedIn).not.toMatch(/Preview role/i);
    expect(signedIn).not.toMatch(/Demo package/i);
    expect(signedIn).toContain("Switch company");
  });
});
