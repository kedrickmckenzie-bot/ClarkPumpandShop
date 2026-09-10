import type { OperatorSession } from "@/components/ops/data-contract";
import { roleCan, roleCanOpenOperatorHref } from "@/components/ops/role-policy";
import { recordedMoneyLabel, type ReviewEvidence } from "@/lib/ops/work-review";
import { latestRecordedWorkOutcome, applicableOutcomeVerification } from "@/lib/ops/work-order-outcome";
import { formatOperationsDate } from "@/lib/ops/local-time";
import type { OpsFixture } from "@/lib/ops/types";

export interface EquipmentReviewModel {
  title: string;
  period: string;
  asOf: string;
  choices: Array<{ label: string; href: string; selected: boolean }>;
  periods: Array<{ label: string; href: string; selected: boolean }>;
  rows: Array<{ id: string; number: string; problem: string; scope: string; outcome: string; verification: string; cost: string; quotes: string[]; href: string }>;
  rowCount: number;
  workCost: string;
  warranty: ReviewEvidence[];
  currentWork: Array<{ label: string; href: string }>;
  createHref?: string;
  recordsHref: string;
  recordsLabel: string;
  pages: Array<{ label: string; href: string }>;
  componentHref?: string;
  notice?: string;
}

/** Equipment selection changes one review workspace. A component never inherits another component's history or costs. */
export function buildEquipmentReview(fixture: OpsFixture, session: OperatorSession, assetId: string, query: Record<string, string | string[] | undefined>): EquipmentReviewModel | null {
  const org = session.organizationId;
  const asset = fixture.assets.find((row) => row.organizationId === org && row.id === assetId);
  const store = asset && fixture.stores.find((row) => row.organizationId === org && row.id === asset.storeId);
  if (!asset || !store || !roleCanOpenOperatorHref(session.role, `/app/equipment/${assetId}`)) return null;
  if (session.storeIds !== undefined && !session.storeIds.includes(store.id) || session.regionIds !== undefined && (!store.regionId || !session.regionIds.includes(store.regionId))) return null;
  if (session.role === "store_manager" && !session.storeIds?.length || session.role === "regional" && !session.regionIds?.length) return null;
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const selectedId = first(query.component);
  const months = first(query.history) === "24" ? 24 : first(query.history) === "all" ? undefined : 12;
  const starts = new Date(fixture.asOf);
  if (months) starts.setUTCMonth(starts.getUTCMonth() - months);
  const from = months ? starts.toISOString().slice(0, 10) : undefined;
  const to = fixture.asOf.slice(0, 10);
  const within = (value: string) => (!from || value.slice(0, 10) >= from) && value.slice(0, 10) <= to;
  const components = fixture.components.filter((row) => row.organizationId === org && row.assetId === asset.id);
  const selected = components.find((row) => row.id === selectedId);
  const selectedIds = new Set(selected ? [selected.id] : []);
  // Parent components include their recorded descendants; cycles cannot expand this set forever.
  for (let changed = true; changed;) {
    changed = false;
    for (const component of components) if (component.parentComponentId && selectedIds.has(component.parentComponentId) && !selectedIds.has(component.id)) { selectedIds.add(component.id); changed = true; }
  }
  const invalid = Boolean(selectedId && selectedId !== "unlinked" && !selected);
  const scopedWork = fixture.workOrders.filter((row) => row.organizationId === org && row.storeId === store.id && row.assetId === asset.id && !invalid && (!selectedId || (selectedId === "unlinked" ? !row.componentId : Boolean(row.componentId && selectedIds.has(row.componentId)))));
  const scopeIds = new Set(scopedWork.map((row) => row.id));
  const links = fixture.siteVisitWorkOrders.filter((row) => row.organizationId === org && scopeIds.has(row.workOrderId));
  const costs = fixture.costLines.filter((row) => row.organizationId === org && scopeIds.has(row.workOrderId) && within(row.serviceDate));
  const costIds = new Set(costs.map((row) => row.workOrderId));
  const activeIds = new Set(links.filter((row) => within(row.outcomeRecordedAt ?? row.linkedAt)).map((row) => row.workOrderId));
  const work = scopedWork.filter((row) => within(row.createdAt) || costIds.has(row.id) || activeIds.has(row.id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  const page = Math.max(1, Math.min(Math.max(1, Math.ceil(work.length / 12)), Math.floor(Number(first(query.historyPage))) || 1));
  const date = (value: string) => formatOperationsDate(value, store.timeZone);
  const href = (changes: Record<string, string | undefined>) => {
    const params = new URLSearchParams(Object.entries(query).flatMap(([key, value]) => first(value) ? [[key, first(value)!]] : []));
    for (const [key, value] of Object.entries(changes)) { if (value) params.set(key, value); else params.delete(key); }
    if (!("historyPage" in changes)) params.delete("historyPage");
    return `/app/equipment/${asset.id}?${params}#equipment-review`;
  };
  const title = selected ? `${asset.name} › ${selected.name}${selectedIds.size > 1 ? " and its components" : ""}` : selectedId === "unlinked" ? `${asset.name} › Component not specified` : `${asset.name} › Whole equipment`;
  const warranty: ReviewEvidence[] = [];
  if (!invalid && selectedId !== "unlinked") {
    const repairs = fixture.repairItems.filter((row) => row.organizationId === org && row.assetId === asset.id && (!selected || Boolean(row.componentId && selectedIds.has(row.componentId))));
    const repairsById = new Map(repairs.map((row) => [row.id, row]));
    for (const reference of fixture.appliedWarranties.filter((row) => row.organizationId === org && repairsById.has(row.repairItemId))) {
      const repair = repairsById.get(reference.repairItemId)!;
      const amendments = fixture.warrantyAmendments.filter((row) => row.organizationId === org && row.appliedWarrantyId === reference.id && row.amendmentKind !== "accept_calculated").sort((a, b) => b.decidedAt.localeCompare(a.decidedAt));
      warranty.push({ id: reference.id, label: `${reference.coverageType.replaceAll("_", " ")} · ${date(repair.completionDate)} repair`, detail: amendments.length ? `Terms amended: ${amendments[0].reason}. Check the recorded amendment.` : `${date(reference.startDate)}–${date(reference.endDate)} · ${reference.routingRule.replaceAll("_", " ")} · ${reference.endDate < to ? "Term ended" : "Check applicability to this problem"}`, href: `/app/work-orders/${repair.workOrderId}?view=equipment#work-equipment-context` });
    }
    for (const reference of fixture.manufacturerWarranties.filter((row) => row.organizationId === org && row.assetId === asset.id && (!selected || !row.componentId || selectedIds.has(row.componentId)))) warranty.push({ id: reference.id, label: `${reference.manufacturer} · ${reference.componentId ? components.find((row) => row.id === reference.componentId)?.name ?? "Component" : "Whole equipment"}`, detail: `${date(reference.startDate)}–${date(reference.expirationDate)}. Parts: ${reference.partsCoverage}. Labor: ${reference.laborCoverage}. ${reference.claimRequirements ?? "Claim requirements not entered."}` });
    const end = selected?.warrantyEndsAt ?? (!selected ? asset.warrantyEndsAt : undefined);
    if (!warranty.length && end) warranty.push({ id: "reference", label: "Recorded warranty date", detail: `${date(end)} · Coverage terms and responsibility need checking.` });
  }
  const records = new URLSearchParams({ store: store.id, asset: asset.id, ...(selectedId ? { component: selectedId } : {}) });
  return {
    title, period: from ? `${date(from)}–${date(to)}` : `All recorded dates through ${date(to)}`, asOf: date(to),
    choices: [{ label: "Whole equipment", href: href({ component: undefined }), selected: !selectedId }, ...components.map((row) => ({ label: `${row.name}${row.removedAt && !row.name.toLowerCase().includes("removed") ? " (removed)" : ""}`, href: href({ component: row.id }), selected: row.id === selectedId })), { label: "Component not specified", href: href({ component: "unlinked" }), selected: selectedId === "unlinked" }],
    periods: ["12", "24", "all"].map((value) => ({ label: value === "all" ? "All recorded dates" : `${value} months`, href: href({ history: value }), selected: value === (months?.toString() ?? "all") })),
    rows: work.slice((page - 1) * 12, page * 12).map((row) => {
      const outcome = latestRecordedWorkOutcome(links.filter((link) => link.workOrderId === row.id));
      const verification = applicableOutcomeVerification(fixture.workOrderVerifications.filter((item) => item.organizationId === org && item.workOrderId === row.id), outcome);
      const estimates = fixture.estimateRequests.filter((item) => item.organizationId === org && item.workOrderId === row.id && !["withdrawn", "declined", "expired", "not_selected"].includes(item.status));
      return { id: row.id, number: row.number, problem: row.problem, scope: row.componentId ? components.find((item) => item.id === row.componentId)?.name ?? "Unknown component" : "Component not specified", outcome: outcome ? `${date(outcome.outcomeRecordedAt!)} · Provider reported ${outcome.outcome!.replaceAll("_", " ")}${outcome.outcomeNotes ? `: ${outcome.outcomeNotes}` : ""}` : `No job outcome recorded · Work status: ${row.status.replaceAll("_", " ")}`, verification: verification ? `Manager review: ${verification.decision.replaceAll("_", " ")}${verification.reason ? ` — ${verification.reason}` : ""}` : "No manager review of the current outcome", cost: recordedMoneyLabel(costs.filter((item) => item.workOrderId === row.id).map((item) => item.amount)), quotes: estimates.map((estimate) => { const proposal = fixture.estimateProposals.filter((item) => item.organizationId === org && item.requestId === estimate.id).sort((a, b) => b.revision - a.revision)[0]; return `${estimate.decisionKind === "replacement_quote" ? "Replacement" : "Service"}: ${proposal ? `${recordedMoneyLabel([proposal.amount])} · ${proposal.scope}${proposal.validUntil && proposal.validUntil.slice(0, 10) < to ? " · Expired quote" : ""}` : "Price awaited"}`; }), href: `/app/work-orders/${row.id}` };
    }),
    rowCount: work.length, workCost: recordedMoneyLabel(costs.map((row) => row.amount)), warranty,
    currentWork: scopedWork.filter((row) => !["closed", "cancelled", "resolved"].includes(row.status)).map((row) => ({ label: `${row.number} · ${row.problem}`, href: `/app/work-orders/${row.id}` })),
    createHref: roleCan(session, "create_work_order") && !invalid ? `/app/work-orders/new?${new URLSearchParams({ store: store.id, asset: asset.id, ...(selected ? { component: selected.id } : {}) })}` : undefined,
    recordsHref: `/app/work-orders?${selectedIds.size > 1 ? new URLSearchParams({ store: store.id, asset: asset.id }) : records}`, recordsLabel: selectedIds.size > 1 ? "All work on the whole equipment" : "All work orders in this scope", componentHref: selected ? `/app/equipment/${asset.id}/components/${selected.id}` : undefined,
    pages: [...(page > 1 ? [{ label: "Previous history", href: href({ historyPage: String(page - 1) }) }] : []), ...(page * 12 < work.length ? [{ label: "Next history", href: href({ historyPage: String(page + 1) }) }] : [])],
    notice: invalid ? "This component is unavailable on this equipment record. Choose a listed scope to review its evidence." : undefined,
  };
}
