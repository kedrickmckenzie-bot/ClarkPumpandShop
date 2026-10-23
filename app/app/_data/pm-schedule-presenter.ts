import { cachedNumberFormat } from "@/lib/ops/intl-format-cache";
import type { OperatorSession, PaginationViewModel, PmBoardRowViewModel, PmSlipRowViewModel, ProgramPageViewModel, TableRowViewModel, Tone } from "@/components/ops/data-contract";
import { roleCanOpenOperatorHref } from "@/components/ops/role-policy";
import type { OpsRepository } from "@/lib/ops/repository";
import { PM_RECENT_DAYS, pmScheduleScope, validatePmScheduleQuery, type PmScheduleQuery, type PmScheduleState } from "@/lib/ops/pm-schedule-query";
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
  for (const key of ["store", "region", "program", "window", "view", "status", "assignee", "occurrence", "evidence", "cohort", "month", "enrollments", "enrollmentPage", "page", "setup", "setupFilter", "setupPage", "programPage", "asset", "reviewSource", "pmReview", "reviewMissing", "reviewPage"]) { const value = first(query[key]); if (value) values.set(key, value); }
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
  const query: PmScheduleQuery = { asOf, store: first(params.store), region: first(params.region), program: first(params.program), occurrence: first(params.occurrence), assignee: first(params.assignee),
    status: status as PmScheduleQuery["status"], window: window as PmScheduleQuery["window"], view: (requestedView ?? (status || params.occurrence || window ? "all" : "now")) as PmScheduleQuery["view"], limit: SIZE, offset: (pageNumber(params) - 1) * SIZE };
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
      sourceLink: { href: source("cohort-equipment", { cohort: "all" }), label: "See the machines" } }
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
  const result = await repository.listPmSchedule(session, { ...query, breakdown: true }), summary = result.summary;
  const listHref = (changes: Record<string, string | undefined>) => pmHref(params, { page: undefined, occurrence: undefined, view: undefined, status: undefined, window: undefined, assignee: undefined, ...changes });
  const storeLabel = (number: string, name: string) => compactStoreLabel(`Store ${number} · ${name}`, session.organizationName);
  const DAY = 86_400_000;
  const days = (ms: number) => Math.max(1, Math.round(ms / DAY));
  const timing = (status: PmScheduleState, dueAt: string) => {
    const gap = Date.parse(dueAt) - Date.parse(asOf);
    if (status === "unscheduled") return "Needs a date";
    if (status === "overdue" || status === "missed") return `${days(-gap)} day${days(-gap) === 1 ? "" : "s"} late`;
    if (status === "due" || status === "scheduled") return gap < DAY ? "Due today" : `Due in ${days(gap)} day${days(gap) === 1 ? "" : "s"}`;
    return undefined;
  };
  const open = (status: PmScheduleState) => ["scheduled", "due", "overdue", "unscheduled"].includes(status);
  const boardRows: PmBoardRowViewModel[] = result.items.map(row => {
    const href = `/app/pm/occurrences/${encodeURIComponent(row.id)}?${new URLSearchParams({ returnTo: pmHref(params) })}`;
    const workHref = row.workId ? `/app/work-orders/${encodeURIComponent(row.workId)}` : undefined;
    const createHref = `/app/work-orders/new?pmOccurrence=${encodeURIComponent(row.id)}`;
    // One next step per row: give it a date, get a job made, get someone on the job, or just open it.
    const action = !open(row.status) ? { label: "Open", href, primary: false }
      : row.status === "unscheduled" ? { label: "Schedule", href, primary: true }
      : !row.hasWorkReference && ["due", "overdue"].includes(row.status) && roleCanOpenOperatorHref(session.role, createHref) ? { label: "Create job", href: createHref, primary: true }
      : workHref && !row.assigneeName && ["due", "overdue"].includes(row.status) ? { label: "Assign", href: workHref, primary: true }
      : { label: "Open", href: workHref ?? href, primary: false };
    return { id: row.id, title: row.planName, equipment: row.assetName, storeLabel: storeLabel(row.storeNumber, row.storeName), storeHref: `/app/stores/${encodeURIComponent(row.storeId)}`,
      dueLabel: date(row.dueAt, row.timeZone), timingLabel: timing(row.status, row.dueAt), late: row.status === "overdue" || row.status === "missed",
      who: row.assigneeName ?? (row.importedHistory ? "Imported history" : open(row.status) ? undefined : row.workNumber ? undefined : "—"),
      statusLabel: labels[row.status], tone: tone(row.status), href, action };
  });
  const rows: TableRowViewModel[] = boardRows.map(row => ({ id: row.id, label: row.title, href: row.href, cells: [
    { key: "plan", value: row.title, secondary: row.equipment ?? "Store maintenance" },
    { key: "store", value: row.storeLabel, link: { href: row.storeHref, label: "Open store" } },
    { key: "window", value: row.dueLabel, secondary: row.timingLabel },
    { key: "who", value: row.who ?? "Not assigned" },
    { key: "status", value: row.statusLabel, tone: row.tone },
  ] }));
  const pct = (done: number, total: number) => total ? `${Math.round(done / total * 100)}%` : "—";
  const recentView = query.view === "recent";
  const metrics = [
    { id: "overdue", label: "Overdue", value: String(summary.states.overdue), supportingText: "Past the due date, still not done", tone: summary.states.overdue ? "critical" as const : "neutral" as const, selected: query.status === "overdue", link: { href: listHref({ status: "overdue", view: "all" }), label: "See overdue" } },
    { id: "week", label: "Due this week", value: String(summary.dueThisWeek), supportingText: "Due in the next 7 days", tone: "neutral" as const, selected: query.view === "week", link: { href: listHref({ view: "week" }), label: "See this week" } },
    { id: "unscheduled", label: "Needs a date", value: String(summary.states.unscheduled), supportingText: "Nobody has set a date yet", tone: summary.states.unscheduled ? "warning" as const : "neutral" as const, selected: query.status === "unscheduled", link: { href: listHref({ status: "unscheduled", view: "all" }), label: "See what needs a date" } },
    { id: "completed", label: `Done · last ${PM_RECENT_DAYS} days`, value: pct(summary.recentCompleted, summary.recentEligible), supportingText: summary.recentEligible ? `${summary.recentCompleted} of ${summary.recentEligible} that came due` : "Nothing came due", tone: "neutral" as const, selected: recentView || query.status === "completed", link: { href: listHref({ view: "recent" }), label: "See what was counted" } },
  ];
  const nowCount = summary.states.due + summary.states.overdue + summary.states.unscheduled;
  const tabs = [
    { value: "now", label: `Needs attention (${nowCount})`, selected: query.view === "now" && !query.status && !query.assignee, href: listHref({ view: "now" }) },
    { value: "scheduled", label: `Coming up (${summary.states.scheduled})`, selected: query.status === "scheduled", href: listHref({ status: "scheduled", view: "all" }) },
    { value: "completed", label: `Done (${summary.states.completed})`, selected: query.status === "completed", href: listHref({ status: "completed", view: "all" }) },
    { value: "missed", label: `Missed (${summary.states.missed})`, selected: query.status === "missed", href: listHref({ status: "missed", view: "all" }) },
  ];
  const assigneeLabel = query.assignee ? result.breakdown?.vendors.find(row => row.key === query.assignee)?.label ?? "Selected" : undefined;
  const listTitle = query.assignee ? `${assigneeLabel} · last ${PM_RECENT_DAYS} days` : recentView ? `Came due · last ${PM_RECENT_DAYS} days`
    : query.view === "week" ? "Due this week" : query.status ? (query.status === "unscheduled" ? "Needs a date" : query.status === "completed" ? "Done" : labels[query.status])
    : query.view === "now" ? "Needs attention" : "All maintenance";
  const slip = (row: { key: string; label: string; eligible: number; completed: number }, changes: Record<string, string>): PmSlipRowViewModel => ({
    id: row.key, label: row.label, rateLabel: pct(row.completed, row.eligible), detail: `${row.completed} of ${row.eligible}`, missed: row.eligible - row.completed, href: listHref({ view: "recent", ...changes }) });
  const breakdown = result.breakdown ?? { stores: [], vendors: [] };
  return { state: { kind: "ready" }, page: { title: "Preventive maintenance", description: "What's due, who's doing it, and who's falling behind.", scopeLabel: selectedScope, updatedLabel: `As of ${date(asOf)}` },
    metrics, priorityActions: [], sourceDescription: query.status === "completed" || query.status === "missed" || recentView ? "Newest first." : "Soonest first.",
    clearFiltersHref: query.store || query.region || query.program || query.occurrence || query.assignee ? "/app/pm" : undefined,
    filters: [{ id: "view", label: "Show", options: tabs }],
    breakdowns: [], trends: [],
    table: { id: "pm-occurrences", caption: listTitle, rows, columns: [{ key: "plan", label: "Maintenance" }, { key: "store", label: "Store" }, { key: "window", label: "Due" }, { key: "who", label: "Who's doing it" }, { key: "status", label: "Status" }] },
    pmBoard: {
      rows: boardRows, listTitle,
      emptyLabel: query.view === "now" && !query.status ? "Nothing needs attention. Everything due has a date and is on track." : "Nothing here.",
      slipping: { periodLabel: `Maintenance due in the last ${PM_RECENT_DAYS} days`,
        stores: breakdown.stores.filter(row => !query.store || row.key === query.store).slice(0, 5).map(row => slip(row, { store: row.key })),
        vendors: breakdown.vendors.slice(0, 6).map(row => slip(row, { assignee: row.key })),
        allStoresHref: listHref({ view: "recent" }) },
      comparison: context.breakdown,
    },
    resultSummary: `${rows.length ? (page - 1) * SIZE + 1 : 0}–${rows.length ? (page - 1) * SIZE + rows.length : 0} of ${result.totalCount}`, pagination: pagination(result.totalCount, page, params) };
}
