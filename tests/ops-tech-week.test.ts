import { describe, expect, it } from "vitest";
import { groupStuck, stuckFor, stuckReason, stuckSince, type StuckJob } from "@/lib/ops/tech-week";
import type { WorkOrderListRow } from "@/lib/ops/view-models";
import type { WorkResult } from "@/lib/ops/types";

const row = (over: Partial<WorkOrderListRow>): WorkOrderListRow => ({ id: "wo-1", number: "1", storeId: "s", storeNumber: "101", storeName: "S", problem: "P", priority: "routine", status: "in_progress", assignmentKind: "internal", internalAccountableParty: "x", accountableParty: "x", nextAction: "x", createdAt: "2026-10-01T12:00:00.000Z", updatedAt: "2026-10-05T12:00:00.000Z", visitCount: 0, recordedCostMinor: 0, currency: "USD", ...over });
const result = (over: Partial<WorkResult>) => ({ outcome: "diagnosis_only", outcomeRecordedAt: "2026-10-10T12:00:00.000Z", ...over }) as WorkResult;

describe("a technician's stuck jobs", () => {
  it("names why each job is held up", () => {
    expect(stuckReason(row({ status: "waiting_on_parts" }))).toBe("parts");
    expect(stuckReason(row({ status: "waiting_on_vendor" }))).toBe("vendor");
    expect(stuckReason(row({ status: "awaiting_approval" }))).toBe("approval");
    expect(stuckReason(row({ hasOpenFollowUp: true }), result({ blocker: "vendor", outcome: "quote_required" }))).toBe("vendor");
    expect(stuckReason(row({ hasOpenFollowUp: true }), result({ blocker: "help" }))).toBe("help");
    expect(stuckReason(row({ hasOpenFollowUp: true }), result({ blocker: "cannot_today", outcome: "not_addressed" }))).toBe("help");
    expect(stuckReason(row({ status: "scheduled" }))).toBeUndefined();
  });

  it("counts from the result that stopped the job, else the last change", () => {
    expect(stuckSince(row({}), result({}))).toBe("2026-10-10T12:00:00.000Z");
    expect(stuckSince(row({ status: "waiting_on_vendor" }))).toBe("2026-10-05T12:00:00.000Z");
    expect(stuckFor("2026-10-10T12:00:00.000Z", "2026-10-10T20:00:00.000Z")).toBe("since today");
    expect(stuckFor("2026-10-10T12:00:00.000Z", "2026-10-13T13:00:00.000Z")).toBe("3 days");
  });

  it("groups by reason in a fixed order, longest-stuck first", () => {
    const jobs: StuckJob[] = [
      { job: row({ id: "a" }), reason: "manager", since: "2026-10-09T00:00:00.000Z" },
      { job: row({ id: "b" }), reason: "parts", since: "2026-10-08T00:00:00.000Z" },
      { job: row({ id: "c" }), reason: "parts", since: "2026-10-01T00:00:00.000Z" },
    ];
    expect(groupStuck(jobs).map(g => [g.label, g.jobs.map(j => j.job.id)])).toEqual([["Parts", ["c", "b"]], ["Sent to manager", ["a"]]]);
  });
});
