import { beforeAll, describe, expect, it, vi } from "vitest";
import type { OperatorSession } from "@/components/ops/data-contract";
import {
  NORTHLINE_ORGANIZATION_ID,
  buildNorthlinePresentationFixture,
} from "@/lib/ops/fixtures";
import {
  formatOperationsDate,
  formatOperationsDateTime,
} from "@/lib/ops/local-time";

vi.mock("server-only", () => ({}));

let buildDetailModel: typeof import("@/app/app/_data/operator-presenter").buildDetailModel;

beforeAll(async () => {
  ({ buildDetailModel } = await import("@/app/app/_data/operator-presenter"));
});

function executiveSession(): OperatorSession {
  return {
    userId: "user-northline-executive",
    membershipId: "membership-northline-executive",
    displayName: "Alex Morgan",
    email: "alex.morgan@clark-demo.example",
    role: "executive",
    organizationId: NORTHLINE_ORGANIZATION_ID,
    organizationName: "Clark Pump and Shop",
    scopeLabel: "Clark Pump and Shop companywide · 15 stores",
    permissions: ["ops:*"],
  };
}

describe("store-local time display", () => {
  it("formats the same instant from the store timezone rather than the machine timezone", () => {
    const instant = "2026-08-27T18:32:10.000Z";
    expect(formatOperationsDateTime(instant, "America/New_York", { seconds: true })).toBe("Aug 27, 2026, 2:32:10 PM EDT");
    expect(formatOperationsDateTime(instant, "America/Chicago", { seconds: true })).toBe("Aug 27, 2026, 1:32:10 PM CDT");
  });

  it("keeps calendar-only dates on their recorded day", () => {
    expect(formatOperationsDate("2026-08-27", "America/New_York")).toBe("Aug 27, 2026");
  });

  it("surfaces exact store-local visit evidence for camera review", () => {
    const fixture = buildNorthlinePresentationFixture();
    const visit = fixture.visits.find((candidate) => Boolean(candidate.checkedOutAt))!;
    const store = fixture.stores.find((candidate) => candidate.id === visit.storeId)!;
    const detail = buildDetailModel(fixture, executiveSession(), "visit", visit.id);
    const arrivalFact = detail.facts.find((fact) => fact.label === "Observed arrival");
    const evidence = detail.sections.find((section) => section.id === "evidence")?.table;

    expect(arrivalFact?.value).toBe(formatOperationsDateTime(visit.checkedInAt, store.timeZone, { seconds: true }));
    expect(arrivalFact?.helperText).toContain("Store-local time");
    expect(evidence?.columns.find((column) => column.key === "time")?.label).toBe("Store-local time");
    expect(evidence?.rows[0]?.cells.find((cell) => cell.key === "time")?.value).toMatch(/\d{1,2}:\d{2}:\d{2} [AP]M E(?:D|S)T/u);
  });
});
