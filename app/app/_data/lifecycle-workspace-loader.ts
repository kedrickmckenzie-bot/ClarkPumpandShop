import { roleCanAccessProgramRoute } from "@/components/ops/role-policy";
import { lifecyclePriceEvidence, priceLabel } from "@/lib/ops/lifecycle-price-evidence";
import { loadWorkReview, recordedMoneyLabel } from "@/lib/ops/work-review";
import { createOpsFixtureReadRepository } from "@/lib/ops/fixture-repository";
import { approvalRequestState } from "@/lib/ops/approval-governance";
import "server-only";

import type { OperatorSession, TimelineEventViewModel } from "@/components/ops/data-contract";
import type { LifecycleDecisionWorkspaceModel } from "@/components/workspace/lifecycle-record-stack";
import { calculateRepairReplacementScreening } from "@/lib/ops/lifecycle-analytics";
import { resolveLifecycleDecisionState } from "@/lib/ops/lifecycle-decision-state";
import { DEFAULT_OPERATIONS_TIME_ZONE, formatOperationsDate, formatOperationsDateTime } from "@/lib/ops/local-time";
import { resolveAssetReplacementEstimate } from "@/lib/ops/replacement-intelligence";
import type { OpsFixture } from "@/lib/ops/types";
import { buildWorkOrderCase, type WorkOrderCaseView } from "@/lib/ops/work-order-case";
import { getRequestOpsFixtureSnapshot } from "@/app/app/_data/request-data";
import { loadOperatorSession } from "./operator-loader";

type WorkspaceQuery = Record<string, string | string[] | undefined>;

export interface LoadedLifecycleRecordStack {
  model: LifecycleDecisionWorkspaceModel;
  workOrderCase?: WorkOrderCaseView;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function hrefWithQuery(query: WorkspaceQuery, changes: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    const candidate = first(value);
    if (candidate) params.set(key, candidate);
  }
  for (const [key, value] of Object.entries(changes)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  const serialized = params.toString();
  return serialized ? `/app/lifecycle?${serialized}` : "/app/lifecycle";
}

function money(amountMinor: number | undefined, currency = "USD"): string {
  if (amountMinor === undefined) return "Not entered";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amountMinor / 100);
}

function runway(months: number | undefined): string {
  if (months === undefined) return "Not calculable";
  if (months < 12) return `${Math.max(1, Math.round(months))} month${Math.round(months) === 1 ? "" : "s"}`;
  const years = months / 12;
  return `${Number.isInteger(years) ? years.toFixed(0) : years.toFixed(1)} years`;
}

