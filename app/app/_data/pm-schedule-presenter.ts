import { cachedNumberFormat } from "@/lib/ops/intl-format-cache";
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
  for (const key of ["store", "region", "program", "window", "view", "status", "occurrence", "evidence", "cohort", "month", "enrollments", "enrollmentPage", "page", "setup", "setupFilter", "setupPage", "programPage", "asset", "reviewSource", "pmReview", "reviewMissing", "reviewPage"]) { const value = first(query[key]); if (value) values.set(key, value); }
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
/** Other jobs (mostly repairs) per machine over the 12 months. */
const perMachine = (work: number, equipment: number) => equipment ? work / equipment : 0;
const perMachineLabel = (work: number, equipment: number) => equipment ? `${perMachine(work, equipment).toFixed(1)} repairs per machine a year` : "No machines";
const money = (minor: number) => cachedNumberFormat("en-US", { style: "currency", currency: "USD" }).format(minor / 100);

function analysisContext(result: PmAnalysisPage, params: Query, asOf: string) {
  const period = pmAnalysisPeriod(asOf), stats = result.summary;
  const source = (kind: string, changes: Record<string, string | undefined> = {}) => pmHref(params, { evidence: kind, status: undefined, occurrence: undefined, view: undefined, page: undefined, month: undefined, ...changes });
  const periodLabel = `${period.from.slice(0, 10)} – ${period.through}`;
  const method = `Machines are grouped by whether their most recent maintenance (due date passed) was done or missed; skipped and canceled maintenance is left out. "Repairs" are any other jobs on the machine opened ${periodLabel}, which can include some scheduled service. Groups under 10 machines are too small to compare. This shows a pattern, not proof that maintenance caused or prevented a repair.`;
  const costMethod = `Recorded cost (USD) of jobs that were not the maintenance itself, by service date, ${periodLabel}, for machines on the selected maintenance plans. Months without cost records are not counted as $0. This shows a pattern, not proof that maintenance caused or prevented a repair.`;
  return {
    periodLabel, method, costMethod,
    breakdown: { id: "pm-effectiveness-cohorts", title: "Repairs when maintenance is done vs. missed", description: `Last 12 months. Machines grouped by whether their last maintenance was done or missed. A pattern, not proof.`, totalLabel: `${stats.completedEquipment + stats.missedEquipment} machines`,
      segments: (["completed", "missed"] as const).map(cohort => { const equipment = cohort === "completed" ? stats.completedEquipment : stats.missedEquipment, work = cohort === "completed" ? stats.completedWork : stats.missedWork; return { id: cohort, label: `Maintenance ${cohort === "completed" ? "done" : "missed"} · ${equipment} machines${equipment > 0 && equipment < 10 ? " · too few to compare" : ""}`, value: perMachine(work, equipment), formattedValue: perMachineLabel(work, equipment), tone: cohort === "completed" ? "positive" as const : "warning" as const, link: { href: source("reactive-work", { cohort }), label: "Review work records" } }; }),
      sourceLink: { href: source("cohort-equipment", { cohort: "all" }), label: "See the machines" } },
    trend: { id: "pm-reactive-cost", title: "Repair spending on maintained equipment", description: `Last 12 months, by month. Cost of jobs that weren't the maintenance itself. Months with no cost records aren't counted as $0.`, points: result.items.map(row => ({ id: row.id, label: row.id, value: row.amountMinor, formattedValue: money(row.amountMinor), link: { href: source("reactive-cost", { month: row.id, cohort: undefined }), label: "See the costs" } })), sourceLink: { href: source("reactive-cost", { cohort: undefined }), label: "Review all cost lines" } },
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
    const title = cost ? "Repair costs on maintained equipment" : equipment ? "Machines in the comparison" : "Repairs on maintained equipment";
    const rows: TableRowViewModel[] = analysis.items.map(row => {
      const asset = { key: "asset", value: row.assetName ?? "Equipment unavailable", secondary: compactStoreLabel(`Store ${row.storeNumber} · ${row.storeName}`, session.organizationName), link: row.assetId ? { href: `/app/equipment/${encodeURIComponent(row.assetId)}`, label: "Open equipment" } : undefined };
      const href = equipment ? `/app/equipment/${encodeURIComponent(row.assetId!)}` : `/app/work-orders/${encodeURIComponent(row.workId!)}${cost ? "?view=cost" : ""}`;
      return { id: row.id, label: equipment ? row.assetName! : row.workNumber!, href, cells: equipment ? [asset,
        { key: "window", value: `${date(row.windowStartsAt!, row.timeZone)} – ${date(row.windowEndsAt!, row.timeZone)}`, link: { href: `/app/pm/occurrences/${encodeURIComponent(row.occurrenceId!)}?${new URLSearchParams({ returnTo: pmHref(params) })}`, label: "Open this maintenance" } },
        { key: "status", value: labels[row.status as PmScheduleState] ?? row.status! }, { key: "work", value: String(row.workCount) }]
        : [{ key: "work", value: row.workNumber!, secondary: row.description }, asset, { key: "date", value: cost ? row.date : date(row.date, row.timeZone) }, ...(cost ? [{ key: "cost", value: money(row.amountMinor) }] : [])] };
    });
    return { state: { kind: "ready" }, page: { title, description: cost ? "Recorded cost · USD · by service date" : `Last maintenance: ${cohort === "all" ? "done or missed" : cohort === "completed" ? "done" : "missed"}`, scopeLabel: selectedScope, periodLabel: context.periodLabel, secondaryAction: { href: pmHref(params, { evidence: undefined, cohort: undefined, month: undefined, page: undefined, status: undefined, occurrence: undefined, view: "all" }), label: "Back to PM schedule" } },
      sourceDescription: cost ? `${analysis.totalCount} costs · ${money(analysis.totalAmountMinor)}${analysisQuery.month ? ` · ${analysisQuery.month}` : ""}` : `${workCount} repairs on ${equipmentCount} machines · ${equipmentCount ? perMachineLabel(workCount, equipmentCount) : "—"}`,
      sourceMethodology: cost ? context.costMethod : context.method,
      metrics: [], breakdowns: [], trends: [], priorityActions: [],
      filters: cost ? undefined : [{ id: "records", label: "Records", options: [ { value: "reactive-work", label: `Repairs (${workCount})`, selected: !equipment, href: pmHref(params, { evidence: "reactive-work", page: undefined }) }, { value: "cohort-equipment", label: `Machines (${equipmentCount})`, selected: equipment, href: pmHref(params, { evidence: "cohort-equipment", page: undefined }) }] }],
      table: { id: "pm-reactive-evidence", caption: title, rows, columns: equipment ? [{ key: "asset", label: "Machine / store" }, { key: "window", label: "Last maintenance due" }, { key: "status", label: "Done?" }, { key: "work", label: "Repairs in 12 months" }] : [{ key: "work", label: "Job" }, { key: "asset", label: "Machine / store" }, { key: "date", label: cost ? "Service date" : "Opened" }, ...(cost ? [{ key: "cost", label: "Recorded cost (USD)" }] : [])] },
      resultSummary: `${analysis.items.length ? (page - 1) * SIZE + 1 : 0}–${analysis.items.length ? (page - 1) * SIZE + analysis.items.length : 0} of ${analysis.totalCount}`, pagination: pagination(analysis.totalCount, page, params) };
  }
  const result = await repository.listPmSchedule(session, query), summary = result.summary;
  const cohortHref = (changes: Record<string, string | undefined>) => pmHref(params, { page: undefined, occurrence: undefined, ...changes });
  const rows: TableRowViewModel[] = result.items.map(row => {
    const href = `/app/pm/occurrences/${encodeURIComponent(row.id)}?${new URLSearchParams({ returnTo: pmHref(params) })}`;
    return { id: row.id, label: row.planName, href, cells: [
      { key: "plan", value: row.planName, secondary: row.assetName ?? "Store maintenance" },
      { key: "store", value: compactStoreLabel(`Store ${row.storeNumber} · ${row.storeName}`, session.organizationName), link: { href: `/app/stores/${encodeURIComponent(row.storeId)}`, label: "Open store" } },
      { key: "window", value: date(row.dueAt, row.timeZone), secondary: `Can be done ${date(row.windowStartsAt, row.timeZone)} – ${date(row.windowEndsAt, row.timeZone)}` },
      { key: "work", value: row.workNumber ?? (row.hasWorkReference ? "Unavailable" : row.importedHistory ? "Imported history" : "No work order"), link: row.workId ? { href: `/app/work-orders/${encodeURIComponent(row.workId)}`, label: "Open work order" } : undefined },
      { key: "visit", value: row.visitCount ? `${row.visitCount} visit${row.visitCount === 1 ? "" : "s"}` : row.importedHistory ? "Imported history" : "None recorded", link: { href: `${href}#visit-evidence`, label: "See visits" } },
      { key: "status", value: labels[row.status], secondary: row.followUpCount ? `${row.followUpCount} open follow-up${row.followUpCount === 1 ? "" : "s"}` : undefined, tone: tone(row.status) },
    ] };
  });
  const statusMetrics = [...PM_SCHEDULE_STATES, "follow-up" as const].map(state => ({ id: state, label: state === "completed" ? "Done" : labels[state], selected: query.status === state, value: String(state === "follow-up" ? summary.followUp : summary.states[state]), supportingText: "", tone: tone(state), link: { href: cohortHref({ status: state, view: "all" }), label: `Review ${labels[state].toLowerCase()}` } }));
  return { state: { kind: "ready" }, page: { title: "Preventive maintenance", description: "Review due work and upcoming maintenance.", scopeLabel: selectedScope, periodLabel: query.window ? "Due date passed · skipped and canceled left out" : "All scheduled maintenance", updatedLabel: `As of ${date(asOf)}` },
    metrics: [{id:"pm-completion-rate",label:"Maintenance done",value:summary.closedEligible ? `${Math.round(summary.closedCompleted/summary.closedEligible*100)}%` : "Nothing due yet",supportingText:`${summary.closedCompleted} of ${summary.closedEligible} done, of maintenance already past its due date`,tone:"neutral",link:{href:cohortHref({window:"closed",status:undefined,view:"all"}),label:"See what was counted"}}, ...statusMetrics], priorityActions: [], sourceDescription: "Earliest due first.", clearFiltersHref: query.store || query.region || query.program || query.status || query.occurrence || query.window ? "/app/pm" : undefined,
    filters: [{ id: "view", label: "Show", options: [{ value: "attention", label: `Needs attention (${summary.attention})`, selected: query.view === "attention", href: cohortHref({ view: "attention", status: undefined }) }, { value: "upcoming", label: `Upcoming & due (${summary.upcoming})`, selected: query.view === "upcoming", href: cohortHref({ view: "upcoming", status: undefined }) }, { value: "all", label: `All (${summary.all})`, selected: query.view === "all" && !query.status, href: cohortHref({ view: "all", status: undefined }) }] },
      { id: "window", label: "Dates", options: [{ value: "all", label: "All", selected: !query.window, href: cohortHref({ window: undefined }) }, { value: "closed", label: "Due date passed", selected: Boolean(query.window), href: cohortHref({ window: "closed", view: "all", status: undefined }) }] }],
    breakdowns: [{ id: "pm-compliance", title: "Maintenance done", totalLabel: summary.closedEligible ? `${Math.round(summary.closedCompleted / summary.closedEligible * 100)}%` : "Nothing due yet", description: `${summary.closedCompleted} of ${summary.closedEligible} done, of maintenance already past its due date. Done late still counts as done. Skipped or canceled maintenance is left out.`,
      segments: [{ id: "completed", label: "Done", value: summary.closedCompleted, formattedValue: String(summary.closedCompleted), link: { href: cohortHref({ window: "closed", status: "completed", view: "all" }), label: "See what was done" } }, { id: "missed", label: "Missed", value: summary.closedEligible - summary.closedCompleted, formattedValue: String(summary.closedEligible - summary.closedCompleted), link: { href: cohortHref({ window: "closed", status: "missed", view: "all" }), label: "See what was missed" } }], sourceLink: { href: cohortHref({ window: "closed", status: undefined, view: "all" }), label: `See all ${summary.closedEligible}` } }, context.breakdown], trends: [context.trend],
    table: { id: "pm-occurrences", caption: query.status ? labels[query.status] : query.view === "attention" ? "Maintenance needing attention" : "Maintenance schedule", rows, columns: [{ key: "plan", label: "Plan / equipment" }, { key: "store", label: "Store" }, { key: "window", label: "Due" }, { key: "work", label: "Job" }, { key: "visit", label: "Visits" }, { key: "status", label: "Status" }] },
    resultSummary: `${rows.length ? (page - 1) * SIZE + 1 : 0}–${rows.length ? (page - 1) * SIZE + rows.length : 0} of ${result.totalCount}`, pagination: pagination(result.totalCount, page, params) };
}
