import type { OpsRepository } from "./repository";
import type { OpsId, ServiceRunResponseKind } from "./types";

export interface ServiceRunPublicView {
  planningKind: "store_sweep" | "service_run";
  organizationName: string;
  vendorName: string;
  runId: OpsId;
  status: string;
  neededByAt?: string;
  proposedStartsAt: string;
  proposedEndsAt: string;
  responseDueAt: string;
  schedulingMode: string;
  contract: { version: number; sourceReference: string; effectiveLabel: string };
  recommendationExplanation: string;
  expectedWorkValueLabel: string;
  estimatedOpportunityLabel: string;
  estimatedTripReduction: number;
  estimatedDriveMinutes: number;
  estimatedServiceMinutes: number;
  capacityUsedMinutes: number;
  timeZone?: string;
  confidence: string;
  qualifications: string[];
  stops: Array<{
    id: OpsId;
    storeId: OpsId;
    storeLabel: string;
    sequence: number;
    proposedArrivalAt: string;
    driveMinutes: number;
    serviceMinutes: number;
    accessRequirements?: string;
    workOrders: Array<{ id: OpsId; number: string; problem: string; kind: "PM" | "Reactive"; durationMinutes: number; dueWindow?: string }>;
  }>;
  responseOptions: Array<{ value: ServiceRunResponseKind; label: string; description: string }>;
}

function money(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amountMinor / 100);
}

export async function buildServiceRunPublicView(input: {
  repository: OpsRepository;
  tokenHash: string;
  now: string;
}): Promise<ServiceRunPublicView | null> {
  const capability = await input.repository.getServiceRunByPublicToken({ tokenHash: input.tokenHash, purpose: "service_run_response", now: input.now });
  if (!capability) return null;
  const run = capability.run;
  const [organization, vendor, contract, stops, links] = await Promise.all([
    input.repository.getOrganization(run.organizationId),
    input.repository.getVendor(run.organizationId, run.vendorId),
    input.repository.getContractVersion(run.organizationId, run.contractVersionId),
    input.repository.listRouteStops(run.organizationId, run.id),
    input.repository.listServiceRunWorkOrders(run.organizationId, run.id),
  ]);
  if (!organization || !vendor || !contract) return null;
  const planningKind = run.schedulerVersion === "store-sweep-v1" ? "store_sweep" as const : "service_run" as const;
  const stopViews = await Promise.all(stops.sort((left, right) => left.sequence - right.sequence).map(async (stop) => {
    const store = await input.repository.getStore(run.organizationId, stop.storeId);
    if (!store) throw new Error("Service Run Store is unavailable");
    const workLinks = links.filter((link) => link.routeStopId === stop.id && link.planned);
    const workOrders = await Promise.all(workLinks.map(async (link) => {
      const workOrder = await input.repository.getWorkOrder(run.organizationId, link.workOrderId);
      if (!workOrder) throw new Error("Service Run Work Order is unavailable");
      const occurrence = link.occurrenceId ? await input.repository.getPmOccurrence(run.organizationId, link.occurrenceId) : null;
      return {
        id: workOrder.id, number: workOrder.number, problem: workOrder.problem,
        kind: occurrence ? "PM" as const : "Reactive" as const,
        durationMinutes: link.estimatedDurationMinutes,
        dueWindow: occurrence ? `${occurrence.windowStartsAt} to ${occurrence.windowEndsAt}` : undefined,
      };
    }));
    return {
      id: stop.id, storeId: store.id, storeLabel: `Store ${store.storeNumber} · ${store.name}`,
      sequence: stop.sequence, proposedArrivalAt: stop.proposedArrivalAt,
      driveMinutes: stop.estimatedDriveMinutes, serviceMinutes: stop.estimatedServiceMinutes,
      accessRequirements: stop.accessRequirements, workOrders,
    };
  }));
  return {
    planningKind, organizationName: organization.name, vendorName: vendor.name, runId: run.id, status: run.status,
    neededByAt: run.neededByAt, proposedStartsAt: run.proposedStartsAt, proposedEndsAt: run.proposedEndsAt, responseDueAt: run.responseDueAt,
    schedulingMode: run.schedulingMode, contract: { version: contract.version, sourceReference: contract.sourceAgreementReference, effectiveLabel: `${contract.effectiveStartsAt} to ${contract.effectiveEndsAt ?? "open-ended"}` },
    recommendationExplanation: run.recommendationExplanation,
    expectedWorkValueLabel: money(run.expectedWorkValue.amountMinor, run.expectedWorkValue.currency),
    estimatedOpportunityLabel: money(run.estimatedOpportunity.amountMinor, run.estimatedOpportunity.currency),
    estimatedTripReduction: run.estimatedTripReduction, estimatedDriveMinutes: run.estimatedDriveMinutes,
    estimatedServiceMinutes: run.estimatedServiceMinutes, capacityUsedMinutes: run.capacityUsedMinutes,
    timeZone: stops.length ? (await input.repository.getStore(run.organizationId, stops[0]!.storeId))?.timeZone : undefined,
    confidence: run.confidence, qualifications: run.requiredQualifications,
    stops: stopViews,
    responseOptions: planningKind === "store_sweep" ? [
      { value: "accepted", label: "Accept and choose a date", description: "Confirm the jobs and enter the date your company plans to visit." },
      { value: "work_order_change_requested", label: "Accept after removing a job", description: "Choose your planned date and tell the customer which job should not be included." },
      { value: "insufficient_capacity", label: "Cannot take these jobs", description: "Let the customer know your team is not available for this work." },
      { value: "declined", label: "Decline", description: "Decline these jobs and explain why." },
    ] : [
      { value: "accepted", label: "Accept this run", description: "Commit the original date, stops, and Work Order bundle." },
      { value: "countered", label: "Counter the schedule", description: "Propose another start time while preserving the original recommendation." },
      { value: "stop_change_requested", label: "Request a stop-order change", description: "Keep every Store but request another order." },
      { value: "work_order_change_requested", label: "Request a Work Order change", description: "Ask the operator to remove specific work from this run." },
      { value: "insufficient_capacity", label: "Report insufficient capacity", description: "Keep the obligations visible and explain the capacity constraint." },
      { value: "declined", label: "Decline", description: "Decline with a structured reason for operator review." },
    ],
  };
}
