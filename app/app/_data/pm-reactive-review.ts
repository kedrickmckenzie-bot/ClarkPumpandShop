import type { BreakdownViewModel, ProgramPageViewModel, TableRowViewModel, TrendViewModel } from "@/components/ops/data-contract";
import type { Asset, OpsFixture, PmOccurrence, Store, WorkOrder } from "@/lib/ops/types";

/** Chart and drill-down share these source sets; a queue filter is not an analytical cohort. */
export function buildPmReactiveReview(input: {
  fixture: OpsFixture; organizationId: string; stores: Store[]; assets: Asset[]; workOrders: WorkOrder[];
  occurrences: Array<{ occurrence: PmOccurrence; status: string }>;
  query: Record<string, string | string[] | undefined>; scopeLabel: string;
}) {
  const { fixture, organizationId, stores, assets, workOrders, occurrences, query, scopeLabel } = input;
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const href = (changes: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    for (const key of ["store", "region", "program", "evidence", "cohort", "month"]) {
      const value = first(query[key]); if (value) params.set(key, value);
    }
    for (const [key, value] of Object.entries(changes)) { if (value) params.set(key, value); else params.delete(key); }
    return `/app/pm?${params}`;
  };
  const from = new Date(Date.parse(fixture.asOf) - 365.2425 * 86400000).toISOString();
  const through = fixture.asOf.slice(0, 10);
  const period = `${from.slice(0, 10)} – ${through}`;
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const storeById = new Map(stores.map((store) => [store.id, store]));
  const coveredIds = new Set(occurrences.flatMap(({ occurrence }) => occurrence.assetId && assetById.has(occurrence.assetId) ? [occurrence.assetId] : []));
  const latest = new Map<string, (typeof occurrences)[number]>();
  for (const item of [...occurrences].sort((a, b) => a.occurrence.windowEndsAt.localeCompare(b.occurrence.windowEndsAt) || a.occurrence.id.localeCompare(b.occurrence.id))) {
    if (item.occurrence.assetId && coveredIds.has(item.occurrence.assetId) && item.status !== "waived" && item.occurrence.windowEndsAt < fixture.asOf) latest.set(item.occurrence.assetId, item);
  }
  const cohorts = {
    completed: new Set([...latest].filter(([, item]) => item.status === "completed").map(([id]) => id)),
    missed: new Set([...latest].filter(([, item]) => item.status !== "completed").map(([id]) => id)),
    all: new Set(latest.keys()),
  };
  // Exclude PM-generated work from every program, even when reviewing one program.
  const pmWorkIds = new Set(fixture.pmOccurrences.filter((item) => item.organizationId === organizationId).flatMap((item) => item.workOrderId ? [item.workOrderId] : []));
  const reactive = workOrders.filter((work) => work.assetId && coveredIds.has(work.assetId) && assetById.get(work.assetId)?.storeId === work.storeId && !pmWorkIds.has(work.id));
  const reactiveById = new Map(reactive.map((work) => [work.id, work]));
  const createdInPeriod = reactive.filter((work) => work.createdAt >= from && work.createdAt <= fixture.asOf);
  const costs = fixture.costLines.filter((line) => line.organizationId === organizationId && reactiveById.has(line.workOrderId) && line.serviceDate >= from.slice(0, 10) && line.serviceDate <= through && line.amount.currency === "USD");
  const byMonth = new Map<string, number>();
  for (const line of costs) byMonth.set(line.serviceDate.slice(0, 7), (byMonth.get(line.serviceDate.slice(0, 7)) ?? 0) + line.amount.amountMinor);
  const money = (minor: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(minor / 100);
  const rate = (ids: Set<string>) => ids.size ? createdInPeriod.filter((work) => ids.has(work.assetId!)).length / (ids.size * 12) * 100 : 0;
  const workHref = (work: WorkOrder) => `/app/work-orders/${work.id}`;
  const returnHref = href({ evidence: undefined, cohort: undefined, month: undefined, view: "all" });
  const costDescription = `Recorded work cost in USD by service date, ${period}, for equipment in the selected PM programs. PM-generated work is excluded. Other currencies are excluded, not converted. Missing cost history is not a measured zero. This is not proof that PM caused or prevented a repair.`;
  const rateDescription = `Trailing-12-month reactive Work Orders per 100 equipment-months, grouped by the latest closed, non-waived PM window. The denominator is cohort equipment × 12, not adjusted for partial equipment exposure. PM-generated work is excluded. This does not prove PM caused the difference; there is not enough data in groups below 10 for a reliable comparison.`;
  const breakdown: BreakdownViewModel = {
    id: "pm-effectiveness-cohorts", title: "Reactive work by latest PM completion", description: rateDescription,
    totalLabel: `${cohorts.all.size} equipment`,
    segments: (["completed", "missed"] as const).map((cohort) => ({ id: cohort === "completed" ? "latest-compliant" : "latest-noncompliant", label: `Latest PM ${cohort} (${cohorts[cohort].size})`, value: rate(cohorts[cohort]), formattedValue: cohorts[cohort].size ? `${rate(cohorts[cohort]).toFixed(1)} / 100` : "No equipment", tone: cohort === "completed" ? "positive" : "warning", link: { href: href({ evidence: "reactive-work", cohort, month: undefined }), label: `Review reactive work for latest PM ${cohort}` } })),
    sourceLink: { href: href({ evidence: "cohort-equipment", cohort: "all", month: undefined }), label: "Review the equipment and PM windows in the comparison" },
  };
  const trend: TrendViewModel = {
    id: "pm-reactive-cost", title: "Recorded reactive cost for PM-covered equipment", description: costDescription,
    points: [...byMonth].sort(([a], [b]) => a.localeCompare(b)).map(([month, value]) => ({ id: month, label: month, value, formattedValue: money(value), link: { href: href({ evidence: "reactive-cost", month, cohort: undefined }), label: `Review ${month} cost lines` } })),
    sourceLink: { href: href({ evidence: "reactive-cost", month: undefined, cohort: undefined }), label: "Review all supporting cost lines" },
  };
  const evidence = first(query.evidence);
  if (!evidence) return { breakdown, trend };
  const cohort = first(query.cohort) ?? "all";
  const ids = cohort === "completed" || cohort === "missed" || cohort === "all" ? cohorts[cohort] : new Set<string>();
  const month = first(query.month);
  const selectedWork = createdInPeriod.filter((work) => ids.has(work.assetId!));
  let rows: TableRowViewModel[] = [];
  let columns = [{ key: "work", label: "Work order" }, { key: "equipment", label: "Equipment / store" }, { key: "date", label: "Created" }];
  let title = "Reactive work in the PM comparison";
  const rateSummary = ids.size ? `${selectedWork.length} work orders / (${ids.size} equipment × 12 months) × 100 = ${rate(ids).toFixed(1)}.` : "No equipment in this group; a rate is unavailable.";
  let description = `${rateDescription} Selected group: latest PM ${cohort}. ${rateSummary}`;
  const equipmentCell = (work: WorkOrder) => ({ key: "equipment", value: assetById.get(work.assetId!)?.name ?? "Equipment unavailable", secondary: storeById.get(work.storeId)?.name, link: { href: `/app/equipment/${work.assetId}#equipment-review`, label: "Review equipment" } });
  if (evidence === "reactive-cost") {
    const selectedCosts = costs.filter((line) => !month || line.serviceDate.slice(0, 7) === month).sort((a, b) => b.serviceDate.localeCompare(a.serviceDate) || a.id.localeCompare(b.id));
    title = "Recorded reactive cost lines";
    description = `${costDescription} ${month ? `Selected month: ${month}. ` : ""}${selectedCosts.length} lines total ${money(selectedCosts.reduce((sum, line) => sum + line.amount.amountMinor, 0))}.`;
    columns = [{ key: "work", label: "Work order / cost" }, { key: "equipment", label: "Equipment / store" }, { key: "date", label: "Service date" }, { key: "cost", label: "Recorded work cost (USD)" }];
    rows = selectedCosts.map((line) => { const work = reactiveById.get(line.workOrderId)!; return { id: line.id, label: work.number, href: `${workHref(work)}?view=cost`, cells: [{ key: "work", value: work.number, secondary: line.description }, equipmentCell(work), { key: "date", value: line.serviceDate }, { key: "cost", value: money(line.amount.amountMinor) }] }; });
  } else if (evidence === "cohort-equipment") {
    title = "Equipment and PM windows in the comparison";
    columns = [{ key: "equipment", label: "Equipment / store" }, { key: "window", label: "Latest closed PM window" }, { key: "status", label: "Completion" }, { key: "work", label: "Reactive work in 12 months" }];
    rows = [...ids].sort().map((id) => { const asset = assetById.get(id)!; const item = latest.get(id)!; return { id, label: asset.name, href: `/app/equipment/${id}#equipment-review`, cells: [{ key: "equipment", value: asset.name, secondary: storeById.get(asset.storeId)?.name }, { key: "window", value: `${item.occurrence.windowStartsAt.slice(0, 10)} – ${item.occurrence.windowEndsAt.slice(0, 10)}`, link: { href: href({ evidence: undefined, cohort: undefined, month: undefined, occurrence: item.occurrence.id, view: "all" }), label: "Review source occurrence" } }, { key: "status", value: item.status }, { key: "work", value: String(selectedWork.filter((work) => work.assetId === id).length) }] }; });
  } else if (evidence === "reactive-work") {
    rows = selectedWork.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)).map((work) => ({ id: work.id, label: work.number, href: workHref(work), cells: [{ key: "work", value: work.number, secondary: work.problem }, equipmentCell(work), { key: "date", value: work.createdAt.slice(0, 10) }] }));
  } else {
    title = "PM evidence unavailable"; description = "This evidence view is not recognized. Return to the maintenance schedule and select a chart or status.";
  }
  const size = 30;
  const page = Math.max(1, Math.min(Math.ceil(rows.length / size) || 1, Math.floor(Number(first(query.page))) || 1));
  const pageCount = Math.max(1, Math.ceil(rows.length / size));
  const pageHref = (value: number) => href({ page: String(value) });
  const model: ProgramPageViewModel = {
    state: { kind: "ready" }, page: { title, description: "Review the exact records behind the selected chart, with the same store and PM program scope.", scopeLabel, periodLabel: month && evidence === "reactive-cost" ? `${month} · within ${period}` : period, updatedLabel: `Through ${through}`, secondaryAction: { href: returnHref, label: "Return to maintenance schedule" } },
    sourceDescription: description,
    metrics: [], breakdowns: [], trends: [], priorityActions: [],
    filters: evidence === "reactive-work" || evidence === "cohort-equipment" ? [{ id: "evidence", label: "Supporting records", options: [{ value: "reactive-work", label: `Reactive work (${selectedWork.length})`, selected: evidence === "reactive-work", href: href({ evidence: "reactive-work" }) }, { value: "cohort-equipment", label: `Equipment and PM windows (${ids.size})`, selected: evidence === "cohort-equipment", href: href({ evidence: "cohort-equipment" }) }] }] : undefined,
    table: { id: "pm-reactive-evidence", caption: title, columns, rows: rows.slice((page - 1) * size, page * size) },
    resultSummary: `${rows.length ? (page - 1) * size + 1 : 0}–${Math.min(page * size, rows.length)} of ${rows.length} records`,
    pagination: pageCount > 1 ? { summary: `Page ${page} of ${pageCount}`, currentPage: page, totalPages: pageCount, pageLinks: Array.from({ length: Math.min(5, pageCount) }, (_, index) => { const value = Math.min(Math.max(1, page - 2), Math.max(1, pageCount - 4)) + index; return { page: value, href: pageHref(value), current: page === value }; }), previousHref: page > 1 ? pageHref(page - 1) : undefined, nextHref: page < pageCount ? pageHref(page + 1) : undefined } : undefined,
  };
  return { breakdown, trend, evidence: model };
}
