import { describe, expect, it } from "vitest";
import { projectAttentionItems } from "@/lib/ops/attention-projection";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";

function projectionInput() {
  const fixture = buildNorthlinePresentationFixture();
  return {
    fixture,
    organizationId: NORTHLINE_ORGANIZATION_ID,
    storeIds: new Set(fixture.stores.map((store) => store.id)),
    includeCompanywide: true,
    role: "facilities_admin" as const,
    membershipId: "membership-northline-facilities",
    asOf: fixture.asOf,
  };
}

describe("shared role-aware attention projection", () => {
  it("keeps a complete scoped population beyond 200 obligations and preserves independent tasks on one work order", () => {
    const input = projectionInput();
    const base = input.fixture.workflowTasks.find((task) => task.workOrderId);
    expect(base).toBeDefined();
    input.fixture.followUps = [];
    input.fixture.exceptions = [];
    input.fixture.vendorReminders = [];
    input.fixture.estimateRequests = [];
    input.fixture.estimateProposals = [];
    input.fixture.workOrderVisitHolds = [];
    input.fixture.inspections = [];
    input.fixture.workflowTasks = Array.from({ length: 225 }, (_, index) => ({
      ...base!,
      id: `attention-scale-${String(index).padStart(3, "0")}`,
      title: `Review obligation ${index}`,
      reason: `Distinct source condition ${index}`,
      status: "open" as const,
      sourceFollowUpId: undefined,
      sourceApprovalRequestId: undefined,
    }));

    const items = projectAttentionItems(input);

    expect(items).toHaveLength(225);
    expect(new Set(items.map((item) => item.id)).size).toBe(225);
    expect(items.every((item) => item.workOrderId === base!.workOrderId)).toBe(true);
    expect(items.map((item) => item.sourceIds[0])).toEqual(expect.arrayContaining([
      "attention-scale-000",
      "attention-scale-224",
    ]));
  });

  it("keeps the reviewer's own inspection item unless their own result task already opens it", () => {
    const input = projectionInput();
    const inspection = input.fixture.inspections!.find((row) => row.status === "performed")!;
    const work = input.fixture.workOrders.find((row) => row.storeId === inspection.storeId)!;
    inspection.workOrderId = work.id;
    const base = input.fixture.workflowTasks.find((task) => task.workOrderId)!;
    const task = (patch: Partial<typeof base>) => ({ ...base, id: "task-confirm-inspection-job", workOrderId: work.id, serviceRequestId: undefined, taskType: "verify_repair" as const, status: "open" as const, sourceFollowUpId: undefined, sourceApprovalRequestId: undefined, ...patch });
    const rows = () => projectAttentionItems(input).filter((item) => item.id === inspection.id || item.id === "task-confirm-inspection-job").map((item) => `${item.id}:${item.lane}`).sort();
    // The reviewer's own confirm task already opens the inspection: one row.
    input.fixture.workflowTasks = [task({ assigneeType: "role", assigneeRole: "facilities_admin" })];
    expect(rows()).toEqual(["task-confirm-inspection-job:mine"]);
    // A confirmation owned by the store manager must not hide the reviewer's review.
    input.fixture.workflowTasks = [task({ assigneeType: "role", assigneeRole: "store_manager" })];
    expect(rows()).toEqual([`${inspection.id}:mine`, "task-confirm-inspection-job:waiting"].sort());
    // Closed task: the inspection item is back on its own.
    input.fixture.workflowTasks = [task({ assigneeType: "role", assigneeRole: "facilities_admin", status: "completed" })];
    expect(rows()).toEqual([`${inspection.id}:mine`]);
  });

  it("never treats an inspection review as overdue because the inspection's own date passed", () => {
    const input = projectionInput();
    const inspection = input.fixture.inspections!.find((row) => row.status === "performed")!;
    inspection.dueDate = "2020-01-01";
    const item = projectAttentionItems(input).find((row) => row.id === inspection.id)!;
    expect(item.dueAt).toBeUndefined();
    expect(item.priority).toBe("normal");
    expect(item.completedAt).toBe(inspection.completedAt);
  });

  it("groups a task and its source follow-up without losing either durable identity", () => {
    const input = projectionInput();
    const baseTask = input.fixture.workflowTasks.find((task) => task.workOrderId);
    const baseFollowUp = input.fixture.followUps.find((followUp) => followUp.workOrderId === baseTask?.workOrderId)
      ?? input.fixture.followUps[0];
    expect(baseTask).toBeDefined();
    expect(baseFollowUp).toBeDefined();
    const workOrderId = baseFollowUp!.workOrderId;
    input.fixture.followUps = [{ ...baseFollowUp!, id: "follow-up-shared-source", workOrderId, status: "open" }];
    input.fixture.workflowTasks = [{
      ...baseTask!,
      id: "task-shared-source",
      workOrderId,
      serviceRequestId: undefined,
      sourceFollowUpId: "follow-up-shared-source",
      sourceApprovalRequestId: undefined,
      status: "open",
    }];
    input.fixture.exceptions = [];
    input.fixture.vendorReminders = [];
    input.fixture.estimateRequests = [];
    input.fixture.estimateProposals = [];
    input.fixture.workOrderVisitHolds = [];
    input.fixture.inspections = [];

    const items = projectAttentionItems(input);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "task-shared-source",
      sourceKind: "workflow_task",
      sourceIds: ["task-shared-source", "follow-up-shared-source"],
    });
  });

  it("presents a multi-vendor quote round as one decision while retaining every request and proposal id", () => {
    const input = projectionInput();
    const baseRequest = input.fixture.estimateRequests[0];
    const baseProposal = input.fixture.estimateProposals[0];
    expect(baseRequest).toBeDefined();
    expect(baseProposal).toBeDefined();
    const workOrderId = baseRequest!.workOrderId;
    input.fixture.workflowTasks = [];
    input.fixture.followUps = [];
    input.fixture.exceptions = [];
    input.fixture.vendorReminders = [];
    input.fixture.workOrderVisitHolds = [];
    input.fixture.inspections = [];
    input.fixture.estimateRequests = [
      { ...baseRequest!, id: "quote-request-a", workOrderId, status: "submitted", dueAt: "2026-08-30T17:00:00.000Z" },
      { ...baseRequest!, id: "quote-request-b", workOrderId, vendorId: "vendor-northline-summit", status: "requested", dueAt: "2026-08-29T17:00:00.000Z" },
    ];
    input.fixture.estimateProposals = [{ ...baseProposal!, id: "quote-proposal-a", requestId: "quote-request-a", workOrderId }];

    const rounds = projectAttentionItems(input).filter((item) => item.sourceKind === "quote_round");

    expect(rounds).toHaveLength(1);
    expect(rounds[0]).toMatchObject({
      workOrderId,
      title: "Review the vendor quote round",
      lane: "team",
    });
    expect(rounds[0]!.sourceIds).toEqual(expect.arrayContaining([
      "quote-request-a",
      "quote-request-b",
      "quote-proposal-a",
    ]));
  });

  it("does not hide an independent held-work review merely because the same work order has another task", () => {
    const input = projectionInput();
    const hold = input.fixture.workOrderVisitHolds?.[0];
    const baseTask = input.fixture.workflowTasks.find((task) => task.workOrderId);
    expect(hold).toBeDefined();
    expect(baseTask).toBeDefined();
    input.fixture.workflowTasks = [{
      ...baseTask!,
      id: "task-on-held-work-order",
      workOrderId: hold!.workOrderId,
      sourceFollowUpId: undefined,
      sourceApprovalRequestId: undefined,
      status: "open",
    }];
    input.fixture.followUps = [];
    input.fixture.exceptions = [];
    input.fixture.vendorReminders = [];
    input.fixture.estimateRequests = [];
    input.fixture.estimateProposals = [];

    const items = projectAttentionItems(input);

    expect(items.filter((item) => item.workOrderId === hold!.workOrderId).map((item) => item.id)).toEqual(
      expect.arrayContaining(["task-on-held-work-order", hold!.id]),
    );
  });
});


it("keeps completed task history separate from active tasks and within the same role and store scope", () => {
  const input = projectionInput();
  const base = input.fixture.workflowTasks.find((task) => task.workOrderId)!;
  input.fixture.workflowTasks = [{ ...base, id: "done", status: "completed", completedAt: input.asOf }, { ...base, id: "active", status: "open" }, { ...base, id: "foreign", organizationId: "other-org", status: "completed", completedAt: input.asOf }];
  expect(projectAttentionItems({ ...input, history: true }).map((item) => item.id)).toEqual(["done"]);
  expect(projectAttentionItems(input).some((item) => item.id === "done")).toBe(false);
  expect(projectAttentionItems({ ...input, history: true, storeIds: new Set() })).toEqual([]);
});
