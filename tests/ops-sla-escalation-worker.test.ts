import { describe, expect, it } from "vitest";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";
import type { OpsFixture } from "@/lib/ops/types";
import { runSlaEscalationCycle } from "@/lib/ops/job-workers";

const BASE_NOW = "2026-09-01T12:00:00.000Z";
const TERMINAL_WORK_ORDER_STATUSES = new Set(["resolved", "closed", "cancelled"]);

function slaHarness(overrides?: (fixture: OpsFixture) => void) {
  const fixture = buildNorthlinePresentationFixture();
  const workOrderStatusById = new Map(fixture.workOrders.map((row) => [`${row.organizationId}:${row.id}`, row.status] as const));
  const escalatable = fixture.workflowTasks.filter((task) =>
    (task.status === "open" || task.status === "in_progress")
    && typeof task.dueAt === "string"
    && Boolean(task.escalationDestination)
    && task.workOrderId != null
    && !TERMINAL_WORK_ORDER_STATUSES.has(workOrderStatusById.get(`${task.organizationId}:${task.workOrderId}`) ?? ""),
  );
  fixture.workflowTasks = escalatable.slice(0, 6);
  overrides?.(fixture);
  const repository = createOpsFixtureRepository(fixture);
  let current = BASE_NOW;
  return {
    repository,
    services: { repository, clock: { now: () => current } },
    setNow(value: string) {
      current = value;
    },
  };
}

describe("SLA escalation worker", () => {
  it("escalates every overdue open task one level through the system actor and records the job run", async () => {
    const harness = slaHarness();
    const before = harness.repository.snapshot().workflowTasks;
    expect(before.length).toBeGreaterThan(0);

    const summary = await runSlaEscalationCycle(harness.services);

    expect(summary.organizationsConsidered).toBeGreaterThanOrEqual(1);
    expect(summary.organizationsSkipped).toBe(0);
    expect(summary.escalatedCount).toBe(before.length);
    expect(summary.cappedCount).toBe(0);

    const snapshot = harness.repository.snapshot();
    for (const task of before) {
      const escalated = snapshot.workflowTasks.find((row) => row.id === task.id)!;
      expect(escalated.escalationLevel).toBe(task.escalationLevel + 1);
      expect(snapshot.auditEvents.some((event) => event.aggregateId === task.id && event.eventType === "workflow_task.escalated")).toBe(true);
      expect(snapshot.outboxMessages.some((message) => message.aggregateId === task.id && message.topic === "ops.workflow_task.escalated")).toBe(true);
    }

    const runs = snapshot.jobRuns ?? [];
    expect(runs.length).toBeGreaterThanOrEqual(1);
    for (const run of runs) {
      expect(run.status).toBe("succeeded");
      expect(run.processedCount).toBeGreaterThan(0);
      expect(run.jobType).toBe("sla_escalation");
      expect(run.slotKey).toBe("2026-09-01T12:00");
    }
  });

  it("skips organizations whose job slot already executed", async () => {
    const harness = slaHarness();
    const first = await runSlaEscalationCycle(harness.services);
    const rerun = await runSlaEscalationCycle(harness.services);

    expect(rerun.organizationsConsidered).toBeGreaterThanOrEqual(1);
    expect(rerun.organizationsSkipped).toBe(rerun.organizationsConsidered);
    expect(rerun.escalatedCount).toBe(0);
    // The skipped slot must not create a second job-run row.
    expect((harness.repository.snapshot().jobRuns ?? []).length).toBe(first.organizationsConsidered);
  });

  it("climbs one level per slot and stops at the configured ceiling", async () => {
    const harness = slaHarness();
    const targets = harness.repository.snapshot().workflowTasks;

    await runSlaEscalationCycle(harness.services, { maxLevel: 2 });
    let levels = harness.repository.snapshot().workflowTasks.map((row) => row.escalationLevel);
    expect(levels.every((level) => level === 1)).toBe(true);

    harness.setNow("2026-09-01T13:30:00.000Z"); // next hour slot
    await runSlaEscalationCycle(harness.services, { maxLevel: 2 });
    levels = harness.repository.snapshot().workflowTasks.map((row) => row.escalationLevel);
    expect(levels.every((level) => level === 2)).toBe(true);

    harness.setNow("2026-09-01T14:30:00.000Z");
    const capped = await runSlaEscalationCycle(harness.services, { maxLevel: 2 });
    expect(capped.cappedCount).toBe(targets.length);
    expect(capped.escalatedCount).toBe(0);
    levels = harness.repository.snapshot().workflowTasks.map((row) => row.escalationLevel);
    expect(levels.every((level) => level === 2)).toBe(true);
  });

  it("leaves tasks without a due time or with a terminal lifecycle alone", async () => {
    const harness = slaHarness((fixture) => {
      const source = fixture.workflowTasks[0];
      if (!source) throw new Error("fixture needs at least one task");
      fixture.workflowTasks.push({
        ...source,
        id: `${source.id}-nodue`,
        dueAt: undefined,
        noSlaReason: "Waiting on a scheduled future event",
        status: "open",
        escalationLevel: 0,
      });
      fixture.workflowTasks.push({
        ...source,
        id: `${source.id}-done`,
        status: "completed",
        dueAt: "2026-08-01T00:00:00.000Z",
      });
    });

    const summary = await runSlaEscalationCycle(harness.services);
    const snapshot = harness.repository.snapshot().workflowTasks;
    const noDue = snapshot.find((row) => row.id.endsWith("-nodue"))!;
    expect(noDue.escalationLevel).toBe(0);
    const done = snapshot.find((row) => row.id.endsWith("-done"))!;
    expect(done.status).toBe("completed");
    // Only genuinely overdue open tasks were escalated.
    expect(summary.escalatedCount).toBe(snapshot.filter((row) => !row.id.endsWith("-nodue") && !row.id.endsWith("-done")).length);
  });
});
