import type { OpsFixture } from "./types";

/**
 * Two fictional store reports set for regional review, so a regional manager's Review "Mine" list has real work.
 * Insert-only and stable (prefix "review-demo-"): a hosted demo gains them if missing and never has them overwritten.
 */
const REPORTS = [
  { key: "107-ice", storeId: "store-northline-107", reference: "REQ-26-107R", reporter: "Jamie Ortiz", employee: "E6107", hoursAgo: 5, priority: "routine" as const,
    problem: "Ice machine is making very little ice since this morning", state: "open" as const, risk: "none_reported" as const },
  { key: "109-sink", storeId: "store-northline-109", reference: "REQ-26-109R", reporter: "Morgan Lee", employee: "E6109", hoursAgo: 26, priority: "urgent" as const,
    problem: "Customer restroom sink is leaking under the counter", state: "partially_operational" as const, risk: "none_reported" as const },
];

export function addRegionalReviewDemo(f: OpsFixture): OpsFixture {
  const org = f.organizations[0]?.id;
  if (!org || f.requests.some(r => r.id.startsWith("review-demo-"))) return f;
  const asOf = Date.parse(f.asOf), iso = (ms: number) => new Date(ms).toISOString();
  for (const report of REPORTS) {
    if (!f.stores.some(s => s.id === report.storeId && s.organizationId === org)) continue;
    const id = `review-demo-request-${report.key}`, taskId = `review-demo-task-${report.key}`, at = iso(asOf - report.hoursAgo * 3_600_000);
    f.requests.push({ id, organizationId: org, reference: report.reference, storeId: report.storeId, reporterName: report.reporter, reporterEmployeeId: report.employee, problem: report.problem, priority: report.priority, status: "submitted", submittedAt: at });
    f.requestImpactAssessments.push({ id: `review-demo-impact-${report.key}`, organizationId: org, requestId: id, storeId: report.storeId, assessmentKind: "initial_report", storeOperatingState: report.state, safetyConcern: "none_reported", productInventoryRisk: report.risk, customersAffected: report.state === "open" ? "no" : "yes", complianceImpact: "none_reported", redundantEquipment: "unknown", confidence: "medium", source: "store_report", notes: "Store-reported; the regional manager confirms before work is authorized.", assessedByActorType: "user", assessedByActorId: report.employee, assessedByActorName: report.reporter, assessedAt: at });
    f.workflowTasks.push({ id: taskId, organizationId: org, serviceRequestId: id, taskType: "review_issue", title: `Review ${report.reference}`, reason: `Decide how this store report is handled: ${report.problem}`,
      assigneeType: "role", assigneeRole: "regional_manager", assigneeName: "Regional review", priority: report.priority === "urgent" ? "high" : "normal", status: "open", blocking: true, requiredForProgress: true,
      dueAt: iso(Date.parse(at) + (report.priority === "urgent" ? 4 : 24) * 3_600_000), applicableSlaClock: "intake_review",
      completionCriteria: "The report is confirmed and routed, or closed with a reason", escalationDestination: "Facilities director", escalationLevel: 0,
      createdByActorType: "user", createdByActorId: report.employee, createdByActorName: report.reporter, createdAt: at });
    f.auditEvents.push(
      { id: `review-demo-audit-request-${report.key}`, organizationId: org, aggregateType: "service_request", aggregateId: id, eventType: "request.submitted", actorType: "user", actorName: report.reporter, occurredAt: at, payloadJson: JSON.stringify({ storeId: report.storeId, reference: report.reference }) },
      { id: `review-demo-audit-task-${report.key}`, organizationId: org, aggregateType: "workflow_task", aggregateId: taskId, eventType: "workflow_task.created", actorType: "user", actorId: report.employee, actorName: report.reporter, occurredAt: at, payloadJson: JSON.stringify({ serviceRequestId: id, taskType: "review_issue", assigneeType: "role", assigneeRole: "regional_manager" }) },
    );
  }
  return f;
}
