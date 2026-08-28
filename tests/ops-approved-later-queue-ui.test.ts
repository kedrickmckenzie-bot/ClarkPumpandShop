import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ListSurface } from "@/components/ops/views";
import type { OperatorSession } from "@/components/ops/data-contract";
import { NORTHLINE_ORGANIZATION_ID, buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";

vi.mock("server-only", () => ({}));

let buildListModel: typeof import("@/app/app/_data/operator-presenter").buildListModel;

beforeAll(async () => {
  ({ buildListModel } = await import("@/app/app/_data/operator-presenter"));
});

function facilitiesSession(): OperatorSession {
  return {
    userId: "user-northline-facilities",
    membershipId: "membership-northline-facilities",
    displayName: "Morgan Lee",
    email: "morgan.lee@clark-demo.example",
    role: "facilities",
    organizationId: NORTHLINE_ORGANIZATION_ID,
    organizationName: "Clark Pump and Shop",
    scopeLabel: "Clark Pump and Shop companywide · 15 stores",
  };
}

describe("approved-for-later queue management", () => {
  it("renders usable edit, assignment, grouping, removal, and cancellation controls in the selected-record panel", () => {
    const fixture = buildNorthlinePresentationFixture();
    const model = buildListModel(fixture, facilitiesSession(), "work-orders", { visitPlan: "ready" });
    const selected = model.table.rows.find((row) => row.management?.kind === "approved_later")!;
    const storeId = selected.management!.storeId;
    const markup = renderToStaticMarkup(createElement(ListSurface, {
      model,
      surface: "work-orders",
      searchParams: { visitPlan: "ready", store: storeId, selected: selected.id },
    }));

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain("Manage this approved job");
    expect(markup).toContain("Assign or send now");
    expect(markup).toContain(`store=${storeId}&amp;workOrder=${selected.id}`);
    expect(markup).toContain("Edit what was approved for later");
    expect(markup).toContain('name="deadlineAt"');
    expect(markup).toContain("Remove from approved for later");
    expect(markup).toContain("Cancel work order");
    expect(markup).toContain("never silently deleted");
  });
});