function sentence(value: string): string {
  return value.replace(/[_-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function memberName(fixture: OpsFixture, membershipId: string | undefined): string {
  if (!membershipId) return "Customer operations";
  const membership = fixture.memberships.find((row) => row.id === membershipId);
  const user = membership ? fixture.users.find((row) => row.id === membership.userId) : undefined;
  return user?.displayName ?? "Customer operations";
}

function visibleAsset(fixture: OpsFixture, session: OperatorSession, assetId: string) {
  const asset = fixture.assets.find((row) => row.organizationId === session.organizationId && row.id === assetId);
  if (!asset) return undefined;
  const store = fixture.stores.find((row) => row.organizationId === session.organizationId && row.id === asset.storeId);
  if (!store) return undefined;
  if (session.role === "store_manager" && !session.storeIds?.length || session.role === "regional" && !session.regionIds?.length) return undefined;
  if (session.storeIds && !session.storeIds.includes(store.id)) return undefined;
  if (session.regionIds && (!store.regionId || !session.regionIds.includes(store.regionId))) return undefined;
  return { asset, store };
}

function activityForDecision(fixture: OpsFixture, organizationId: string, assetId: string, workOrderId: string | undefined, timeZone: string): TimelineEventViewModel[] {
  const events: Array<TimelineEventViewModel & { occurredAt: string }> = [];
  const add = (event: TimelineEventViewModel, occurredAt: string) => events.push({ ...event, occurredAt });
  const workOrder = workOrderId ? fixture.workOrders.find((row) => row.organizationId === organizationId && row.id === workOrderId) : undefined;
  const vendorName = (vendorId: string) => fixture.vendors.find((row) => row.organizationId === organizationId && row.id === vendorId)?.name ?? "Vendor";
  const timestamp = (value: string) => formatOperationsDateTime(value, timeZone);

  if (workOrder) add({ id: `work-created-${workOrder.id}`, title: "Work order created", description: workOrder.problem, timestampLabel: timestamp(workOrder.createdAt), actorLabel: workOrder.accountableParty, tone: "info" }, workOrder.createdAt);

  for (const request of fixture.estimateRequests.filter((row) => row.organizationId === organizationId && row.workOrderId === workOrderId)) {
    add({ id: `estimate-requested-${request.id}`, title: request.decisionKind === "replacement_quote" ? "Replacement price requested" : "Service quote requested", description: `${request.requestedScope} · Response requested from ${vendorName(request.vendorId)}.`, timestampLabel: timestamp(request.requestedAt), actorLabel: "Customer operations", tone: "info" }, request.requestedAt);
    if (request.openedAt) add({ id: `estimate-opened-${request.id}`, title: "Vendor opened pricing request", description: `${vendorName(request.vendorId)} opened the request.`, timestampLabel: timestamp(request.openedAt), actorLabel: vendorName(request.vendorId), tone: "neutral" }, request.openedAt);
    if (request.decisionAt) add({ id: `estimate-decided-${request.id}`, title: request.status === "selected" ? "Vendor quote selected" : `Pricing request ${sentence(request.status).toLowerCase()}`, description: `${vendorName(request.vendorId)} · ${request.decisionKind === "replacement_quote" ? "replacement quote" : "service quote"}.`, timestampLabel: timestamp(request.decisionAt), actorLabel: "Customer operations", tone: request.status === "selected" ? "positive" : "neutral" }, request.decisionAt);
  }

  for (const proposal of fixture.estimateProposals.filter((row) => row.organizationId === organizationId && row.workOrderId === workOrderId)) {
    add({ id: `proposal-${proposal.id}`, title: "Vendor submitted pricing", description: `${money(proposal.amount.amountMinor, proposal.amount.currency)} · ${proposal.scope}${proposal.exclusions ? ` · Excludes: ${proposal.exclusions}` : ""}`, timestampLabel: timestamp(proposal.submittedAt), actorLabel: vendorName(proposal.vendorId), tone: "info" }, proposal.submittedAt);
  }

  for (const issuance of fixture.issuances.filter((row) => row.organizationId === organizationId && row.workOrderId === workOrderId)) {
    add({ id: `issuance-${issuance.id}`, title: `Service authorization sent · revision ${issuance.revision}`, description: `Sent by ${sentence(issuance.channel)}.`, timestampLabel: timestamp(issuance.issuedAt), actorLabel: "Customer operations", tone: "info" }, issuance.issuedAt);
  }

  for (const response of fixture.vendorResponses.filter((row) => row.organizationId === organizationId && row.workOrderId === workOrderId)) {
    add({ id: `response-${response.id}`, title: `Vendor ${sentence(response.response).toLowerCase()}`, description: response.message ?? (response.proposedAt ? `Proposed ${timestamp(response.proposedAt)}.` : "Response recorded from the vendor link."), timestampLabel: timestamp(response.respondedAt), actorLabel: response.responderName, tone: response.response === "declined" ? "warning" : response.response === "accepted" ? "positive" : "info" }, response.respondedAt);
  }

  for (const continuation of (fixture.vendorContinuations ?? []).filter((row) => row.organizationId === organizationId && row.workOrderId === workOrderId)) {
    add({ id: `continuation-${continuation.id}`, title: sentence(continuation.action), description: continuation.message ?? "Operator response recorded against the vendor message.", timestampLabel: timestamp(continuation.createdAt), actorLabel: memberName(fixture, continuation.createdByMembershipId), tone: "info" }, continuation.createdAt);
  }

  for (const appointment of (fixture.serviceAppointments ?? []).filter((row) => row.organizationId === organizationId && row.workOrderId === workOrderId)) {
    add({ id: `appointment-${appointment.id}`, title: `Service date ${sentence(appointment.status).toLowerCase()}`, description: `${timestamp(appointment.startsAt)}${appointment.note ? ` · ${appointment.note}` : ""}`, timestampLabel: timestamp(appointment.createdAt), actorLabel: appointment.proposedBy === "vendor" ? "Vendor" : memberName(fixture, appointment.createdByMembershipId), tone: appointment.status === "confirmed" ? "positive" : appointment.status === "cancelled" ? "warning" : "info" }, appointment.createdAt);
  }

  const workVisitLinks = fixture.siteVisitWorkOrders.filter((row) => row.organizationId === organizationId && row.workOrderId === workOrderId);
  const workVisitIds = new Set(workVisitLinks.map((row) => row.visitId));
  for (const visit of fixture.visits.filter((row) => row.organizationId === organizationId && (workVisitIds.has(row.id) || row.workOrderId === workOrderId && !fixture.siteVisitWorkOrders.some((link) => link.organizationId === organizationId && link.visitId === row.id)))) {
    const job = workVisitLinks.find((row) => row.visitId === visit.id);
    const outcome = job ? job.outcome : visit.outcome;
    const notes = job ? job.outcomeNotes : visit.outcomeNotes;
    add({ id: `visit-in-${visit.id}`, title: "Technician checked in", description: visit.arrivalNote || visit.purpose, timestampLabel: timestamp(visit.checkedInAt), actorLabel: `${visit.technicianName} · ${visit.providerName}`, tone: "info" }, visit.checkedInAt);
    if (visit.checkedOutAt) add({ id: `visit-out-${visit.id}`, title: outcome ? `Provider reported · ${sentence(outcome)}` : "Technician checked out · Job outcome not recorded", description: notes ?? "Checkout recorded without additional notes for this job.", timestampLabel: timestamp(visit.checkedOutAt), actorLabel: `${visit.technicianName} · ${visit.providerName}`, tone: outcome === "completed" || outcome === "resolved" || outcome === "pm_complete" ? "positive" : outcome ? "warning" : "neutral" }, visit.checkedOutAt);
  }

  for (const decision of fixture.lifecycleRecommendations.filter((row) => row.organizationId === organizationId && row.assetId === assetId && (!workOrderId || !row.workOrderId || row.workOrderId === workOrderId))) {
    add({ id: `lifecycle-${decision.id}`, title: `Management decision · ${sentence(decision.userDecision)}`, description: `${decision.userReason}${decision.plannedForYear ? ` · Planned for ${decision.plannedForYear}.` : ""}`, timestampLabel: timestamp(decision.decidedAt), actorLabel: memberName(fixture, decision.decidedByMembershipId), tone: decision.userDecision === "replace" ? "warning" : decision.userDecision === "repair" ? "positive" : "info" }, decision.decidedAt);
  }

  for (const replacement of fixture.replacementEvents.filter((row) => row.organizationId === organizationId && row.assetId === assetId && (!workOrderId || row.workOrderId === workOrderId))) {
    add({ id: `replacement-${replacement.id}`, title: replacement.status === "completed" ? "Replacement completed" : replacement.status === "approved" ? "Replacement approved" : "Replacement cancelled", description: `${money((replacement.finalAmount ?? replacement.approvedAmount).amountMinor, (replacement.finalAmount ?? replacement.approvedAmount).currency)} recorded against the selected vendor quote.`, timestampLabel: timestamp(replacement.completedAt ?? replacement.approvedAt), actorLabel: "Customer operations", tone: replacement.status === "completed" ? "positive" : replacement.status === "approved" ? "warning" : "neutral" }, replacement.completedAt ?? replacement.approvedAt);
  }

  const structuredTimes = new Set(events.map((event) => event.occurredAt));
  for (const audit of fixture.auditEvents.filter((row) => row.organizationId === organizationId && (row.aggregateId === workOrderId || row.aggregateId === assetId))) {
    if (structuredTimes.has(audit.occurredAt)) continue;
    add({ id: `audit-${audit.id}`, title: sentence(audit.eventType), description: "Recorded in the append-only audit history.", timestampLabel: timestamp(audit.occurredAt), actorLabel: audit.actorName, tone: "neutral" }, audit.occurredAt);
  }

  return events.sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)).slice(0, 30).map((event) => ({
    id: event.id,
    title: event.title,
    description: event.description,
    timestampLabel: event.timestampLabel,
    actorLabel: event.actorLabel,
    tone: event.tone,
    link: event.link,
  }));
}

function workOrderCase(fixture: OpsFixture, organizationId: string, workOrderId: string, storeName: string, timeZone: string): WorkOrderCaseView | undefined {
  const workOrder = fixture.workOrders.find((row) => row.organizationId === organizationId && row.id === workOrderId);
  if (!workOrder) return undefined;
  const estimateRequests = fixture.estimateRequests.filter((row) => row.organizationId === organizationId && row.workOrderId === workOrderId);
  const requestIds = new Set(estimateRequests.map((row) => row.id));
  const invoiceReferenceIds = new Set(fixture.invoiceAllocations.filter((row) => row.organizationId === organizationId && row.workOrderId === workOrderId).map((row) => row.invoiceReferenceId));
  const invoiceLineAllocations = fixture.invoiceLineAllocations.filter((row) => row.organizationId === organizationId && row.workOrderId === workOrderId);
  const invoiceLineIds = new Set(invoiceLineAllocations.map((row) => row.invoiceLineId));
  const allocatedInvoiceLines = fixture.invoiceLines.filter((row) => row.organizationId === organizationId && invoiceLineIds.has(row.id));
  const invoiceIds = new Set(allocatedInvoiceLines.map((row) => row.invoiceId));
  const invoiceLines = fixture.invoiceLines.filter((row) => row.organizationId === organizationId && invoiceIds.has(row.invoiceId));
  return buildWorkOrderCase({
    hasPendingApproval: fixture.approvalRequests.some((row) => row.organizationId === organizationId && (row.subjectType === "work_order" && row.subjectId === workOrderId || row.subjectType === "service_request" && row.subjectId === workOrder.requestId) && approvalRequestState(row, fixture.approvalDecisions) === "pending"),
    now: fixture.asOf,
    workOrder,
    storeName,
    timeZone,
    assignments: fixture.assignments.filter((row) => row.organizationId === organizationId && row.workOrderId === workOrderId),
    issuances: fixture.issuances.filter((row) => row.organizationId === organizationId && row.workOrderId === workOrderId),
    vendorResponses: fixture.vendorResponses.filter((row) => row.organizationId === organizationId && row.workOrderId === workOrderId),
    appointments: (fixture.serviceAppointments ?? []).filter((row) => row.organizationId === organizationId && row.workOrderId === workOrderId),
    continuations: (fixture.vendorContinuations ?? []).filter((row) => row.organizationId === organizationId && row.workOrderId === workOrderId),
    visits: fixture.visits.filter((row) => row.organizationId === organizationId && (row.workOrderId === workOrderId || fixture.siteVisitWorkOrders.some((link) => link.organizationId === organizationId && link.workOrderId === workOrderId && link.visitId === row.id))),
    siteVisitWorkOrders: fixture.siteVisitWorkOrders.filter((row) => row.organizationId === organizationId && row.workOrderId === workOrderId),
    verifications: fixture.workOrderVerifications.filter((row) => row.organizationId === organizationId && row.workOrderId === workOrderId),
    workflowTasks: fixture.workflowTasks.filter((row) => row.organizationId === organizationId && (row.workOrderId === workOrderId || (workOrder.requestId && row.serviceRequestId === workOrder.requestId))),
    followUps: fixture.followUps.filter((row) => row.organizationId === organizationId && row.workOrderId === workOrderId),
    costLines: fixture.costLines.filter((row) => row.organizationId === organizationId && row.workOrderId === workOrderId),
    invoices: invoiceIds.size
      ? fixture.invoices.filter((row) => row.organizationId === organizationId && invoiceIds.has(row.id))
      : fixture.invoiceReferences.filter((row) => row.organizationId === organizationId && invoiceReferenceIds.has(row.id)).map((row) => ({ id: row.id, status: row.matchStatus })),
    invoiceLines,
    invoiceLineAllocations,
    invoiceExceptions: fixture.invoiceExceptions.filter((row) => row.organizationId === organizationId && invoiceIds.has(row.invoiceId)),
    invoiceAdjustments: fixture.invoiceAdjustments.filter((row) => row.organizationId === organizationId && invoiceIds.has(row.invoiceId)),
    valueEvents: fixture.valueEvents.filter((row) => row.organizationId === organizationId && (row.workOrderId === workOrderId || Boolean(row.invoiceLineId && invoiceLineIds.has(row.invoiceLineId)))),
    estimateRequests,
    estimateProposals: fixture.estimateProposals.filter((row) => row.organizationId === organizationId && requestIds.has(row.requestId)),
    replacementEvents: fixture.replacementEvents.filter((row) => row.organizationId === organizationId && row.workOrderId === workOrderId),
  });
}

export async function loadLifecycleRecordStack(assetId: string, query: WorkspaceQuery): Promise<LoadedLifecycleRecordStack | null> {
  const session = await loadOperatorSession();
  if (!roleCanAccessProgramRoute(session.role, "lifecycle")) return null;
  const fixture = await getRequestOpsFixtureSnapshot(session.organizationId);
  const found = visibleAsset(fixture, session, assetId);
  if (!found) return null;
  const { asset, store } = found;
  const workOrders = fixture.workOrders.filter((row) => row.organizationId === session.organizationId && row.assetId === asset.id && row.storeId === store.id);
  const reactiveWork = workOrders.filter((row) => row.priority !== "planned");
  const currentRepair = reactiveWork.filter((row) => !["closed", "cancelled", "completed_pending_review", "resolved"].includes(row.status) && Boolean(row.repairEstimate)).sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  const recordedReplacement = fixture.replacementEvents.filter((row) => row.organizationId === session.organizationId && row.assetId === asset.id && row.status !== "cancelled").sort((a,b) => b.approvedAt.localeCompare(a.approvedAt))[0];
  const proposalWork = currentRepair ?? workOrders.find((row) => row.id === recordedReplacement?.workOrderId);
  const replacement = resolveAssetReplacementEstimate(fixture, asset, fixture.asOf);
  const prices = lifecyclePriceEvidence(fixture, proposalWork, replacement.amount);
  const comparisonAmount = prices.replacement ?? replacement.amount;
  const comparable = !proposalWork?.repairEstimate || !comparisonAmount || proposalWork.repairEstimate.currency === comparisonAmount.currency;
  const screening = calculateRepairReplacementScreening(
    { ...asset, replacementEstimate: comparable ? prices.replacement ?? replacement.amount : undefined },
    proposalWork ? { proposalId: proposalWork.id, repairEstimateMinor: proposalWork.repairEstimate?.amountMinor, estimatedServiceExtensionMonths: proposalWork.estimatedServiceExtensionMonths, sourceRecordIds: [proposalWork.id] } : undefined,
  );
  const latestDecision = fixture.lifecycleRecommendations.filter((row) => row.organizationId === session.organizationId && row.assetId === asset.id && (!row.workOrderId || !proposalWork || row.workOrderId === proposalWork.id)).sort((left, right) => right.version - left.version || right.decidedAt.localeCompare(left.decidedAt))[0];
  const replacementEvents = fixture.replacementEvents.filter((row) => row.organizationId === session.organizationId && row.assetId === asset.id && (!proposalWork || row.workOrderId === proposalWork.id));
  const timeZone = store.timeZone ?? fixture.organizations.find((row) => row.id === session.organizationId)?.timeZone ?? DEFAULT_OPERATIONS_TIME_ZONE;
  const record = first(query.record);
  const activeChild = record === "work-order" && proposalWork ? "work-order" : record === "equipment" ? "equipment" : undefined;
  const closeHref = hrefWithQuery(query, { decision: undefined, record: undefined });
  const childCloseHref = hrefWithQuery(query, { decision: asset.id, record: undefined });
  const openWorkOrderHref = proposalWork ? `/app/work-orders/${proposalWork.id}?view=service` : undefined;
  const openEquipmentHref = `/app/equipment/${asset.id}#equipment-review`;
  const workCase = proposalWork ? workOrderCase(fixture, session.organizationId, proposalWork.id, `${store.storeNumber} - ${store.name}`, timeZone) : undefined;
  const managementDecision = resolveLifecycleDecisionState({ screening, latestDecision, replacementEvents });
  const observedIds = new Set(fixture.siteVisitWorkOrders.filter((row) => row.organizationId === session.organizationId && workOrders.some((work) => work.id === row.workOrderId)).map((row) => row.visitId));
  const observedVisits = fixture.visits.filter((row) => row.organizationId === session.organizationId && row.storeId === store.id && (observedIds.has(row.id) || row.workOrderId && workOrders.some((work) => work.id === row.workOrderId)));
  const pmOccurrences = fixture.pmOccurrences.filter((row) => row.organizationId === session.organizationId && row.assetId === asset.id);
  const contextFacts = [
    `${reactiveWork.length} reactive work order${reactiveWork.length === 1 ? "" : "s"} in the equipment history`,
    `${observedVisits.length} observed service visit${observedVisits.length === 1 ? "" : "s"}; presence is evidence, not certified labor`,
    `${recordedMoneyLabel(fixture.costLines.filter((row) => row.organizationId === session.organizationId && workOrders.some((work) => work.id === row.workOrderId)).map((row) => row.amount))} in recorded work cost across this equipment history`,
    asset.warrantyEndsAt ? `Warranty reference ${Date.parse(asset.warrantyEndsAt) >= Date.parse(fixture.asOf) ? "active through" : "expired"} ${formatOperationsDate(asset.warrantyEndsAt, timeZone)}` : "No warranty end date is recorded",
    `${pmOccurrences.length} preventive-maintenance occurrence${pmOccurrences.length === 1 ? "" : "s"} tied to this equipment`,
    replacement.explanation,
  ];
  const activity = activityForDecision(fixture, session.organizationId, asset.id, proposalWork?.id, timeZone);
  const review = proposalWork ? await loadWorkReview(createOpsFixtureReadRepository(fixture), session, proposalWork.id, fixture.asOf) : null;
  return {
    model: {
      prices,
      review: review ?? undefined,
      assetId: asset.id,
      assetName: asset.name,
      assetTag: asset.assetTag,
      storeLabel: `${store.storeNumber} - ${store.name}`,
      statusLabel: managementDecision.label,
      statusTone: managementDecision.tone,
      description: proposalWork?.problem ?? "No active repair proposal is attached to this equipment.",
      workOrderId: proposalWork?.id,
      workOrderNumber: proposalWork?.number,
      repairAmountLabel: priceLabel(proposalWork?.repairEstimate),
      replacementAmountLabel: prices.replacementLabel,
      repairShareLabel: screening.comparison.repairToReplacementRatio === undefined ? "Not calculable" : `${Math.round(screening.comparison.repairToReplacementRatio * 100)}%`,
      requiredRunwayLabel: runway(screening.comparison.requiredEconomicRunwayMonths),
      enteredServiceLabel: runway(screening.comparison.estimatedServiceExtensionMonths),
      decisionLabel: managementDecision.label,
      decisionHelper: latestDecision?.userReason ?? managementDecision.helper,
      ownerLabel: workCase?.accountableParty ?? proposalWork?.accountableParty ?? "Facilities",
      nextActionLabel: workCase?.primaryNextAction.label ?? proposalWork?.nextAction ?? "Review the equipment history and obtain the missing prices",
      dueLabel: workCase?.dueAt ? formatOperationsDateTime(workCase.dueAt, timeZone) : "No open due time",
      contextFacts,
      activity,
      closeHref,
      openWorkOrderHref: workCase?.primaryNextAction.href ?? openWorkOrderHref,
      openEquipmentHref,
      childCloseHref,
      activeChild,
    },
    workOrderCase: workCase,
  };
}

export function lifecycleDecisionHref(query: WorkspaceQuery, assetId: string): string {
  return hrefWithQuery(query, { decision: assetId, record: undefined });
}
