import type { OperatorSession } from "@/components/ops/data-contract";
import type { OpsRepository } from "@/lib/ops/repository";
import { formatOperationsDate } from "@/lib/ops/local-time";
import { cachedNumberFormat } from "@/lib/ops/intl-format-cache";
import { dispatchStatuses } from "@/lib/server/dispatch-board-page";
import { historyLength, isPeriod, scorecardWindowAt, tradeLabel, type ScorecardPeriod, type ScorecardWindow } from "@/lib/ops/vendor-scorecard";
import {
  TEAM_MEASURES, TEAM_MEASURE_INFO, TEAM_SMALL_SAMPLE, FLAG_GAP, FLAG_SAMPLE, inTeamWindow, isTeamMeasure, outsideTheirControl, plannedDayResult, returnReason,
  summarizeTeam, teamFlags, teamJobResult, teamRows,
  type TeamMeasureKey, type TeamMeasureSummary, type TeamScoreRow, type TechJobFact,
} from "@/lib/ops/team-scorecard";
import { PERIOD_LABELS, hoursLabel, periodLabel } from "./vendor-scorecard-presenter";

type Query = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

/** Facilities (including the field maintenance manager), district managers and the owner. Never technicians or store managers. */
export function canViewTeamScorecard(session: Pick<OperatorSession, "role">) {
  return ["executive", "facilities", "regional"].includes(session.role);
}

export interface TeamCell { measure: TeamMeasureKey; value: string; detail: string; summary: TeamMeasureSummary; href: string; empty: boolean; trendLabel?: string; compare?: string }
export interface TeamRow { key: string; label: string; sublabel?: string; href?: string; total?: boolean; cells: TeamCell[] }
export type TeamDrillPlacement = "techs" | "summary" | "history" | "trade";
export interface TeamDrill {
  placement: TeamDrillPlacement; context: string; measure: TeamMeasureKey; measureLabel: string; definition: string; headline: string; closeHref: string;
  rows: Array<{ workOrderId: string; number: string; problem: string; store: string; sent: string; result: string; tone: "good" | "bad" | "neutral"; tags: string[];
    repeat?: { did?: string; nextId: string; nextNumber: string; nextProblem: string; daysLater: number; tags: string[] } }>;
  page?: { label: string; previousHref?: string; nextHref?: string };
}
export interface TeamFlagGroup { techId: string; techName: string; href: string; items: Array<{ label: string; text: string; href: string }> }
export interface TechCard {
  id: string; name: string; backHref: string; dispatchHref: string; jobs: number; openNow?: number;
  summary: TeamCell[];
  history: { columns: Array<{ label: string; current: boolean }>; rows: Array<{ measure: TeamMeasureKey; label: string; cells: Array<{ value: string; detail: string; href: string; quiet: boolean }> }> };
  byTrade: TeamRow[];
}
export interface TeamScorecardModel {
  view: "team" | "tech";
  scopeLabel: string; periodLabel: string; priorLabel: string; period: ScorecardPeriod;
  periods: Array<{ value: ScorecardPeriod; label: string; href: string; selected: boolean }>;
  regions: Array<{ value: string; label: string }>; region?: string; regionBase: string;
  trades: Array<{ value: string; label: string; jobs: number; href: string; selected: boolean }>; allTradesHref: string; trade?: string;
  totals: { techs: number; jobs: number };
  flags: TeamFlagGroup[];
  rows: TeamRow[];
  tech?: TechCard;
  drill?: TeamDrill;
  definitions: Array<{ label: string; definition: string }>;
  smallSample: number; flagSample: number; flagGap: number;
}

const percent = (value: number) => `${Math.round(value * 100)}%`;
const count = (n: number) => cachedNumberFormat("en-US").format(n);

function formatValue(key: TeamMeasureKey, value: number) {
  return key === "finish" ? hoursLabel(value) : key === "jobs" ? count(value) : percent(value);
}

