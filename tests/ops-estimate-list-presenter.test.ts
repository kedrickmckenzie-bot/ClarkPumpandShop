import { beforeAll, describe, expect, it, vi } from "vitest";
import type { OperatorSession } from "@/components/ops/data-contract";
import {
  NORTHLINE_ORGANIZATION_ID,
  buildNorthlinePresentationFixture,
} from "@/lib/ops/fixtures";

vi.mock("server-only", () => ({}));

let buildListModel: typeof import("@/app/app/_data/operator-presenter").buildListModel;

beforeAll(async () => {
  ({ buildListModel } = await import("@/app/app/_data/operator-presenter"));
});

const session: OperatorSession = {
  userId: "user-estimate-list",
  membershipId: "membership-northline-facilities",
  displayName: "Facilities preview",
  email: "facilities@clark-demo.example",
  role: "facilities",
  organizationId: NORTHLINE_ORGANIZATION_ID,
  organizationName: "Clark Pump and Shop",
  scopeLabel: "Clark Pump and Shop companywide - 15 stores",
};

describe("bid-request portfolio presenter", () => {
  it("keeps vendor bids on their canonical work-order drill-down", () => {
    const fixture = buildNorthlinePresentationFixture();
    const model = buildListModel(fixture, session, "estimates");

    expect(model.page.title).toBe("Bid requests");
    expect(model.table.rows).toHaveLength(fixture.estimateRequests.length);
    expect(model.table.rows.every((row) => /^\/app\/work-orders\/[^?]+\?view=service#bid-requests$/.test(row.href))).toBe(true);
    expect(new Set(model.table.rows.map((row) => row.href.split("#")[0])).size).toBeLessThan(model.table.rows.length);
  });

  it("filters pricing requests by decision purpose, status, and vendor search", () => {
    const fixture = buildNorthlinePresentationFixture();
    const replacement = buildListModel(fixture, session, "estimates", { decision: "replacement_quote" });
    const submitted = buildListModel(fixture, session, "estimates", { status: "submitted" });
    const summit = buildListModel(fixture, session, "estimates", { q: "ColdLine Refrigeration & HVAC" });

    expect(replacement.table.rows).not.toHaveLength(0);
    expect(replacement.table.rows.every((row) => row.cells.find((cell) => cell.key === "request")?.value === "Replacement quote")).toBe(true);
    expect(submitted.table.rows.every((row) => row.cells.find((cell) => cell.key === "status")?.value === "Submitted")).toBe(true);
    expect(summit.table.rows).not.toHaveLength(0);
    expect(summit.table.rows.every((row) => row.cells.find((cell) => cell.key === "vendor")?.value === "ColdLine Refrigeration & HVAC")).toBe(true);
  });
});
