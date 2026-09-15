import type { OperatorSession, PaginationViewModel, ProgramPageViewModel, TableRowViewModel, Tone } from "@/components/ops/data-contract";
import type { OpsRepository } from "@/lib/ops/repository";
import { PM_SCHEDULE_STATES, pmScheduleScope, validatePmScheduleQuery, type PmScheduleQuery, type PmScheduleState } from "@/lib/ops/pm-schedule-query";
import { pmAnalysisPeriod, type PmAnalysisPage, type PmAnalysisQuery } from "@/lib/ops/pm-analysis-query";
import { formatOperationsDate } from "@/lib/ops/local-time";
import { compactStoreLabel } from "@/lib/product/store-label";

type Query = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const SIZE = 25;
const labels: Record<PmScheduleState | "follow-up", string> = { scheduled: "Upcoming", due: "Due", overdue: "Overdue", missed: "Missed", completed: "Completed", waived: "Waived", cancelled: "Canceled", unscheduled: "Needs scheduling", "follow-up": "Follow-up" };
const tone = (status: string): Tone => status === "completed" ? "positive" : status === "missed" ? "critical" : ["due", "overdue", "unscheduled", "follow-up"].includes(status) ? "warning" : "neutral";
export function pmHref(query: Query, changes: Record<string, string | undefined> = {}) {
  const values = new URLSearchParams();
  for (const key of ["store", "region", "program", "window", "view", "status", "occurrence", "evidence", "cohort", "month", "enrollments", "enrollmentPage", "page"]) { const value = first(query[key]); if (value) values.set(key, value); }
  for (const [key, value] of Object.entries(changes)) { if (value) values.set(key, value); else values.delete(key); }
  return `/app/pm${values.size ? `?${values}` : ""}`;
}
function pageNumber(query: Query) { const number = Number(first(query.page) ?? 1); return Number.isSafeInteger(number) && number > 0 && number <= 1_000_000 ? number : 1; }
function pagination(total: number, page: number, query: Query): PaginationViewModel | undefined {
  const pages = Math.max(1, Math.ceil(total / SIZE));
  if (pages === 1 && page === 1) return undefined;
  return { summary: page <= pages ? `Page ${page} of ${pages}` : `${total} records`, currentPage: page, totalPages: pages, pageLinks: [], previousHref: page > 1 ? pmHref(query, { page: String(Math.min(page - 1, pages)) }) : undefined, nextHref: page < pages ? pmHref(query, { page: String(page + 1) }) : undefined };
}
export function parsePmScheduleQuery(params: Query, asOf: string): PmScheduleQuery {
  const status = first(params.status), window = first(params.window), requestedView = first(params.view);
  const query: PmScheduleQuery = { asOf, store: first(params.store), region: first(params.region), program: first(params.program), occurrence: first(params.occurrence),
    status: status as PmScheduleQuery["status"], window: window as PmScheduleQuery["window"], view: (requestedView ?? (status || params.occurrence || window ? "all" : "attention")) as PmScheduleQuery["view"], limit: SIZE, offset: (pageNumber(params) - 1) * SIZE };
  validatePmScheduleQuery(query); return query;
}
const rate = (work: number, equipment: number) => equipment ? work / (equipment * 12) * 100 : 0;
const money = (minor: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(minor / 100);

function analysisContext(result: PmAnalysisPage, params: Query, asOf: string) {
  const period = pmAnalysisPeriod(asOf), stats = result.summary;
  const source = (kind: string, changes: Record<string, string | undefined> = {}) => pmHref(params, { evidence: kind, status: undefined, occurrence: undefined, view: undefined, page: undefined, month: undefined, ...changes });
  const periodLabel = `${period.from.slice(0, 10)} – ${period.through}`;
  const method = `Other work has no linked PM occurrence from any program. It can include scheduled service; it is not a verified repair count. The comparison groups equipment by its latest closed PM window; waived and canceled windows are excluded. Rate = work orders created in ${periodLabel} ÷ (equipment × 12 months) × 100. Partial equipment exposure is not adjusted. Groups below 10 equipment are too small for a reliable comparison. These records do not show that PM caused or prevented a repair.`;
  const costMethod = `Recorded work cost in USD, by service date from ${periodLabel}, for equipment covered by the selected PM programs. Work linked to PM occurrences and other currencies are excluded. Unlinked scheduled service is included. Missing cost records are not measured zero cost. These records do not show that PM caused or prevented a repair.`;
  return {
    periodLabel, method, costMethod,
    breakdown: { id: "pm-effectiveness-cohorts", title: "Other work by latest PM result", description: `${periodLabel}. Work orders per 100 equipment-months (equipment × 12). Work without a PM link, including scheduled service. Waived/canceled windows are excluded.`, totalLabel: `${stats.completedEquipment + stats.missedEquipment} equipment`,
      segments: (["completed", "missed"] as const).map(cohort => { const equipment = cohort === "completed" ? stats.completedEquipment : stats.missedEquipment, work = cohort === "completed" ? stats.completedWork : stats.missedWork; return { id: cohort, label: `PM ${cohort} · ${equipment} equipment${equipment > 0 && equipment < 10 ? " · small group" : ""}`, value: rate(work, equipment), formattedValue: equipment ? `${rate(work, equipment).toFixed(1)} / 100` : "No equipment", tone: cohort === "completed" ? "positive" as const : "warning" as const, link: { href: source("reactive-work", { cohort }), label: "Review work records" } }; }),
      sourceLink: { href: source("cohort-equipment", { cohort: "all" }), label: "Review equipment and PM windows" } },
    trend: { id: "pm-reactive-cost", title: "Other work cost", description: `USD by service date · ${periodLabel}. Work linked to PM occurrences and other currencies are excluded. Missing costs are not measured zeroes.`, points: result.items.map(row => ({ id: row.id, label: row.id, value: row.amountMinor, formattedValue: money(row.amountMinor), link: { href: source("reactive-cost", { month: row.id, cohort: undefined }), label: "Review cost lines" } })), sourceLink: { href: source("reactive-cost", { cohort: undefined }), label: "Review all cost lines" } },
  };
}

export async function buildPmScheduleModel(repository: OpsRepository, session: OperatorSession, asOf: string, params: Query): Promise<ProgramPageViewModel> {
  const query = parsePmScheduleQuery(params, asOf), page = pageNumber(params);
  const stores = query.store || query.region ? await repository.searchStores(pmScheduleScope(session, query), "", { limit: 1 }) : undefined;
  const scopeLabel = query.store ? stores?.items[0] ? compactStoreLabel(`Store ${stores.items[0].storeNumber} · ${stores.items[0].name}`, session.organizationName) : "Store unavailable in this scope" : query.region ? `${stores?.items[0]?.regionName ?? "Region unavailable"} · ${stores?.totalCount ?? 0} stores` : session.scopeLabel;
  const evidence = first(params.evidence);
  if (evidence && !["reactive-cost", "reactive-work", "cohort-equipment"].includes(evidence)) throw new RangeError("Choose a valid maintenance comparison.");
  const analysisQuery: PmAnalysisQuery = { asOf, store: query.store, region: query.region, program: query.program, window: query.window, kind: (evidence ?? "months") as PmAnalysisQuery["kind"], cohort: evidence ? first(params.cohort) as PmAnalysisQuery["cohort"] : undefined, month: evidence ? first(params.month) : undefined, limit: evidence ? SIZE : 13, offset: evidence ? (page - 1) * SIZE : 0 };
  const [analysis, program] = await Promise.all([repository.listPmAnalysis(session, analysisQuery), query.program ? repository.getMaintenanceProgram(session.organizationId, query.program) : undefined]);
  const context = analysisContext(analysis, params, asOf);
  const selectedScope = query.program ? `${scopeLabel} · ${program?.name ?? "Program unavailable"}` : scopeLabel;
  const date = formatOperationsDate;
  if (evidence) {
    const cost = evidence === "reactive-cost", equipment = evidence === "cohort-equipment";
    const cohort = first(params.cohort) ?? "all", stats = analysis.summary;
    const equipmentCount = cohort === "completed" ? stats.completedEquipment : cohort === "missed" ? stats.missedEquipment : stats.completedEquipment + stats.missedEquipment;
    const workCount = cohort === "completed" ? stats.completedWork : cohort === "missed" ? stats.missedWork : stats.completedWork + stats.missedWork;
    const title = cost ? "Other work cost lines" : equipment ? "Equipment in the PM comparison" : "Other work in the PM comparison";
    const rows: TableRowViewModel[] = analysis.items.map(row => {
      const asset = { key: "asset", value: row.assetName ?? "Equipment unavailable", secondary: compactStoreLabel(`Store ${row.storeNumber} · ${row.storeName}`, session.organizationName), link: row.assetId ? { href: `/app/equipment/${encodeURIComponent(row.assetId)}`, label: "Open equipment" } : undefined };
      const href = equipment ? `/app/equipment/${encodeURIComponent(row.assetId!)}` : `/app/work-orders/${encodeURIComponent(row.workId!)}${cost ? "?view=cost" : ""}`;
      return { id: row.id, label: equipment ? row.assetName! : row.workNumber!, href, cells: equipment ? [asset,
        { key: "window", value: `${date(row.windowStartsAt!, row.timeZone)} – ${date(row.windowEndsAt!, row.timeZone)}`, link: { href: `/app/pm/occurrences/${encodeURIComponent(row.occurrenceId!)}?${new URLSearchParams({ returnTo: pmHref(params) })}`, label: "Open PM window" } },
        { key: "status", value: labels[row.status as PmScheduleState] ?? row.status! }, { key: "work", value: String(row.workCount) }]
        : [{ key: "work", value: row.workNumber!, secondary: row.description }, asset, { key: "date", value: cost ? row.date : date(row.date, row.timeZone) }, ...(cost ? [{ key: "cost", value: money(row.amountMinor) }] : [])] };
    });
    return { state: { kind: "ready" }, page: { title, description: cost ? "Recorded work cost · USD · service date" : `Latest PM: ${cohort === "all" ? "all closed windows" : cohort}`, scopeLabel: selectedScope, periodLabel: context.periodLabel, secondaryAction: { href: pmHref(params, { evidence: undefined, cohort: undefined, month: undefined, page: undefined, status: undefined, occurrence: undefined, view: "all" }), label: "Back to PM schedule" } },
      sourceDescription: cost ? `${analysis.totalCount} cost lines · ${money(analysis.totalAmountMinor)}${analysisQuery.month ? ` · ${analysisQuery.month}` : ""}` : `${workCount} work orders · ${equipmentCount} equipment · ${equipmentCount ? rate(workCount, equipmentCount).toFixed(1) : "—"} per 100 equipment-months`,
      sourceMethodology: cost ? context.costMethod : context.method,
      metrics: [], breakdowns: [], trends: [], priorityActions: [],
      filters: cost ? undefined : [{ id: "records", label: "Records", options: [ { value: "reactive-work", label: `Other work (${workCount})`, selected: !equipment, href: pmHref(params, { evidence: "reactive-work", page: undefined }) }, { value: "cohort-equipment", label: `Equipment (${equipmentCount})`, selected: equipment, href: pmHref(params, { evidence: "cohort-equipment", page: undefined }) }] }],
      table: { id: "pm-reactive-evidence", caption: title, rows, columns: equipment ? [{ key: "asset", label: "Equipment / store" }, { key: "window", label: "Latest closed PM window" }, { key: "status", label: "Completion" }, { key: "work", label: "Work in 12 months" }] : [{ key: "work", label: "Work order" }, { key: "asset", label: "Equipment / store" }, { key: "date", label: cost ? "Service date" : "Created" }, ...(cost ? [{ key: "cost", label: "Recorded work cost (USD)" }] : [])] },
      resultSummary: `${analysis.items.length ? (page - 1) * SIZE + 1 : 0}–${analysis.items.length ? (page - 1) * SIZE + analysis.items.length : 0} of ${analysis.totalCount}`, pagination: pagination(analysis.totalCount, page, params) };
  }
  const result = await repository.listPmSchedule(session, query), summary = result.summary;
  const cohortHref = (changes: Record<string, string | undefined>) => pmHref(params, { page: undefined, occurrence: undefined, ...changes });
  const rows: TableRowViewModel[] = result.items.map(row => {
    const href = `/app/pm/occurrences/${encodeURIComponent(row.id)}?${new URLSearchParams({ returnTo: pmHref(params) })}`;
    return { id: row.id, label: row.planName, href, cells: [
      { key: "plan", value: row.planName, secondary: row.assetName ?? "Store maintenance" },
      { key: "store", value: compactStoreLabel(`Store ${row.storeNumber} · ${row.storeName}`, session.organizationName), link: { href: `/app/stores/${encodeURIComponent(row.storeId)}`, label: "Open store" } },
      { key: "window", value: `Due ${date(row.dueAt, row.timeZone)}`, secondary: `${date(row.windowStartsAt, row.timeZone)} – ${date(row.windowEndsAt, row.timeZone)}` },
      { key: "work", value: row.workNumber ?? (row.hasWorkReference ? "Unavailable" : row.importedHistory ? "Imported history" : "No work order"), link: row.workId ? { href: `/app/work-orders/${encodeURIComponent(row.workId)}`, label: "Open work order" } : undefined },
      { key: "visit", value: row.visitCount ? `${row.visitCount} visit${row.visitCount === 1 ? "" : "s"}` : row.importedHistory ? "Imported history" : "None recorded", link: { href: `${href}#visit-evidence`, label: "Review visit evidence" } },
      { key: "status", value: labels[row.status], secondary: row.followUpCount ? `${row.followUpCount} open follow-up${row.followUpCount === 1 ? "" : "s"}` : undefined, tone: tone(row.status) },
    ] };
  });
  const statusMetrics = [...PM_SCHEDULE_STATES, "follow-up" as const].map(state => ({ id: state, label: labels[state], selected: query.status === state, value: String(state === "follow-up" ? summary.followUp : summary.states[state]), supportingText: "", tone: tone(state), link: { href: cohortHref({ status: state, view: "all" }), label: `Review ${labels[state].toLowerCase()}` } }));
  return { state: { kind: "ready" }, page: { title: "Preventive maintenance", description: "Review due work and upcoming maintenance.", scopeLabel: selectedScope, periodLabel: query.window ? "Closed windows · waived and canceled excluded" : "All recorded maintenance windows", updatedLabel: `As of ${date(asOf)}` },
    metrics: statusMetrics, priorityActions: [], sourceDescription: "Earliest due first.", clearFiltersHref: query.store || query.region || query.program || query.status || query.occurrence || query.window ? "/app/pm" : undefined,
    filters: [{ id: "view", label: "Show", options: [{ value: "attention", label: `Needs attention (${summary.attention})`, selected: query.view === "attention", href: cohortHref({ view: "attention", status: undefined }) }, { value: "upcoming", label: `Upcoming & due (${summary.upcoming})`, selected: query.view === "upcoming", href: cohortHref({ view: "upcoming", status: undefined }) }, { value: "all", label: `All (${summary.all})`, selected: query.view === "all" && !query.status, href: cohortHref({ view: "all", status: undefined }) }] },
      { id: "window", label: "Window", options: [{ value: "all", label: "All windows", selected: !query.window, href: cohortHref({ window: undefined }) }, { value: "closed", label: "Closed windows", selected: Boolean(query.window), href: cohortHref({ window: "closed", view: "all", status: undefined }) }] }],
    breakdowns: [{ id: "pm-compliance", title: "Closed windows completed", totalLabel: summary.closedEligible ? `${Math.round(summary.closedCompleted / summary.closedEligible * 100)}%` : "No eligible windows", description: `${summary.closedCompleted} completed / ${summary.closedEligible} closed windows. Waived, canceled and still-open windows are excluded. Late completions count as completed; timing is shown on each record.`,
      segments: [{ id: "completed", label: "Completed", value: summary.closedCompleted, formattedValue: String(summary.closedCompleted), link: { href: cohortHref({ window: "closed", status: "completed", view: "all" }), label: "Review completed windows" } }, { id: "missed", label: "Missed", value: summary.closedEligible - summary.closedCompleted, formattedValue: String(summary.closedEligible - summary.closedCompleted), link: { href: cohortHref({ window: "closed", status: "missed", view: "all" }), label: "Review missed windows" } }], sourceLink: { href: cohortHref({ window: "closed", status: undefined, view: "all" }), label: "Review all eligible windows" } }, context.breakdown], trends: [context.trend],
    table: { id: "pm-occurrences", caption: query.status ? labels[query.status] : query.view === "attention" ? "Maintenance needing attention" : "Maintenance schedule", rows, columns: [{ key: "plan", label: "Plan / equipment" }, { key: "store", label: "Store" }, { key: "window", label: "Due / window" }, { key: "work", label: "Work order" }, { key: "visit", label: "Visit evidence" }, { key: "status", label: "Status" }] },
    resultSummary: `${rows.length ? (page - 1) * SIZE + 1 : 0}–${rows.length ? (page - 1) * SIZE + rows.length : 0} of ${result.totalCount}`, pagination: pagination(result.totalCount, page, params) };
}
