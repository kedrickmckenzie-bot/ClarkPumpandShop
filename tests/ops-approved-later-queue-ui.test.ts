import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
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
  it("shows the bulk follow-up control only when the viewer can manage workflow tasks", () => {
    const fixture = buildNorthlinePresentationFixture();
    const model = buildListModel(fixture, facilitiesSession(), "work-orders", { status: "open" });
    const hidden = renderToStaticMarkup(createElement(ListSurface, {
      model,
      surface: "work-orders",
      searchParams: { status: "open" },
      canManageWorkflowTasks: false,
    }));
    const visible = renderToStaticMarkup(createElement(ListSurface, {
      model,
      surface: "work-orders",
      searchParams: { status: "open" },
      canManageWorkflowTasks: true,
    }));

    expect(hidden).not.toContain("Add the same follow-up to selected work");
    expect(hidden).not.toContain("/api/ops/work-orders/bulk-follow-up");
    expect(visible).toContain("Add the same follow-up to selected work");
    expect(visible).toContain("/api/ops/work-orders/bulk-follow-up");
  });

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
    expect(markup).toContain("Choose the vendor, review what they will receive, then send");
    expect(markup).toContain("Assign and send");
    expect(markup).toContain("Review exactly what will be sent");
    expect(markup).toContain("Work Order / Service Authorization");
    expect(markup).toContain("Internal controls stay internal");
    expect(markup).toContain("Review before sending");
    expect(markup).not.toContain(`/api/ops/work-orders/${selected.id}/issue`);
    expect(markup).not.toContain('name="operation" value="release"/><input type="hidden" name="returnTo" value="/app/work-orders/');
    expect(markup).toContain(`store=${storeId}&amp;workOrder=${selected.id}`);
    expect(markup).toContain("Edit the next-suitable-visit instructions");
    expect(markup).toContain('name="deadlineAt"');
    expect(markup).toContain("Remove from next-visit list");
    expect(markup).toContain("Cancel work order");
    expect(markup).toContain("never silently deleted");
  });

  it("posts only the final reviewed confirmation to the canonical issuance route", () => {
    const source = readFileSync("components/ops/approved-later-issuance-dialog.tsx", "utf8");
    expect(source).toContain("Review before sending");
    expect(source).toContain("Review exactly what will be sent");
    expect(source).toContain("name=\"vendorId\"");
    expect(source).toContain("name=\"expectedRevision\"");
    expect(source).toContain("/api/ops/work-orders/${encodeURIComponent(model.workOrderId)}/issue");
    expect(source).toContain("Send work order to {selectedVendor?.label");
  });
});