function cellFor(summary: TeamMeasureSummary, href: string, team?: TeamMeasureSummary): TeamCell {
  const key = summary.key;
  const empty = summary.counted === 0 || summary.value === undefined;
  const value = empty || summary.tooFew ? "—" : formatValue(key, summary.value!);
  const detail = empty ? summary.emptyReason ?? "No data yet"
    : summary.tooFew ? `Only ${summary.counted} ${summary.counted === 1 ? "job" : "jobs"} so far · need ${TEAM_SMALL_SAMPLE}`
    : key === "jobs" ? "assigned"
    : key === "finish" ? `${summary.counted} finished`
    : `${summary.hits} of ${summary.counted}`;
  const trendLabel = summary.trend && summary.priorValue !== undefined ? `${summary.trend === "better" ? "Better" : "Worse"} than the previous period (was ${formatValue(key, summary.priorValue)})` : undefined;
  const compare = team && key !== "jobs" && team.value !== undefined && !team.tooFew ? `Team: ${formatValue(key, team.value)}` : undefined;
  return { measure: key, value, detail, summary, href, empty, trendLabel, compare };
}

const civil = (day?: string) => day ? formatOperationsDate(day) : "";
function drillResult(fact: TechJobFact, measure: TeamMeasureKey, now: string): { result: string; tone: "good" | "bad" | "neutral"; counted: boolean } {
  const r = teamJobResult(fact, measure, now);
  if (!r.counted) return { result: "", tone: "neutral", counted: false };
  switch (measure) {
    case "jobs": return { result: fact.firstCompletedAt ? `Done ${formatOperationsDate(fact.firstCompletedAt)}` : fact.firstOutcome ? "Worked on, not finished" : "Not started", tone: "neutral", counted: true };
    case "finish": return { result: hoursLabel(r.value!), tone: "neutral", counted: true };
    case "plannedDay": {
      const p = plannedDayResult(fact, now);
      return { result: p.hit ? `Visited ${civil(p.doneDay)} · planned ${civil(p.day)}` : p.doneDay ? `Late: visited ${civil(p.doneDay)} · planned ${civil(p.day)}` : `No visit yet · planned ${civil(p.day)}`, tone: p.hit ? "good" : "bad", counted: true };
    }
    case "firstFix": return { result: r.hit ? "Fixed first visit" : `Another trip · ${returnReason(fact)}`, tone: r.hit ? "good" : "bad", counted: true };
    case "callbacks": return { result: r.hit ? "Repaired again within 30 days" : "No repair within 30 days", tone: r.hit ? "bad" : "good", counted: true };
  }
}

/** Two busiest types of work, the rest counted. */
function tradeSummary(facts: TechJobFact[]) {
  const counts = new Map<string, number>();
  for (const fact of facts) if (fact.trade !== "unclassified") counts.set(fact.trade, (counts.get(fact.trade) ?? 0) + 1);
  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([key]) => tradeLabel(key));
  return ordered.length > 2 ? `${ordered.slice(0, 2).join(" · ")} · +${ordered.length - 2} more` : ordered.join(" · ") || undefined;
}

