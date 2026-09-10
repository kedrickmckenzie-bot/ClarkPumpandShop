import { WARRANTY_REVIEW_TITLE, WARRANTY_REVIEW_DONE } from "./warranty-review";
import type { OperatorSession } from "@/components/ops/data-contract";
import { roleCanAccessDetailRoute, roleCanOpenOperatorHref } from "@/components/ops/role-policy";
import { invoiceReporting } from "./invoice-reporting";
import { DEFAULT_OPERATIONS_TIME_ZONE, formatOperationsDate, formatOperationsDateTime } from "./local-time";
import type { OpsRepository, OrganizationScope } from "./repository";
import type { Money, SiteVisitWorkOrder, WorkOrderVerification } from "./types";
import type { WorkOrderDetailView } from "./view-models";
import { applicableOutcomeVerification, latestRecordedWorkOutcome } from "./work-order-outcome";

export interface ReviewEvidence {
  id: string;
  label: string;
  detail: string;
  href?: string;
  date?: string;
}

export interface WorkReviewModel {
  id: string;
  number: string;
  problem: string;
  scope: string;
  status: string;
  outcome: ReviewEvidence;
  context: ReviewEvidence[];
  obligations: ReviewEvidence[];
  history: ReviewEvidence[];
  historyCount: number;
  costs: ReviewEvidence[];
  costCount: number;
  costTotal: string;
  invoices: ReviewEvidence[];
  invoiceCount: number;
  invoiceTotal: string;
  quotes: ReviewEvidence[];
  quoteCount: number;
  warranties: ReviewEvidence[];
  warrantyCount: number;
  related: ReviewEvidence[];
  relatedMoreHref?: string;
  equipmentScope?: string;
  equipmentHref?: string;
  missing: string[];
  openHref: string;
}

const words = (value: string) => value.replaceAll("_", " ");
const money = (value: Money) => new Intl.NumberFormat("en-US", { style: "currency", currency: value.currency }).format(value.amountMinor / 100);
export function recordedMoneyLabel(values: readonly Money[]): string {
  if (!values.length) return "No amounts recorded";
  const totals = new Map<string, number>();
  values.forEach((value) => totals.set(value.currency, (totals.get(value.currency) ?? 0) + value.amountMinor));
  return [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([currency, amountMinor]) => money({ currency, amountMinor })).join(" + ");
}

/** Verification belongs to one service cycle. A new visit cannot inherit an older sign-off. */
export function workOutcomeEvidence(work: Pick<WorkOrderDetailView, "id" | "visits">, links: SiteVisitWorkOrder[], verifications: WorkOrderVerification[]): ReviewEvidence {
  const latest = latestRecordedWorkOutcome(links);
  const verification = applicableOutcomeVerification(verifications, latest);
  const current = [...links].sort((a, b) => b.linkedAt.localeCompare(a.linkedAt) || b.id.localeCompare(a.id))[0];
  const visit = current ? work.visits.find((row) => row.id === current.visitId) : undefined;
  return {
    id: latest?.id ?? current?.id ?? work.id,
    label: latest ? `Provider reported ${words(latest.outcome!)}` : current ? "Current visit has no job outcome yet" : "No linked service outcome recorded",
    detail: latest
      ? [latest.outcomeNotes, verification ? `Manager review: ${words(verification.decision)}${verification.basis ? ` (${words(verification.basis)})` : ""}${verification.reason ? ` — ${verification.reason}` : ""}.` : "No manager verification recorded for this outcome."].filter(Boolean).join(" ")
      : visit?.status === "active" ? `${visit.providerName} checked in; completion has not been reported for this job.` : "A visit or work-order status alone does not establish that the problem was resolved.",
    date: latest?.outcomeRecordedAt ?? visit?.checkedInAt,
    href: `/app/work-orders/${work.id}?view=visits#work-verification`,
  };
}

/** Record-scoped reads only. The authorization gate precedes every related-data query.
 * Lists of other equipment work are capped and use repository pagination; no tenant snapshot. */
