import type { AuditEvent, DemoData, FollowUp, ServiceVisit, VisitOutcome, WorkOrder } from "@/lib/domain/types";

export interface ClassificationPatch {
  systemId?: string;
  assetId?: string;
  componentId?: string;
}

export function validateClassification(data: DemoData, workOrder: WorkOrder, patch: ClassificationPatch) {
  const systemId = patch.systemId ?? workOrder.systemId;
  const assetId = patch.assetId ?? workOrder.assetId;
  const componentId = patch.componentId ?? workOrder.componentId;
  const system = systemId ? data.systems.find((candidate) => candidate.id === systemId) : undefined;
  if (system && (system.storeId !== workOrder.storeId || system.categoryId !== workOrder.categoryId)) throw new Error("System must belong to the work order store and category");
  const asset = assetId ? data.assets.find((candidate) => candidate.id === assetId) : undefined;
  if (assetId && !asset) throw new Error("Asset does not exist");
  if (asset && (!systemId || asset.storeSystemId !== systemId)) throw new Error("Asset must belong to the selected system");
  const component = componentId ? data.components.find((candidate) => candidate.id === componentId) : undefined;
  if (componentId && !component) throw new Error("Component does not exist");
  if (component && (!assetId || component.assetId !== assetId)) throw new Error("Component must belong to the selected asset");
  return { systemId, assetId, componentId };
}

export function reclassifyWorkOrder(data: DemoData, workOrder: WorkOrder, patch: ClassificationPatch, actor: string, at: string, reason: string) {
  const next = validateClassification(data, workOrder, patch);
  const updated = { ...workOrder, ...next };
  const auditEvent: AuditEvent = {
    id: `audit-reclass-${workOrder.id}-${Date.parse(at)}`,
    entityType: "work_order",
    entityId: workOrder.id,
    type: "work_order.reclassified",
    actor,
    at,
    summary: "Work-order maintenance association updated",
    detail: `${reason} · prior ${workOrder.systemId ?? "no system"}/${workOrder.assetId ?? "no asset"}/${workOrder.componentId ?? "no component"}; new ${updated.systemId ?? "no system"}/${updated.assetId ?? "no asset"}/${updated.componentId ?? "no component"}.`,
  };
  return { workOrder: updated, auditEvent };
}

export function followUpForOutcome(workOrder: WorkOrder, visit: ServiceVisit, outcome: VisitOutcome, at: string): FollowUp | null {
  const rules: Partial<Record<VisitOutcome, { party: string; action: string; hours: number; escalation: string }>> = {
    temporary: { party: "Clark's Facilities", action: "Confirm permanent repair plan", hours: 4, escalation: "Facilities Director" },
    diagnosed_unresolved: { party: "Clark's Facilities", action: "Contact vendor and document repair plan", hours: 4, escalation: "Facilities Director" },
    unable_to_diagnose: { party: "Clark's Facilities", action: "Choose vendor escalation or alternative vendor", hours: 4, escalation: "Facilities Director" },
    no_issue_found: { party: "Store Manager", action: "Confirm store condition before closure", hours: 8, escalation: "Regional Manager" },
    unable_to_perform: { party: "Clark's Facilities", action: "Resolve access, authorization or rescheduling", hours: 4, escalation: "Regional Manager" },
  };
  const rule = rules[outcome];
  if (!rule) return null;
  return {
    id: `followup-${visit.id}-${outcome}`,
    workOrderId: workOrder.id,
    sourceVisitId: visit.id,
    accountableParty: rule.party,
    nextAction: rule.action,
    dueAt: new Date(new Date(at).getTime() + rule.hours * 3_600_000).toISOString(),
    escalation: rule.escalation,
    status: "open",
    createdAt: at,
  };
}

export function isFollowUpOverdue(followUp: FollowUp, nowValue: string) {
  return followUp.status === "open" && new Date(followUp.dueAt) < new Date(nowValue);
}

export function canCloseWorkOrder(workOrder: WorkOrder, followUps: FollowUp[]) {
  if (followUps.some((followUp) => followUp.workOrderId === workOrder.id && followUp.status === "open")) return { allowed: false, reason: "Required follow-up remains open" };
  if (workOrder.status === "completed_pending_verification") return { allowed: false, reason: "Store or management verification remains open" };
  return { allowed: true as const };
}

export function validateAllocation(invoiceTotalCents: number, allocationCents: number[]) {
  if (allocationCents.some((amount) => !Number.isInteger(amount) || amount < 0)) throw new Error("Allocation amounts must be non-negative integer cents");
  const total = allocationCents.reduce((sum, amount) => sum + amount, 0);
  if (total > invoiceTotalCents) throw new Error("Allocations cannot exceed invoice total");
  return { allocatedCents: total, unallocatedCents: invoiceTotalCents - total, reconciled: total === invoiceTotalCents };
}