export async function buildTeamScorecardPage(repository: OpsRepository, session: OperatorSession, query: Query, now: string): Promise<TeamScorecardModel> {
  const requested = Number(first(query.period));
  const period: ScorecardPeriod = isPeriod(requested) ? requested : 90;
  const baseScope = { organizationId: session.organizationId, storeIds: session.storeIds, regionIds: session.regionIds };
  const regions = (await repository.getCapitalFilters(baseScope)).regions.map(r => ({ value: r.id, label: r.label }));
  const requestedRegion = first(query.region);
  const region = regions.some(r => r.value === requestedRegion) ? requestedRegion : undefined;
  const scope = region ? { ...baseScope, regionIds: [region] } : baseScope;
  const requestedTech = first(query.tech);

  // The whole team is always read for the current and previous period, so flags and "Team" comparisons
  // use the same rows the table shows; one technician's page also reads their longer history.
  const depth = requestedTech ? historyLength(period) : 2;
  const windows = Array.from({ length: depth }, (_, back) => scorecardWindowAt(now, period, back));
  const [current, prior] = [windows[0]!, windows[1]!];
  const [teamFacts, history] = await Promise.all([
    repository.listTechJobFacts(scope, { from: prior.from, to: current.to }),
    requestedTech && depth > 2 ? repository.listTechJobFacts(scope, { from: windows.at(-1)!.from, to: current.to, techId: requestedTech }) : Promise.resolve(undefined),
  ]);
  const at = (list: TechJobFact[], window: ScorecardWindow) => list.filter(f => inTeamWindow(f, window));
  const currentFacts = at(teamFacts, current), priorFacts = at(teamFacts, prior);
  const membership = requestedTech ? await repository.getMembership(session.organizationId, requestedTech) : null;
  const techUser = membership?.role === "internal_technician" ? await repository.getUserInOrganization(session.organizationId, membership.userId) : null;
  const techId = techUser ? requestedTech : undefined;
  const techName = techUser?.displayName;

  const tradeKeys = [...new Set(currentFacts.map(f => f.trade))];
  const requestedTrade = first(query.trade);
  const trade = !techId && tradeKeys.includes(requestedTrade ?? "") ? requestedTrade : undefined;
  const href = (changes: Record<string, string | undefined>, hash = "") => {
    const values = { period: String(period), region, trade, tech: techId, ...changes };
    const search = new URLSearchParams(Object.entries(values).filter((entry): entry is [string, string] => Boolean(entry[1]) && !(entry[0] === "period" && entry[1] === "90")));
    return `/app/dispatch/team${search.size ? `?${search}` : ""}${hash}`;
  };
  const drillLink = (measure: TeamMeasureKey, extra: Record<string, string | undefined>) => href({ measure, ...extra }, "#scorecard-jobs");
  const cells = (measures: Record<TeamMeasureKey, TeamMeasureSummary>, link: (measure: TeamMeasureKey) => string, team?: Record<TeamMeasureKey, TeamMeasureSummary>) =>
    TEAM_MEASURES.map(key => cellFor(measures[key], link(key), team?.[key]));
  const techHref = (id: string) => href({ tech: id, trade: undefined });

  // Worth a look: grouped by technician, each line opening the jobs behind it.
  const flagGroups = new Map<string, TeamFlagGroup>();
  for (const flag of teamFlags(currentFacts, priorFacts, now)) {
    if (techId && flag.techId !== techId) continue;
    const group = flagGroups.get(flag.techId) ?? { techId: flag.techId, techName: flag.techName, href: techHref(flag.techId), items: [] };
    group.items.push({ label: tradeLabel(flag.trade), text: flag.text,
      href: techId ? drillLink(flag.measure, { slice: `trade:${flag.trade}` }) : drillLink(flag.measure, { drillTech: flag.techId, slice: `trade:${flag.trade}` }) });
    flagGroups.set(flag.techId, group);
  }

  let rows: TeamRow[] = [];
  let tech: TechCard | undefined;
  if (!techId) {
    const scoped = (list: TechJobFact[]) => trade ? list.filter(f => f.trade === trade) : list;
    const whole = summarizeTeam(scoped(currentFacts), scoped(priorFacts), now);
    const techRows = teamRows(scoped(currentFacts), scoped(priorFacts), now, f => f.techId, f => f.techName);
    const open = await Promise.all(techRows.map(row => repository.listWorkOrders(scope, { internalMembershipId: row.key, maintenanceTeamOnly: true, internalOnly: true, statuses: dispatchStatuses.filter(s => !["completed_pending_review", "resolved"].includes(s)), limit: 1 })
      .then(page => page.totalCount ?? page.items.length).catch(() => undefined)));
    rows = [
      { key: "team", label: "Whole team", total: true, sublabel: `${techRows.length} ${techRows.length === 1 ? "technician" : "technicians"}`, cells: cells(whole, measure => drillLink(measure, { drillTech: "team" })) },
      ...techRows.map((row: TeamScoreRow, index) => ({ key: row.key, label: row.label, href: techHref(row.key),
        sublabel: [trade ? undefined : tradeSummary(scoped(currentFacts).filter(f => f.techId === row.key)), open[index] !== undefined ? `${open[index]} open now` : undefined].filter(Boolean).join(" · ") || undefined,
        cells: cells(row.measures, measure => drillLink(measure, { drillTech: row.key })) })),
    ];
  } else {
    const mine = (list: TechJobFact[]) => list.filter(f => f.techId === techId);
    const longFacts = history ?? teamFacts;
    const columns = windows.slice().reverse();
    const openPage = await repository.listWorkOrders(scope, { internalMembershipId: techId, maintenanceTeamOnly: true, internalOnly: true, statuses: dispatchStatuses.filter(s => !["completed_pending_review", "resolved"].includes(s)), limit: 1 }).catch(() => undefined);
    const team = summarizeTeam(currentFacts, [], now);
    tech = {
      id: techId, name: techName!, backHref: href({ tech: undefined }), dispatchHref: `/app/dispatch/technicians/${encodeURIComponent(techId)}`, jobs: mine(currentFacts).length,
      openNow: openPage ? openPage.totalCount ?? openPage.items.length : undefined,
      summary: cells(summarizeTeam(mine(currentFacts), mine(priorFacts), now), measure => drillLink(measure, {}), team),
      history: {
        columns: columns.map((window, index) => ({ label: periodLabel(window, period), current: index === columns.length - 1 })),
        rows: TEAM_MEASURES.map(measure => ({ measure, label: TEAM_MEASURE_INFO[measure].label, cells: columns.map(window => {
          const back = windows.indexOf(window);
          const cell = cellFor(summarizeTeam(mine(at(longFacts, window)), [], now)[measure], drillLink(measure, { slice: "history", back: String(back) }));
          return { value: cell.value, detail: cell.empty ? "" : cell.summary.tooFew ? "too few" : cell.detail, href: cell.href, quiet: cell.empty || cell.summary.tooFew };
        }) })),
      },
      byTrade: teamRows(mine(currentFacts), mine(priorFacts), now, f => f.trade, f => tradeLabel(f.trade)).map(row => {
        const teamTrade = summarizeTeam(currentFacts.filter(f => f.trade === row.key), [], now);
        return { key: row.key, label: row.label, sublabel: `Team did ${count(teamTrade.jobs.counted)}`, cells: cells(row.measures, measure => drillLink(measure, { slice: `trade:${row.key}` }), teamTrade) };
      }),
    };
  }

  // The jobs behind a tapped number: one technician (or the whole team), one measure, optionally one type of work or past period.
  let drill: TeamDrill | undefined;
  const drillMeasure = first(query.measure), slice = first(query.slice) ?? "";
  const drillTech = techId ?? first(query.drillTech);
  const [sliceKind, sliceValue] = slice.includes(":") ? [slice.slice(0, slice.indexOf(":")), slice.slice(slice.indexOf(":") + 1)] : [slice, ""];
  if (drillTech && isTeamMeasure(drillMeasure) && (drillTech === "team" || techId || currentFacts.some(f => f.techId === drillTech))) {
    const back = techId && sliceKind === "history" ? Math.max(0, Math.min(depth - 1, Math.floor(Number(first(query.back)) || 0))) : 0;
    const window = windows[back]!;
    const source = back > 1 && history ? history : teamFacts;
    const windowFacts = at(source, window);
    const pool = windowFacts.filter(f => (drillTech === "team" || f.techId === drillTech)
      && (sliceKind !== "trade" || f.trade === sliceValue)
      && (techId !== undefined || !trade || f.trade === trade));
    const measure = drillMeasure;
    const ranked = pool.map(fact => ({ fact, ...drillResult(fact, measure, now) })).filter(row => row.counted)
      .sort((a, b) => (a.tone === "bad" ? 0 : 1) - (b.tone === "bad" ? 0 : 1) || b.fact.startedAt.localeCompare(a.fact.startedAt));
    const summary = summarizeTeam(pool, [], now)[measure], cell = cellFor(summary, "");
    const info = TEAM_MEASURE_INFO[measure];
    const name = drillTech === "team" ? "Whole team" : techName ?? pool[0]?.techName ?? currentFacts.find(f => f.techId === drillTech)?.techName ?? "Technician";
    const placement: TeamDrillPlacement = techId ? (sliceKind === "history" ? "history" : sliceKind === "trade" ? "trade" : "summary") : "techs";
    const sliceLabel = sliceKind === "trade" ? tradeLabel(sliceValue) : sliceKind === "history" ? periodLabel(window, period) : undefined;
    // Who else worked each job, from the same rows.
    const workers = new Map<string, Set<string>>();
    for (const f of windowFacts) workers.set(f.workOrderId, (workers.get(f.workOrderId) ?? new Set()).add(f.techName));
    const size = 50, pages = Math.max(1, Math.ceil(ranked.length / size));
    const currentPage = Math.min(pages, Math.max(1, Math.floor(Number(first(query.drillPage)) || 1)));
    const pageHref = (value: number) => href({ measure, drillTech: first(query.drillTech), slice: first(query.slice), back: first(query.back), drillPage: value > 1 ? String(value) : undefined }, "#scorecard-jobs");
    drill = {
      placement, context: [name, sliceLabel].filter(Boolean).join(" · "), measure, measureLabel: info.label, definition: info.definition,
      headline: cell.empty ? "No jobs count toward this yet." : summary.tooFew ? `${cell.detail}. Showing the jobs so far.` : `${cell.value}${cell.detail && cell.detail !== "assigned" ? ` · ${cell.detail}` : ""}`,
      closeHref: href({}, `#${placement === "techs" ? "scorecard-techs" : `scorecard-${placement}`}`),
      page: pages > 1 ? { label: `${(currentPage - 1) * size + 1}–${Math.min(currentPage * size, ranked.length)} of ${ranked.length} jobs`, previousHref: currentPage > 1 ? pageHref(currentPage - 1) : undefined, nextHref: currentPage < pages ? pageHref(currentPage + 1) : undefined } : undefined,
      rows: ranked.slice((currentPage - 1) * size, currentPage * size).map(({ fact, result, tone }) => {
        const others = [...(workers.get(fact.workOrderId) ?? [])].filter(n => n !== fact.techName);
        const tags = [
          ...(drillTech === "team" ? [fact.techName] : []),
          ...(measure === "firstFix" && tone === "bad" && outsideTheirControl(fact) ? ["Outside their control"] : []),
          ...(fact.pm && measure === "callbacks" ? ["After maintenance"] : []),
          ...(others.length && drillTech !== "team" ? [`Shared with ${others.join(", ")}`] : []),
        ];
        return { workOrderId: fact.workOrderId, number: fact.number, problem: fact.problem, store: `Store ${fact.storeNumber}`, sent: formatOperationsDate(fact.startedAt), result, tone, tags };
      }),
    };
    if (measure === "callbacks") {
      // Side by side: what they recorded doing, and the repair that followed on the same equipment.
      await Promise.all(drill.rows.filter(row => row.tone === "bad").map(async row => {
        const fact = pool.find(f => f.workOrderId === row.workOrderId);
        if (!fact?.callbackWorkOrderId || !fact.completedAt) return;
        const [outcomes, next, links] = await Promise.all([repository.listWorkOutcomesForWorkOrder(session.organizationId, fact.workOrderId), repository.getWorkOrder(session.organizationId, fact.callbackWorkOrderId), repository.listWorkCallbacks(session.organizationId, [fact.callbackWorkOrderId])]);
        if (!next) return;
        const link = links.find(item => item.workOrderId === next.id && item.originalWorkOrderId === fact.workOrderId && item.status !== "not_callback");
        const tags = link ? [link.status === "no_charge" ? "Callback · no charge" : link.status === "new_work" ? "Callback · became new work" : "Callback · not closed out"] : [];
        const did = outcomes.filter(o => o.outcomeNotes?.trim()).sort((a, b) => (b.outcomeRecordedAt ?? "").localeCompare(a.outcomeRecordedAt ?? ""))[0]?.outcomeNotes?.trim();
        row.repeat = { did, nextId: next.id, nextNumber: next.number, nextProblem: next.problem, daysLater: Math.max(0, Math.round((Date.parse(next.createdAt) - Date.parse(fact.completedAt)) / 86_400_000)), tags };
      }));
    }
  }

  const dated = (iso: string) => formatOperationsDate(iso.slice(0, 10));
  return {
    view: techId ? "tech" : "team",
    scopeLabel: region ? regions.find(r => r.value === region)!.label : session.scopeLabel,
    periodLabel: `${dated(current.from)} – ${dated(current.to)}`,
    priorLabel: `${dated(prior.from)} – ${dated(prior.to)}`,
    period,
    periods: ([30, 90, 180, 365] as const).map(value => ({ value, label: PERIOD_LABELS[value], href: href({ period: String(value) }), selected: value === period })),
    regions: regions.length > 1 ? regions : [], region, regionBase: href({ region: undefined }),
    trades: techId ? [] : tradeKeys.map(key => ({ value: key, label: tradeLabel(key), jobs: currentFacts.filter(f => f.trade === key).length, href: href({ trade: key }), selected: key === trade }))
      .sort((a, b) => (a.value === "unclassified" ? 1 : 0) - (b.value === "unclassified" ? 1 : 0) || b.jobs - a.jobs || a.label.localeCompare(b.label)),
    allTradesHref: href({ trade: undefined }), trade,
    totals: { techs: new Set(currentFacts.map(f => f.techId)).size, jobs: currentFacts.length },
    flags: [...flagGroups.values()],
    rows, tech, drill,
    definitions: TEAM_MEASURES.map(key => ({ label: TEAM_MEASURE_INFO[key].label, definition: TEAM_MEASURE_INFO[key].definition })),
    smallSample: TEAM_SMALL_SAMPLE, flagSample: FLAG_SAMPLE, flagGap: Math.round(FLAG_GAP * 100),
  };
}
