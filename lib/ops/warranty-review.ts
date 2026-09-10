import type { OpsFixture, WarrantyCase, WorkflowTask } from "./types";

export const WARRANTY_REVIEW_TITLE = "Check the diagnosis and warranty";
export const WARRANTY_REVIEW_DONE = "Record what failed, what the warranty will pay for, who will do the repair, and whether the invoice should stay on hold.";
export function warrantyTaskHref(fixture: OpsFixture, task: WorkflowTask): string | undefined {
  if (task.taskType !== "review_warranty") return undefined;
  const cases = fixture.warrantyCases.filter((row) => row.organizationId === task.organizationId && row.workOrderId === task.workOrderId);
  const open = cases.filter((row) => !row.closedAt);
  const pending = open.filter((row) => row.diagnosisRequired || row.coverageDecision === "pending_diagnosis");
  const candidates = pending.length ? pending : open.length ? open : cases;
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


/** Display recorded correction values without treating free-text notes as calculated policy. */
export function warrantyCorrectionTerms(json: string): Array<{label: string; value: string}> {
  const label = (key: string) => key === "note" ? "Recorded terms" : key.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ");
  const flatten = (value: unknown, path: string): Array<{label: string; value: string}> => {
    if (value === null || value === undefined) return [{label: label(path), value: "Not specified"}];
    if (Array.isArray(value)) return value.flatMap((item, index) => flatten(item, `${path} ${index + 1}`));
    if (typeof value === "object") return Object.entries(value).flatMap(([key, item]) => flatten(item, path ? `${path} · ${key}` : key));
    return [{label: label(path), value: String(value)}];
  };
  try { const terms = flatten(JSON.parse(json), ""); return terms.length ? terms : [{label: "Correction", value: "No replacement terms were recorded."}]; }
  catch { return [{label: "Correction unavailable", value: "The saved terms could not be read. Obtain confirmation before relying on the original terms."}]; }
}
