import type { OpsFixture, WarrantyCase, WorkflowTask } from "./types";

export const WARRANTY_REVIEW_TITLE = "Check the diagnosis and warranty";
export const WARRANTY_REVIEW_DONE = "Record what failed, what the warranty will pay for, who will do the repair, and whether the invoice should stay on hold.";
export function warrantyTaskHref(fixture: OpsFixture, task: WorkflowTask): string | undefined {
  if (task.taskType !== "review_warranty") return undefined;
  const cases = fixture.warrantyCases.filter((row) => row.organizationId === task.organizationId && row.workOrderId === task.workOrderId);
  const open = cases.filter((row) => !row.closedAt);
  const candidates = open.length ? open : cases;
  return candidates.length === 1 ? `/app/warranties/${candidates[0].id}#diagnosis` : undefined;
}
export function recordedWarrantyDiagnosis(fixture: Pick<OpsFixture, "auditEvents">, item: WarrantyCase) {
  const events = fixture.auditEvents.filter((row) => row.organizationId === item.organizationId && row.aggregateId === item.id && row.eventType === "warranty.coverage_decided").sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.id.localeCompare(a.id));
  const latest = events[0];
  if (!latest) return undefined;
  try {
    const payload = JSON.parse(latest.payloadJson) as Record<string, unknown>;
    return { diagnosis: typeof payload.diagnosis === "string" ? payload.diagnosis : undefined, reason: typeof payload.reason === "string" ? payload.reason : undefined, at: latest.occurredAt, by: latest.actorName };
  } catch { return undefined; }
}
