import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PlanningWorkspace } from "@/components/workspace/planning-workspace";
import { buildProgramModel } from "@/app/app/_data/operator-presenter";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import type { OperatorSession } from "@/components/ops/data-contract";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ usePathname: () => "/app/spend", useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: vi.fn() }) }));
// Client components may be rendered by a server table; invoking a function from
// their module is forbidden by RSC. Model that boundary explicitly in this regression.
vi.mock("@/components/workspace/work-review", () => ({ WorkReviewButton: () => null, workReviewTarget: () => { throw new Error("Client export invoked on the server"); } }));

describe("server-rendered analytical source tables", () => {
  const session: OperatorSession = { organizationId: NORTHLINE_ORGANIZATION_ID, userId: "demo", displayName: "Manager", email: "demo@example.test", organizationName: "Demo", scopeLabel: "All", role: "facilities" };
  it.each(["spend", "pm", "lifecycle"] as const)("renders %s with linked source records without calling client-only helpers", (kind) => {
    const model = buildProgramModel(buildNorthlinePresentationFixture(), session, kind, { store: "store-northline-104", view: "all" });
    expect(model.table?.rows.length).toBeGreaterThan(0);
    const html = renderToStaticMarkup(createElement(PlanningWorkspace, { model, kind }));
    expect(html).toContain("Supporting records");
    expect(html).toContain(model.table!.rows[0].href.replaceAll("&", "&amp;"));
  });
});
