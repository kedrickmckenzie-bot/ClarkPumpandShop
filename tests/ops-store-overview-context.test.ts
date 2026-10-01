import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { completionSummary, COMPLETION_FALLBACK } from "@/lib/ops/work-order-outcome";
import type { OpsFixture, SiteVisitWorkOrder } from "@/lib/ops/types";

vi.mock("server-only", () => ({}));
const NOW = "2026-10-01T12:00:00.000Z";
const context = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("@/lib/server/store-workspace-context", () => ({ storeWorkspaceContext: async () => context.value }));
vi.mock("@/lib/server/ops-repository-provider", () => ({ getServerOpsReportingAsOf: () => NOW }));

const STORE = "store-northline-104";
const html = async (fixture: OpsFixture) => {
  const repository = createOpsFixtureRepository(fixture);
  const store = (await repository.getStore(NORTHLINE_ORGANIZATION_ID, STORE))!;
  context.value = { session: { role: "facilities", organizationId: NORTHLINE_ORGANIZATION_ID, scopeLabel: "All" }, repository, store };
  const { StoreActiveWork } = await import("@/components/workspace/store-active-work");
  return renderToStaticMarkup(await StoreActiveWork({ id: STORE }));
};

/** A work order at Store 104 with an assignment, plus a confirmed appointment on it. */
function withAppointment(fixture: OpsFixture, id: string, startsAt: string, status: "confirmed" | "cancelled", workStatus: OpsFixture["workOrders"][number]["status"], dueAt: string) {
  const work = { ...fixture.workOrders.find((row) => row.storeId === STORE)!, id: `wo-${id}`, number: `CPS-TEST-${id}`, problem: `Problem ${id}`, status: workStatus, dueAt };
  fixture.workOrders.push(work);
  const assignment = { ...fixture.assignments.find((row) => row.vendorId)!, id: `assignment-${id}`, workOrderId: work.id };
  fixture.assignments.push(assignment);
  fixture.serviceAppointments = [...(fixture.serviceAppointments ?? []), { id: `appointment-${id}`, organizationId: NORTHLINE_ORGANIZATION_ID, workOrderId: work.id, assignmentId: assignment.id, status, proposedBy: "vendor", startsAt, createdAt: "2026-09-30T12:00:00.000Z" }];
  return work;
}

describe("store overview upcoming visits", () => {
  beforeEach(() => vi.resetModules());

  it("lists confirmed appointments by arrival time, not work-order deadlines or status", async () => {
    const fixture = buildNorthlinePresentationFixture();
    fixture.serviceAppointments = (fixture.serviceAppointments ?? []).filter((row) => fixture.workOrders.find((work) => work.id === row.workOrderId)?.storeId !== STORE);
    // In progress (not "scheduled"), with a deadline days before the appointment.
    withAppointment(fixture, "a", "2026-10-03T14:30:00.000Z", "confirmed", "in_progress", "2026-10-01T20:00:00.000Z");
    withAppointment(fixture, "b", "2026-10-02T13:00:00.000Z", "confirmed", "accepted", "2026-10-09T20:00:00.000Z");
    withAppointment(fixture, "cancelled", "2026-10-02T09:00:00.000Z", "cancelled", "scheduled", "2026-10-02T09:00:00.000Z");
    withAppointment(fixture, "past", "2026-09-30T09:00:00.000Z", "confirmed", "scheduled", "2026-09-30T09:00:00.000Z");
    // Scheduled status and a future deadline, but no appointment.
    fixture.workOrders.push({ ...fixture.workOrders.find((row) => row.storeId === STORE)!, id: "wo-deadline-only", number: "CPS-TEST-deadline", status: "scheduled", dueAt: "2026-10-02T08:00:00.000Z" });

    const markup = await html(fixture);
    const start = markup.indexOf('id="store-upcoming"'), section = markup.slice(start, markup.indexOf("</section>", start));
    expect(section.indexOf("CPS-TEST-b")).toBeGreaterThan(-1);
    expect(section.indexOf("CPS-TEST-b")).toBeLessThan(section.indexOf("CPS-TEST-a"));
    // Store-local (Eastern) appointment time, not the deadline.
    expect(section).toContain("Oct 3, 2026, 10:30 AM EDT");
    expect(section).not.toContain("Oct 1, 2026, 4:00 PM");
    for (const hidden of ["CPS-TEST-cancelled", "CPS-TEST-past", "CPS-TEST-deadline"]) expect(section).not.toContain(hidden);
    expect(section).toContain('href="/app/visits?status=upcoming&amp;store=store-northline-104"');
  });
});

describe("completion summary", () => {
  const record = (patch: Partial<SiteVisitWorkOrder>): SiteVisitWorkOrder => ({ id: "svw-1", organizationId: NORTHLINE_ORGANIZATION_ID, visitId: "visit-1", workOrderId: "wo-1", ordinal: 1, linkedByActorType: "technician", linkedByActorName: "Pat Tech", linkedAt: "2026-09-08T14:00:00.000Z", outcome: "completed", outcomeRecordedByActorType: "technician", outcomeRecordedByActorName: "Pat Tech", outcomeRecordedAt: "2026-09-08T15:32:00.000Z", ...patch });
  const time = (iso: string) => iso;

  it("names who recorded the result and when, from the outcome record", () => {
    expect(completionSummary([record({})], time)).toBe("Pat Tech recorded the work completed 2026-09-08T15:32:00.000Z.");
  });

  it("falls back when the author or time is missing", () => {
    expect(completionSummary([], time)).toBe(COMPLETION_FALLBACK);
    expect(completionSummary([record({ outcomeRecordedByActorName: undefined })], time)).toBe(COMPLETION_FALLBACK);
  });

  it("keeps the recorded time and author after later edits to the work order", async () => {
    vi.resetModules();
    const fixture = buildNorthlinePresentationFixture();
    const pending = fixture.workflowTasks.find((task) => task.taskType === "verify_repair" && ["open", "in_progress"].includes(task.status) && fixture.workOrders.find((work) => work.id === task.workOrderId)?.storeId === STORE);
    const work = pending ? fixture.workOrders.find((row) => row.id === pending.workOrderId)! : fixture.workOrders.find((row) => row.storeId === STORE)!;
    if (!pending) work.status = "completed_pending_review";
    fixture.siteVisitWorkOrders = fixture.siteVisitWorkOrders.filter((row) => row.workOrderId !== work.id);
    fixture.siteVisitWorkOrders.push(record({ id: "svw-test", workOrderId: work.id, outcomeRecordedAt: "2026-09-28T15:32:00.000Z", outcomeRecordedByActorName: "Pat Tech" }));
    // Later activity on the work order (a note and an equipment change) must not become the completion time.
    const template = fixture.auditEvents.find((event) => event.aggregateType === "work_order")!;
    for (const [index, eventType] of ["work_order.note_added", "work_order.classified"].entries()) fixture.auditEvents.push({ ...template, id: `audit-later-${index}`, aggregateId: work.id, eventType, actorName: "Jordan Lee", occurredAt: "2026-09-30T19:00:00.000Z", payloadJson: "{}" });
    const markup = await html(fixture);
    const section = markup.slice(markup.indexOf('id="store-attention"'), markup.indexOf('id="store-upcoming"'));
    expect(section).toContain("Pat Tech recorded the work completed Sep 28, 2026, 11:32 AM EDT.");
    expect(section).not.toContain("Sep 30, 2026");
    expect(section).toContain("Confirm result");
    expect(section).toContain(": confirm it&#x27;s working.");
  });
});