export async function loadWorkReview(repository: OpsRepository, session: OperatorSession, workOrderId: string, now: string): Promise<WorkReviewModel | null> {
  if (!roleCanAccessDetailRoute(session.role, "work-order")) return null;
  if (session.role === "store_manager" && !session.storeIds?.length || session.role === "regional" && !session.regionIds?.length) return null;
  const scope: OrganizationScope = { organizationId: session.organizationId, storeIds: session.storeIds, regionIds: session.regionIds };
  const work = await repository.getWorkOrderDetail(scope, workOrderId);
  if (!work) return null;
  const org = session.organizationId;
  const base = `/app/work-orders/${work.id}`;
  const [links, verifications, tasks, estimates, financial, store, equipment, sourceWork, impacts, activeAssignment, requestTasks] = await Promise.all([
    repository.listSiteVisitWorkOrdersForWorkOrder(org, work.id),
    repository.listWorkOrderVerifications(org, work.id),
    repository.listWorkflowTasksForWorkOrder(org, work.id),
    repository.listEstimateRequestsForWorkOrder(org, work.id),
    repository.getWorkOrderInvoiceSources(org, work.id),
    repository.getStore(org, work.storeId),
    work.asset && session.demoEdition !== "accountability" ? repository.getAssetWarrantySources(org, work.asset.id) : undefined,
    repository.getWorkOrder(org, work.id),
    work.request ? repository.listRequestImpactAssessments(org, work.request.id) : [],
    repository.getActiveAssignment(org, work.id),
    work.request ? repository.listWorkflowTasksForRequest(org, work.request.id) : [],
  ]);
  const zone = store?.timeZone ?? DEFAULT_OPERATIONS_TIME_ZONE;
  const date = (value: string) => formatOperationsDate(value, zone);
  const dateTime = (value: string) => formatOperationsDateTime(value, zone);
  const evidence = (item: ReviewEvidence): ReviewEvidence => ({ ...item, href: item.href && roleCanOpenOperatorHref(session.role, item.href) ? item.href : undefined });
  const activeEstimates = estimates.filter((row) => !["withdrawn", "not_selected", "declined", "expired"].includes(row.status));
  const providerIds = new Set([...activeEstimates.map((row) => row.vendorId), ...(equipment?.repairItems.map((row) => row.vendorId) ?? []), ...(equipment?.appliedWarranties.flatMap((row) => row.obligatedVendorId ? [row.obligatedVendorId] : []) ?? []), ...(activeAssignment?.vendorId ? [activeAssignment.vendorId] : [])]);
  const [proposals, peerPage, providers] = await Promise.all([
    Promise.all(activeEstimates.map(async (request) => ({ request, proposal: await repository.getLatestEstimateProposal(org, request.id) }))),
    work.asset && session.demoEdition !== "accountability" ? repository.listWorkOrders(scope, { storeId: work.storeId, assetId: work.asset.id, componentId: work.component?.id, limit: 7 }) : undefined,
    Promise.all([...providerIds].map((id) => repository.getVendor(org, id))),
  ]);
  const providerNames = new Map(providers.flatMap((row) => row ? [[row.id, row.name] as const] : []));
  const peerRows = peerPage?.items.filter((row) => row.id !== work.id).slice(0, 5) ?? [];
  const peers = await Promise.all(peerRows.map(async (row) => {
    const [detail, outcomes, confirmations] = await Promise.all([
      repository.getWorkOrderDetail(scope, row.id),
      repository.listSiteVisitWorkOrdersForWorkOrder(org, row.id),
      repository.listWorkOrderVerifications(org, row.id),
    ]);
    const outcome = detail ? workOutcomeEvidence(detail, outcomes, confirmations) : undefined;
    return evidence({ id: row.id, label: `${row.number} · ${row.problem}`, date: row.createdAt, detail: `${date(row.createdAt)} · ${outcome?.label ?? words(row.status)}. ${detail?.costs.length ? `${recordedMoneyLabel(detail.costs)} recorded work cost.` : "No work cost entered."}${outcome?.detail ? ` ${outcome.detail}` : ""}`, href: `/app/work-orders/${row.id}` });
  }));
  const context: ReviewEvidence[] = [
    { id: "store", label: `${work.storeNumber} · ${work.storeName}`, detail: "Store", href: `/app/stores/${work.storeId}` },
    { id: "owner", label: work.internalAccountableParty, detail: "Accountable operator" },
    { id: "provider", label: activeAssignment ? activeAssignment.vendorId ? providerNames.get(activeAssignment.vendorId) ?? "Outside vendor" : activeAssignment.kind === "internal" ? "Internal maintenance" : "Provider not chosen" : work.vendorName ?? "No active provider assigned", detail: activeAssignment ? "Current assignment" : work.vendorName ? "Most recent recorded provider; no active assignment" : "Current assignment", href: activeAssignment?.vendorId || work.vendorId ? `/app/vendors/${activeAssignment?.vendorId ?? work.vendorId}` : undefined },
  ];
  if (work.request && roleCanAccessDetailRoute(session.role, "request")) context.push({ id: work.request.id, label: work.request.problem, detail: `Source report ${work.request.reference} · ${dateTime(work.request.submittedAt)}`, href: `/app/requests/${work.request.id}` });
  if (work.asset && session.demoEdition !== "accountability") context.push({ id: work.asset.id, label: work.component ? `${work.asset.name} › ${work.component.name}` : work.asset.name, detail: work.component ? "This component is linked to the work" : "Equipment linked; component not specified", href: `/app/equipment/${work.asset.id}${work.component ? `?component=${work.component.id}` : ""}` });
  if (work.authorizedScope) context.push({ id: "scope", label: work.authorizedScope, detail: "Authorized work scope", href: `${base}?view=service` });
  const impact = [...impacts].filter((row) => row.organizationId === org && row.storeId === work.storeId).sort((a, b) => b.assessedAt.localeCompare(a.assessedAt) || b.id.localeCompare(a.id))[0];
  if (impact) context.push({ id: impact.id, label: `Operating state: ${words(impact.storeOperatingState)} · Safety: ${words(impact.safetyConcern)}`, detail: `${words(impact.source)} by ${impact.assessedByActorName} · ${dateTime(impact.assessedAt)}. Product risk: ${words(impact.productInventoryRisk)}.${impact.notes ? ` ${impact.notes}` : ""}`, href: work.request && roleCanAccessDetailRoute(session.role, "request") ? `/app/requests/${work.request.id}?section=impact-assessment` : base });
  const obligations: ReviewEvidence[] = work.followUps.filter((row) => row.status === "open").map((row) => ({ id: row.id, label: row.nextAction, detail: `${row.accountableParty} · Due ${dateTime(row.dueAt)}`, href: `${base}?view=service` }));
  const followUpIds = new Set(obligations.map((row) => row.id));
  const effectiveTasks = [...new Map([...tasks, ...requestTasks].map((task) => [task.id, task])).values()];
  for (const task of effectiveTasks.filter((row) => !["completed", "cancelled"].includes(row.status) && (!row.sourceFollowUpId || !followUpIds.has(row.sourceFollowUpId)))) obligations.push({ id: task.id, label: task.taskType === "review_warranty" ? WARRANTY_REVIEW_TITLE : task.title, detail: `${task.assigneeName}${task.dueAt ? ` · Due ${dateTime(task.dueAt)}` : ""} · ${task.taskType === "review_warranty" ? WARRANTY_REVIEW_DONE : task.completionCriteria}`, href: task.taskType === "review_warranty" && equipment?.warrantyCases.filter((row) => row.workOrderId === work.id && !row.closedAt).length === 1 ? `/app/warranties/${equipment.warrantyCases.find((row) => row.workOrderId === work.id && !row.closedAt)!.id}#diagnosis` : `${base}?view=activity` });
  if (!obligations.length && !["closed", "cancelled", "resolved"].includes(work.status)) obligations.push({ id: "next", label: work.nextAction, detail: `${work.accountableParty}${work.dueAt ? ` · Due ${dateTime(work.dueAt)}` : ""}`, href: base });
  const history: ReviewEvidence[] = [];
  for (const visit of work.visits) {
    const link = links.find((row) => row.visitId === visit.id);
    const verification = link ? applicableOutcomeVerification(verifications, link) : undefined;
    history.push({ id: visit.id, label: `${dateTime(visit.checkedInAt)} · ${visit.providerName}`, date: visit.checkedInAt,
      detail: [visit.checkedOutAt ? `Checked out ${dateTime(visit.checkedOutAt)}.` : "Visit still active.", link?.outcome ? `For this job: ${words(link.outcome)}.${link.outcomeNotes ? ` ${link.outcomeNotes}` : ""}` : "No per-job outcome recorded.", verification ? `Manager review: ${words(verification.decision)}${verification.reason ? ` — ${verification.reason}` : ""}.` : "No manager review of this outcome."].join(" "), href: `/app/visits/${visit.id}` });
  }
  const reporting = invoiceReporting(financial, org);
  const allocations = reporting.allocations.filter((row) => row.workOrderId === work.id && (!row.storeId || row.storeId === work.storeId));
  const invoices = allocations.map((row) => evidence({ id: row.id, label: `${row.invoiceNumber} · ${money(row.amount)}`, detail: `${date(row.invoiceDate)} · Confirmed allocation to this work order`, href: row.href }));
  const quotes = proposals.map(({ request, proposal }) => evidence({ id: request.id,
    label: `${request.decisionKind === "replacement_quote" ? "Replacement quote" : "Service quote"} · ${providerNames.get(request.vendorId) ?? "Vendor"} · ${proposal ? money(proposal.amount) : "Price awaited"}`,
    detail: proposal ? [proposal.scope, proposal.exclusions ? `Excludes: ${proposal.exclusions}.` : "Exclusions not entered.", proposal.leadTimeDays !== undefined ? `Lead time: ${proposal.leadTimeDays} days.` : "Availability not entered.", proposal.validUntil ? `Valid through ${date(proposal.validUntil)}${proposal.validUntil.slice(0, 10) < now.slice(0, 10) ? " (expired)" : ""}.` : "Quote validity not entered.", request.status === "selected" ? "Selected option." : "Awaiting selection."].join(" ") : request.requestedScope,
    href: `${base}?view=service&path=bids#bid-requests` }));
  const warranties: ReviewEvidence[] = [];
  if (equipment && work.asset) {
    const equipmentHref = `/app/equipment/${work.asset.id}${work.component ? `/components/${work.component.id}` : ""}`;
    for (const item of equipment.warrantyCases.filter((row) => row.workOrderId === work.id)) warranties.push({ id: item.id, label: `Warranty review: ${words(item.coverageDecision)}`, detail: `${words(item.status)} · ${item.detectionExplanation}${item.invoiceHold ? " · Invoice hold recorded" : ""}`, href: `/app/warranties/${item.id}` });
    for (const repair of equipment.repairItems.filter((row) => !work.component || row.componentId === work.component.id)) {
      for (const warranty of equipment.appliedWarranties.filter((row) => row.repairItemId === repair.id)) {
        const amendments = equipment.warrantyAmendments.filter((row) => row.appliedWarrantyId === warranty.id).sort((a, b) => b.decidedAt.localeCompare(a.decidedAt));
        const amended = amendments.find((row) => row.amendmentKind !== "accept_calculated");
        warranties.push({ id: warranty.id, label: `${words(warranty.coverageType)} · ${repair.repairAction}`, detail: `${date(repair.completionDate)} repair by ${providerNames.get(repair.vendorId) ?? "the recorded provider"}. ${amended ? `Terms amended: ${amended.reason}. Review the amendment before relying on coverage.` : `Recorded term ${date(warranty.startDate)}–${date(warranty.endDate)}. ${warranty.endDate < now.slice(0, 10) ? "Term has ended." : warranty.startDate > now.slice(0, 10) ? "Term has not started." : "Check whether this problem is covered."}`} Routing: ${words(warranty.routingRule)}${warranty.obligatedVendorId ? ` · ${providerNames.get(warranty.obligatedVendorId) ?? "Recorded obligated vendor"}` : ""}.`, href: `/app/work-orders/${repair.workOrderId}?view=equipment#work-equipment-context` });
      }
    }
    for (const item of equipment.manufacturerWarranties.filter((row) => !work.component || !row.componentId || row.componentId === work.component.id)) warranties.push({ id: item.id, label: `${item.manufacturer} · ${item.componentId ? "Component" : "Equipment"} warranty`, detail: `${date(item.startDate)}–${date(item.expirationDate)}. Parts: ${item.partsCoverage}. Labor: ${item.laborCoverage}.${item.claimRequirements ? ` ${item.claimRequirements}` : ""}`, href: equipmentHref });
    if (!warranties.length && work.asset.warrantyEndsAt) warranties.push({ id: "asset-reference", label: "Equipment warranty date", detail: `Recorded through ${date(work.asset.warrantyEndsAt)}. Coverage terms and responsibility still need checking.`, href: equipmentHref });
  }
  const missing: string[] = [];
  if (!links.length) missing.push("No linked job outcome is available.");
  if (!work.costs.length) missing.push("No work cost has been entered; that does not mean the work was free.");
  if (!invoices.length) missing.push("No reconciled, confirmed invoice allocation is recorded for this work.");
  if (work.asset && !warranties.length && session.demoEdition !== "accountability") missing.push("No warranty terms are recorded for this equipment scope.");
  if (sourceWork?.repairEstimate && !proposals.some(({ request, proposal }) => request.decisionKind === "replacement_quote" && proposal)) missing.push("A repair estimate is entered; a replacement quote is still needed for a quoted comparison.");
  if (sourceWork?.repairEstimate) quotes.unshift(evidence({ id: "repair-estimate", label: `Entered repair estimate · ${money(sourceWork.repairEstimate)}`, detail: "Planning input. Compare the submitted scope and exclusions before choosing an option.", href: `${base}?view=equipment` }));
  return {
    id: work.id, number: work.number, problem: work.problem, scope: `${work.storeNumber} · ${work.storeName}`, status: words(work.status),
    outcome: evidence(workOutcomeEvidence(work, links, verifications)), context: context.map(evidence), obligations: obligations.map(evidence),
    history: history.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")).slice(0, 15).map(evidence), historyCount: history.length,
    costs: [...work.costs].sort((a, b) => b.serviceDate.localeCompare(a.serviceDate)).slice(0, 15).map((row) => evidence({ id: row.id, label: `${money(row)} · ${row.description}`, detail: `${date(row.serviceDate)} · ${words(row.kind)}`, href: `${base}?view=cost` })), costCount: work.costs.length,
    costTotal: recordedMoneyLabel(work.costs), invoices: invoices.slice(0, 15), invoiceCount: invoices.length, invoiceTotal: recordedMoneyLabel(allocations.map((row) => row.amount)),
    quotes: quotes.slice(0, 12), quoteCount: quotes.length, warranties: warranties.slice(0, 12).map(evidence), warrantyCount: warranties.length, related: peers,
    relatedMoreHref: work.asset ? `/app/work-orders?store=${work.storeId}&asset=${work.asset.id}${work.component ? `&component=${work.component.id}` : ""}` : undefined,
    equipmentScope: work.asset ? work.component ? `${work.component.name} on ${work.asset.name}` : `${work.asset.name} · All components and unclassified component work` : undefined,
    equipmentHref: work.asset ? `/app/equipment/${work.asset.id}?history=all${work.component ? `&component=${work.component.id}` : ""}#equipment-review` : undefined,
    missing, openHref: base,
  };
}
