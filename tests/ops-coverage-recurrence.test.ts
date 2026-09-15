import { describe, expect, it } from "vitest";
import { integrityFromFixture } from "@/lib/ops/record-integrity-query";
import { runPmRecurrenceCycle } from "@/lib/ops/job-workers";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";

const ORG = NORTHLINE_ORGANIZATION_ID;
const NOW = "2026-09-01T12:00:00.000Z";

describe("closed-work evidence coverage", () => {
  const fixture = buildNorthlinePresentationFixture();

  it("reconciles each evidence count against its own eligible population", () => {
    const { counts } = integrityFromFixture(fixture, { organizationId: ORG }, NOW, { kind: "closed_work" });
    expect(counts.closed_work).toBeGreaterThan(0);
    expect(counts.with_outcome + counts.without_outcome).toBe(counts.closed_work);
    expect(counts.with_cost + counts.without_cost).toBe(counts.closed_work);
    expect(counts.verified + counts.unverified).toBe(counts.vendor_closed);
  });

  it("never leaks another tenant's work orders into coverage", () => {
    const coverage = integrityFromFixture(fixture, { organizationId: "org-other" }, NOW, { kind: "closed_work" });
    expect(coverage.totalCount).toBe(0);
    expect(Object.values(coverage.counts).every(count => count === 0)).toBe(true);
  });
});

describe("operational record checks", () => {
  it("finds an active work order holding no open workflow task", () => {
    const fixture = buildNorthlinePresentationFixture();
    const orphan = fixture.workOrders.find((row) => row.organizationId === ORG && !["resolved", "closed", "cancelled"].includes(row.status))!;
    fixture.workflowTasks = fixture.workflowTasks.filter((row) => row.workOrderId !== orphan.id);
    const report = integrityFromFixture(fixture, { organizationId: ORG }, NOW, { kind: "missing_action" });
    expect(report.items.some(row => row.entityId === orphan.id)).toBe(true);
    expect(report.totalCount).toBeGreaterThanOrEqual(1);
  });

  it("flags invoice reviews that age past 30 days without a decision", () => {
    const fixture = buildNorthlinePresentationFixture();
    const exception = fixture.invoiceExceptions.find((row) => row.organizationId === ORG)!;
    exception.status = "open";
    exception.detectedAt = "2026-01-01T00:00:00.000Z";
    const report = integrityFromFixture(fixture, { organizationId: ORG }, NOW, { kind: "aged_invoice" });
    expect(report.items.some(row => row.entityType === "invoice")).toBe(true);
  });

  it("keeps missing life details optional without creating an operational follow-up", () => {
    const fixture = buildNorthlinePresentationFixture();
    const assetWithoutLife = fixture.assets.find((row) => row.organizationId === ORG && row.status !== "retired")!;
    delete (assetWithoutLife as { expectedLifeYears?: number }).expectedLifeYears;
    const report = integrityFromFixture(fixture, { organizationId: ORG }, NOW, { kind: "missing_life" });
    expect(report.items.some(row => row.entityId === assetWithoutLife.id)).toBe(true);
    expect(report.counts.missing_action).toBe(0);
  });

  it("stays empty for a foreign tenant", () => {
    const report = integrityFromFixture(buildNorthlinePresentationFixture(), { organizationId: "org-other" }, NOW, { kind: "missing_action" });
    expect(report.items).toHaveLength(0);
  });
});


describe("PM recurrence worker", () => {
  function pmHarness() {
    const fixture = buildNorthlinePresentationFixture();
    const repository = createOpsFixtureRepository(fixture);
    let current = NOW;
    return {
      fixture,
      repository,
      services: { repository, clock: { now: () => current }, ids: { next: (prefix: string) => `${prefix}-pm-${Math.random().toString(36).slice(2, 9)}` } },
      setNow(value: string) {
        current = value;
      },
    };
  }

  it("creates the next occurrence from a completed one using the plan cadence", async () => {
    const fixture = buildNorthlinePresentationFixture();
    const candidatePlan = fixture.pmPlans.find((plan) => fixture.pmOccurrences.some((row) => row.organizationId === plan.organizationId && row.planId === plan.id && row.status.startsWith("completed")))!;
    expect(candidatePlan).toBeTruthy();
    const completions = fixture.pmOccurrences.filter((row) => row.planId === candidatePlan.id && row.status.startsWith("completed"));
    const rest = fixture.pmOccurrences.filter((row) => row.planId !== candidatePlan.id);
    // Only completed history remains for this plan, so its latest occurrence is due for recurrence.
    fixture.pmOccurrences = [...completions, ...rest];
    const repository = createOpsFixtureRepository(fixture);
    const before = repository.snapshot().pmOccurrences.filter((row) => row.planId === candidatePlan.id);

    const summary = await runPmRecurrenceCycle({ repository, clock: { now: () => NOW }, ids: { next: (prefix: string) => `${prefix}-pm-${Math.random().toString(36).slice(2, 9)}` } }, { horizonDays: 400 });

    expect(summary.organizationsConsidered).toBeGreaterThanOrEqual(1);
    expect(summary.occurrencesCreated).toBeGreaterThanOrEqual(1);
    const after = repository.snapshot().pmOccurrences.filter((row) => row.planId === candidatePlan.id);
    expect(after.length).toBe(before.length + 1);
    const lastCompletedDueAt = before.filter((row) => row.status.startsWith("completed")).map((row) => row.dueAt).sort().at(-1)!;
    const expectedRecurrenceKey = new Date(Date.parse(lastCompletedDueAt) + candidatePlan.cadenceDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const created = after.find((row) => row.recurrenceKey === expectedRecurrenceKey);
    expect(created?.status).toBe("upcoming");
    const snapshot = repository.snapshot();
    expect(snapshot.auditEvents.some((event) => event.aggregateId === created!.id && event.eventType === "pm_occurrence.recurrence_scheduled")).toBe(true);
    expect(snapshot.outboxMessages.some((message) => message.aggregateId === created!.id && message.topic === "ops.pm_occurrence.recurrence_scheduled")).toBe(true);
  });


  it("never creates a second occurrence for the same slot or recurrence key", async () => {
    const test = pmHarness();
    await runPmRecurrenceCycle(test.services);
    const countAfterFirst = test.repository.snapshot().pmOccurrences.length;

    const rerunSameSlot = await runPmRecurrenceCycle(test.services);
    expect(rerunSameSlot.organizationsSkipped).toBe(rerunSameSlot.organizationsConsidered);
    expect(test.repository.snapshot().pmOccurrences.length).toBe(countAfterFirst);

    test.setNow("2026-09-02T08:00:00.000Z"); // next daily slot
    await runPmRecurrenceCycle(test.services);
    const keys = test.repository.snapshot().pmOccurrences.map((row) => `${row.planId}:${row.recurrenceKey ?? ""}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
