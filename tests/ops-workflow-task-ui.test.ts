import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { OperatorSession } from "@/components/ops/data-contract";
import { WorkflowTaskPanel } from "@/components/ops/workflow-task-panel";
import {
  NORTHLINE_ORGANIZATION_ID,
  buildNorthlinePresentationFixture,
} from "@/lib/ops/fixtures";

vi.mock("server-only", () => ({}));

let buildWorkflowTaskWorkspaceModel: typeof import("@/app/app/_data/workflow-task-presenter").buildWorkflowTaskWorkspaceModel;

beforeAll(async () => {
  ({ buildWorkflowTaskWorkspaceModel } = await import("@/app/app/_data/workflow-task-presenter"));
});

function session(role: OperatorSession["role"]): OperatorSession {
  return {
    userId: `user-${role}`,
    membershipId: role === "facilities" ? "membership-northline-facilities" : "membership-northline-executive",
    displayName: role === "facilities" ? "Jordan Lee" : "Avery Chen",
    email: `${role}@northline-demo.example`,
    role,
    organizationId: NORTHLINE_ORGANIZATION_ID,
    organizationName: "Northline Fuel & Market",
    scopeLabel: "Northline companywide · 15 stores",
  };
}

describe("embedded work-order Workflow Task surface", () => {
  it("shows simultaneous obligations while routing source-governed completion through the real domain controls", () => {
    const fixture = buildNorthlinePresentationFixture();
    const model = buildWorkflowTaskWorkspaceModel(fixture, session("facilities"), "wo-northline-112");
    const markup = renderToStaticMarkup(createElement(WorkflowTaskPanel, { model }));

    expect(model.activeTasks).toHaveLength(2);
    expect(markup).toContain("Workflow Tasks and SLA accountability");
    expect(markup).toContain("Record service outcome");
    expect(markup).toContain("Verify operating condition after technician checkout");
    expect(markup).toContain("Who acts");
    expect(markup).toContain("Why it matters");
    expect(markup).toContain("Done when");
    expect(markup).toContain("Escalation");
    expect(markup).toContain('action="/api/ops/work-orders/wo-northline-112/tasks"');
    expect(markup).toContain('name="operation" value="start"');
    expect(markup).not.toContain('name="operation" value="complete"');
    expect(markup).not.toContain('name="operation" value="cancel"');
    expect(markup).toContain('name="operation" value="pause"');
    expect(markup).toContain('name="operation" value="escalate"');
  });

  it("shows generic resolution only when another required obligation remains", () => {
    const fixture = buildNorthlinePresentationFixture();
    const source = fixture.workflowTasks.find((task) => task.workOrderId === "wo-northline-112")!;
    fixture.workflowTasks.push({
      ...source,
      id: "workflow-task-wo-northline-112-generic",
      taskType: "other",
      title: "Document the after-hours access contact",
      status: "open",
      sourceFollowUpId: undefined,
      sourceApprovalRequestId: undefined,
    });
    const model = buildWorkflowTaskWorkspaceModel(fixture, session("facilities"), "wo-northline-112");
    const generic = model.activeTasks.find((task) => task.id === "workflow-task-wo-northline-112-generic");

    expect(generic?.availableActions).toContain("complete");
    expect(generic?.availableActions).toContain("cancel");
  });

  it("suppresses dead generic resolution when a task is the sole required obligation", () => {
    const fixture = buildNorthlinePresentationFixture();
    const source = fixture.workflowTasks.find((task) => task.workOrderId === "wo-northline-115")!;
    source.taskType = "other";
    source.sourceFollowUpId = undefined;
    source.sourceApprovalRequestId = undefined;
    const model = buildWorkflowTaskWorkspaceModel(fixture, session("facilities"), "wo-northline-115");
    const task = model.activeTasks.find((candidate) => candidate.id === source.id);

    expect(task?.availableActions).not.toContain("complete");
    expect(task?.availableActions).not.toContain("cancel");
  });

  it("renders active and resumed SLA holds without rewriting either interval", () => {
    const fixture = buildNorthlinePresentationFixture();
    const model = buildWorkflowTaskWorkspaceModel(fixture, session("facilities"), "wo-recent-aug-102-hvac");
    const markup = renderToStaticMarkup(createElement(WorkflowTaskPanel, { model }));

    expect(markup).toContain("SLA paused");
    expect(markup).toContain("Approved condenser-fan motor is awaiting confirmed distributor availability");
    expect(markup).toContain("Cedar Mechanical · Vendor");
    expect(markup).toContain("Operational Restoration, Completion");
    expect(markup).toContain("Facilities review completed and the parts request was released");
    expect(markup).toContain('name="operation" value="resume"');
  });

  it("keeps task evidence visible while withholding mutation forms from review-only roles", () => {
    const fixture = buildNorthlinePresentationFixture();
    const model = buildWorkflowTaskWorkspaceModel(fixture, session("executive"), "wo-northline-112");
    const markup = renderToStaticMarkup(createElement(WorkflowTaskPanel, { model }));

    expect(markup).toContain("Verify operating condition after technician checkout");
    expect(markup).toContain("Your role can review Workflow Tasks and SLA evidence but cannot change them.");
    expect(markup).not.toContain('action="/api/ops/work-orders/wo-northline-112/tasks"');
    expect(markup).not.toContain('name="operation"');
  });

  it("routes the close-verified-work obligation only through guarded work-order closure", () => {
    const fixture = buildNorthlinePresentationFixture();
    const model = buildWorkflowTaskWorkspaceModel(fixture, session("facilities"), "wo-recent-aug-111-plumbing");
    const markup = renderToStaticMarkup(createElement(WorkflowTaskPanel, { model }));
    const closeTask = model.activeTasks.find((task) => task.title === "Close verified work");

    expect(closeTask).toBeDefined();
    expect(closeTask?.availableActions).not.toContain("complete");
    expect(closeTask?.availableActions).not.toContain("cancel");
    expect(markup).not.toContain('name="operation" value="complete"');
    expect(markup).not.toContain('name="operation" value="cancel"');
  });

  it("shows explicit no-SLA policy and terminal resolution evidence in task history", () => {
    const fixture = buildNorthlinePresentationFixture();
    const source = fixture.workflowTasks.find((task) => task.id === "workflow-task-wo-northline-112-verification")!;
    fixture.workflowTasks.push({
      ...source,
      id: "workflow-task-wo-northline-112-history",
      title: "Document scheduled commissioning review",
      status: "completed",
      requiredForProgress: false,
      dueAt: undefined,
      noSlaReason: "Scheduled event is governed by the store reopening plan",
      startedAt: undefined,
      startedByActorType: undefined,
      startedByActorName: undefined,
      completedAt: "2026-08-10T18:30:00.000Z",
      completedByActorType: "user",
      completedByActorId: "membership-northline-facilities",
      completedByActorName: "Jordan Lee",
      resolutionNote: "Commissioning review added to the reopening calendar",
    });
    const model = buildWorkflowTaskWorkspaceModel(fixture, session("facilities"), "wo-northline-112");
    const markup = renderToStaticMarkup(createElement(WorkflowTaskPanel, { model }));

    expect(model.history.map((task) => task.id)).toContain("workflow-task-wo-northline-112-history");
    expect(model.history.find((task) => task.id === "workflow-task-wo-northline-112-history")).toMatchObject({
      status: "completed",
      noSlaReason: "Scheduled event is governed by the store reopening plan",
      resolutionNote: "Commissioning review added to the reopening calendar",
    });
    expect(markup).toContain("No SLA deadline");
    expect(markup).toContain("No-SLA reason: Scheduled event is governed by the store reopening plan");
    expect(markup).toContain("Commissioning review added to the reopening calendar");
  });
});
