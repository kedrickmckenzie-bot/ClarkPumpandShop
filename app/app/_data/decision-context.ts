import { formatOperationsDate } from "@/lib/ops/local-time";
import type { OperatorSession } from "@/components/ops/data-contract";
import type { OpsFixture, WorkOrder } from "@/lib/ops/types";
import { recordedMoneyLabel } from "@/lib/ops/work-review";
import { recordedWarrantyDiagnosis } from "@/lib/ops/warranty-review";
import { buildEquipmentReview } from "./equipment-review";

type Query = Record<string, string | string[] | undefined>;
export function buildDecisionContext(fixture: OpsFixture, session: OperatorSession, assetId: string, query: Query, current?: WorkOrder) {
  const selected = buildEquipmentReview(fixture, session, assetId, query);
  const whole = buildEquipmentReview(fixture, session, assetId, { ...query, component: undefined, historyPage: undefined });
  if (!selected || !whole) return undefined;
  const org = session.organizationId;
  const asset = fixture.assets.find((row) => row.organizationId === org && row.id === assetId)!;
  const first = (value: Query[string]) => Array.isArray(value) ? value[0] : value;
  const componentId = first(query.component);
  const components = fixture.components.filter((row) => row.organizationId === org && row.assetId === assetId);
  const ids = new Set(componentId ? [componentId] : []);
  for (let changed = true; changed;) { changed = false; for (const component of components) if (component.parentComponentId && ids.has(component.parentComponentId) && !ids.has(component.id)) { ids.add(component.id); changed = true; } }
  const inScope = (id?: string) => !componentId || (componentId === "unlinked" ? !id : !!id && ids.has(id));
  const work = fixture.workOrders.filter((row) => row.organizationId === org && row.assetId === assetId && row.storeId === asset.storeId && inScope(row.componentId) && !selected.notice);
  const scopedIds = new Set(work.map((row) => row.id));
  const from = new Date(fixture.asOf); const months = first(query.history) === "24" ? 24 : first(query.history) === "all" ? undefined : 12;
  if (months) from.setUTCMonth(from.getUTCMonth() - months);
  const within = (date: string) => (!months || date.slice(0, 10) >= from.toISOString().slice(0, 10)) && date.slice(0, 10) <= fixture.asOf.slice(0, 10);
  const costs = fixture.costLines.filter((row) => row.organizationId === org && scopedIds.has(row.workOrderId) && within(row.serviceDate));
  const costWorkIds = new Set(costs.map((row) => row.workOrderId));
  const periodWork = work.filter((row) => within(row.createdAt) || costWorkIds.has(row.id) || fixture.siteVisitWorkOrders.some((link) => link.organizationId === org && link.workOrderId === row.id && within(link.outcomeRecordedAt ?? link.linkedAt)));
  const repairs = fixture.repairItems.filter((row) => row.organizationId === org && row.assetId === assetId && scopedIds.has(row.workOrderId) && inScope(row.componentId));
  const cases = fixture.warrantyCases.filter((row) => row.organizationId === org && scopedIds.has(row.workOrderId) && inScope(row.componentId) && !row.closedAt);
  const pending = cases.filter((row) => row.diagnosisRequired || row.coverageDecision === "pending_diagnosis");
  const remap = (href: string) => { const source = new URL(href, "https://local.test"); source.searchParams.set("decision", assetId); source.searchParams.set("asset", assetId); source.searchParams.set("view", "review"); return `/app/lifecycle?${source.searchParams}#decision-context`; };
  const costPage = Math.max(1, Math.min(Math.max(1, Math.ceil(costs.length / 20)), Math.floor(Number(first(query.costPage))) || 1));
  const costPageHref = (page: number) => { const url = new URL(remap(selected.choices.find((row) => row.selected)?.href ?? selected.choices[0].href), "https://local.test"); url.searchParams.set("costPage", String(page)); return `${url.pathname}?${url.searchParams}#decision-costs`; };
  const returnDecision = remap(selected.choices.find((row) => row.selected)?.href ?? selected.choices[0].href);
  const warrantyHref = (id: string) => `/app/warranties/${id}?${new URLSearchParams({returnDecision})}#diagnosis`;
  const missingCosts = periodWork.filter((row) => !costWorkIds.has(row.id)).length;
  const currentScope = current?.componentId ? components.find((row) => row.id === current.componentId)?.name ?? "Unrecognized component" : "Component not specified";
  const diagnosisCase = current && cases.find((row) => row.workOrderId === current.id);
  const diagnosis = diagnosisCase && recordedWarrantyDiagnosis(fixture, diagnosisCase)?.diagnosis;
  const latestRepair = repairs.filter((row) => within(row.completionDate)).sort((a,b) => b.completionDate.localeCompare(a.completionDate))[0];
  const facts = [
    ...(latestRepair ? [{ text: `Most recent recorded repair: ${formatOperationsDate(latestRepair.completionDate, fixture.stores.find((row) => row.organizationId === org && row.id === asset.storeId)?.timeZone)}. ${latestRepair.repairAction}`, href: `/app/work-orders/${latestRepair.workOrderId}?view=visits` }] : []),
    { text: `${selected.rowCount} work order${selected.rowCount === 1 ? " has" : "s have"} recorded activity in ${selected.period}. ${selected.workCost} in recorded work cost for this scope.`, href: "#decision-repairs" },
    { text: missingCosts ? `${missingCosts} of those work orders have no cost lines in this period. The total is recorded spending, not a complete repair bill.` : "These totals use recorded cost lines. They do not establish that every repair or charge was recorded.", href: "#decision-costs" },
    ...(diagnosis ? [{ text: `Recorded diagnosis: ${diagnosis}`, href: warrantyHref(diagnosisCase!.id) }] : pending.length ? [{ text: "An unresolved warranty case in this scope still needs a diagnosis and coverage decision. Similar complaints alone do not establish that an earlier repair failed.", href: warrantyHref(pending[0].id) }] : []),
  ];
  return {
    title: selected.title, period: selected.period, notice: selected.notice, currentScope,
    choices: selected.choices.map((row) => ({ ...row, href: remap(row.href) })), periods: selected.periods.map((row) => ({ ...row, href: remap(row.href) })),
    selectedCost: selected.workCost, wholeCost: whole.workCost, selectedComponent: !!componentId, facts,
    rows: selected.rows.map((row) => ({ ...row, repairs: repairs.filter((repair) => repair.workOrderId === row.id).map((repair) => ({ failure: repair.rootCause ?? repair.failureCode?.replaceAll("-", " ") ?? "Cause not recorded", action: repair.repairAction, date: repair.completionDate })) })),
    wholeHref: remap(whole.choices[0].href).replace("#decision-context", "#decision-costs"),
    rowCount: selected.rowCount, pages: selected.pages.map((row) => ({ ...row, href: remap(row.href) })),
    costCount: costs.length, costPages: [...(costPage > 1 ? [{label: "Previous cost lines", href: costPageHref(costPage - 1)}] : []), ...(costPage * 20 < costs.length ? [{label: "Next cost lines", href: costPageHref(costPage + 1)}] : [])],
    costs: [...costs].sort((a,b) => b.serviceDate.localeCompare(a.serviceDate) || b.id.localeCompare(a.id)).slice((costPage - 1) * 20, costPage * 20).map((row) => ({ id: row.id, description: row.description, date: formatOperationsDate(row.serviceDate, fixture.stores.find((item) => item.organizationId === org && item.id === asset.storeId)?.timeZone), amount: recordedMoneyLabel([row.amount]), work: work.find((item) => item.id === row.workOrderId)!.number, href: `/app/work-orders/${row.workOrderId}?view=cost` })),
    currentWork: selected.currentWork, warranty: selected.warranty,
    pending: pending.map((row) => ({ label: `Check diagnosis and warranty · ${work.find((item) => item.id === row.workOrderId)?.number}`, href: warrantyHref(row.id) })),
  };
}
export type DecisionContextModel = NonNullable<ReturnType<typeof buildDecisionContext>>;
