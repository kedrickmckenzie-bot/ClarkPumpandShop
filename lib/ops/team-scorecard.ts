import type { OrganizationScope } from "./repository";
import type { OpsSqlDriver } from "./sql-driver";
import { scopeWhere } from "./sql-scope";
import type { OpsFixture } from "./types";
import { cachedDateTimeFormat } from "./intl-format-cache";
import { tradeLabel, type ScorecardPeriod, type ScorecardWindow } from "./vendor-scorecard";

/**
 * In-house team scorecard. One fact row per job per technician who was assigned it or worked on it,
 * built by the same rules from the fixture and from SQL. Every number opens the exact rows behind it.
 *
 * It measures job results only — finishing, planned days, first-visit fixes, and repairs that came
 * back — never hours, busyness, or pay. Technicians are compared only with teammates doing the same
 * type of work, and returns caused by parts, access or a vendor are shown but never flagged.
 */

export interface TechPlan { revision: number; precision: string; day?: string; zone: string; recordedAt: string }

export interface TechJobFact {
  workOrderId: string;
  number: string;
  problem: string;
  storeId: string;
  storeNumber: string;
  storeName: string;
  regionId?: string;
  regionName?: string;
  techId: string;
  techName: string;
  trade: string;
  assetId?: string;
  /** Planned maintenance rather than a reported problem. */
  pm: boolean;
  /** When the job was first assigned to this technician (or, without an assignment, first worked). */
  startedAt: string;
  firstOutcome?: string;
  /** Why a recorded result could not finish the job ("parts", "help", "vendor", "cannot_today"). */
  firstBlocker?: string;
  /** Their first visit checkout or recorded result on the job. */
  firstWorkedAt?: string;
  firstCompletedAt?: string;
  completedAt?: string;
  /** Plan revisions on this technician's assignment, oldest first. */
  plans: TechPlan[];
  callbackWorkOrderId?: string;
  callbackAt?: string;
}

export const TEAM_MEASURES = ["jobs", "finish", "plannedDay", "firstFix", "callbacks"] as const;
export type TeamMeasureKey = typeof TEAM_MEASURES[number];
export const TEAM_MEASURE_GROUPS: ReadonlyArray<{ label: string; keys: readonly TeamMeasureKey[] }> = [
  { label: "Volume", keys: ["jobs"] },
  { label: "Speed", keys: ["finish", "plannedDay"] },
  { label: "Quality", keys: ["firstFix", "callbacks"] },
];
export type TeamDirection = "higher" | "lower" | "neutral";
export const TEAM_MEASURE_INFO: Record<TeamMeasureKey, { label: string; when?: string; direction: TeamDirection; definition: string }> = {
  jobs: { label: "Jobs", direction: "neutral", definition: "Jobs assigned to this technician in the period, or worked by them without an assignment. Cancelled jobs are left out." },
  finish: { label: "Typical time to finish", when: "From assigned to done", direction: "lower", definition: "Typical (median) time from the job being assigned to them until they recorded it done. Includes waits for parts." },
  plannedDay: { label: "Visited on the planned day", when: "Jobs with a planned day", direction: "higher", definition: "Their first visit (or recorded result) was on or before the day the job was planned for. A plan moved before its day counts the new day; a day that passed without a visit counts as missed, even if it was re-planned later. Whether the job was finished that day is under Fixed first visit. Jobs without a planned day aren't counted." },
  firstFix: { label: "Fixed first visit", direction: "higher", definition: "Their first result on the job was “done”. Planned maintenance, “no problem found” and work that wasn't authorized aren't counted. Each miss shows its reason, such as waiting on parts." },
  callbacks: { label: "Repaired again within 30 days", when: "Same equipment, any problem", direction: "lower", definition: "The same equipment needed another repair (any problem, by anyone) within 30 days of their fix. Not proof the fix failed: open the jobs to compare. Fixes less than 30 days old aren't counted yet." },
};

/** A rate needs this many jobs before it is shown; a flag needs it on both sides of the comparison. */
export const TEAM_SMALL_SAMPLE = 5;
/** A flag needs at least this many jobs on each side, and at least FLAG_MIN_BAD problem jobs. */
export const FLAG_SAMPLE = 8;
export const FLAG_MIN_BAD = 3;
/** How much worse than the rest of the team (same type of work) before a result is worth a look. */
export const FLAG_GAP = 0.15;
/** How much worse than their own previous period, when nobody else does that work. */
export const TREND_FLAG_GAP = 0.2;
const CALLBACK_DAYS = 30;
const DAY_MS = 86_400_000;

export function isTeamMeasure(value: unknown): value is TeamMeasureKey { return typeof value === "string" && (TEAM_MEASURES as readonly string[]).includes(value); }

/* ---------------- Facts: fixture ---------------- */

export function techJobFactsFromFixture(fixture: OpsFixture, scope: OrganizationScope, window: ScorecardWindow & { techId?: string }): TechJobFact[] {
  const org = scope.organizationId;
  const stores = new Map(fixture.stores.filter(s => s.organizationId === org
    && (scope.storeIds === undefined || scope.storeIds.includes(s.id))
    && (scope.regionIds === undefined || Boolean(s.regionId && scope.regionIds.includes(s.regionId)))).map(s => [s.id, s]));
  const regions = new Map(fixture.regions.filter(r => r.organizationId === org).map(r => [r.id, r]));
  const users = new Map(fixture.users.map(u => [u.id, u.displayName]));
  const techs = new Map(fixture.memberships.filter(m => m.organizationId === org && m.role === "internal_technician" && (!window.techId || m.id === window.techId)).map(m => [m.id, users.get(m.userId) ?? "Technician"]));
  const work = new Map(fixture.workOrders.filter(w => w.organizationId === org).map(w => [w.id, w]));
  const pmWork = new Set(fixture.pmOccurrences.filter(p => p.organizationId === org && p.workOrderId).map(p => p.workOrderId!));
  const assignments = fixture.assignments.filter(a => a.organizationId === org && a.kind === "internal" && a.internalMembershipId && techs.has(a.internalMembershipId));
  const assignmentTech = new Map(assignments.map(a => [a.id, a.internalMembershipId!]));
  const visitTech = new Map(fixture.visits.filter(v => v.organizationId === org && v.providerKind === "internal" && v.internalMembershipId && techs.has(v.internalMembershipId)).map(v => [v.id, v.internalMembershipId!]));
  // Results by this technician: visit checkouts, plus results recorded without a visit (latest correction wins).
  const superseded = new Set((fixture.workResults ?? []).filter(r => r.organizationId === org && r.supersedesResultId).map(r => r.supersedesResultId!));
  const worked = [
    ...fixture.siteVisitWorkOrders.filter(l => l.organizationId === org && l.outcome && l.outcomeRecordedAt && visitTech.has(l.visitId))
      .map(l => ({ id: l.id, workOrderId: l.workOrderId, techId: visitTech.get(l.visitId)!, outcome: l.outcome!, at: l.outcomeRecordedAt!, blocker: undefined as string | undefined })),
    ...(fixture.workResults ?? []).filter(r => r.organizationId === org && !r.siteVisitWorkOrderId && r.performerMembershipId && techs.has(r.performerMembershipId) && !superseded.has(r.id))
      .map(r => ({ id: r.id, workOrderId: r.workOrderId, techId: r.performerMembershipId!, outcome: r.outcome, at: r.outcomeRecordedAt, blocker: r.blocker as string | undefined })),
  ];
  const pairs = new Map<string, { workOrderId: string; techId: string; startedAt: string }>();
  const touch = (workOrderId: string, techId: string, at: string) => {
    const key = `${workOrderId}|${techId}`, current = pairs.get(key);
    if (!current || at < current.startedAt) pairs.set(key, { workOrderId, techId, startedAt: at });
  };
  for (const a of assignments) touch(a.workOrderId, a.internalMembershipId!, a.assignedAt);
  for (const w of worked) touch(w.workOrderId, w.techId, w.at);
  const workedBy = new Map<string, typeof worked>();
  for (const w of worked) workedBy.set(`${w.workOrderId}|${w.techId}`, [...(workedBy.get(`${w.workOrderId}|${w.techId}`) ?? []), w]);
  const plansBy = new Map<string, TechPlan[]>();
  for (const s of fixture.internalSchedules ?? []) {
    const techId = s.organizationId === org ? assignmentTech.get(s.assignmentId) : undefined;
    if (!techId) continue;
    const key = `${s.workOrderId}|${techId}`;
    plansBy.set(key, [...(plansBy.get(key) ?? []), { revision: s.revision, precision: s.precision, day: s.day, zone: s.planningZone, recordedAt: s.recordedAt }]);
  }
  const workByAsset = new Map<string, typeof fixture.workOrders>();
  for (const o of fixture.workOrders) if (o.organizationId === org && o.assetId && o.status !== "cancelled" && o.priority !== "planned" && !pmWork.has(o.id)) workByAsset.set(o.assetId, [...(workByAsset.get(o.assetId) ?? []), o]);
  const facts: TechJobFact[] = [];
  for (const { workOrderId, techId, startedAt } of pairs.values()) {
    const w = work.get(workOrderId), store = w && stores.get(w.storeId);
    if (!w || !store || w.status === "cancelled" || startedAt < window.from || startedAt >= window.to) continue;
    const key = `${workOrderId}|${techId}`;
    const results = (workedBy.get(key) ?? []).sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
    const done = results.filter(r => r.outcome === "completed").map(r => r.at);
    const completedAt = done.at(-1);
    const callback = completedAt && w.assetId ? (workByAsset.get(w.assetId) ?? [])
      .filter(o => o.id !== w.id && o.createdAt > completedAt)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))[0] : undefined;
    facts.push({
      workOrderId: w.id, number: w.number, problem: w.problem, storeId: store.id, storeNumber: store.storeNumber, storeName: store.name,
      regionId: store.regionId && regions.has(store.regionId) ? store.regionId : undefined, regionName: store.regionId ? regions.get(store.regionId)?.name : undefined,
      techId, techName: techs.get(techId)!, trade: w.categoryKey ?? "unclassified", assetId: w.assetId, pm: w.priority === "planned" || pmWork.has(w.id), startedAt,
      firstOutcome: results[0]?.outcome, firstBlocker: results[0]?.blocker, firstWorkedAt: results[0]?.at, firstCompletedAt: done[0], completedAt,
      plans: (plansBy.get(key) ?? []).sort((a, b) => a.revision - b.revision),
      callbackWorkOrderId: callback?.id, callbackAt: callback?.createdAt,
    });
  }
  return facts.sort(compareFacts);
}

function compareFacts(a: TechJobFact, b: TechJobFact) {
  return a.startedAt.localeCompare(b.startedAt) || a.workOrderId.localeCompare(b.workOrderId) || a.techId.localeCompare(b.techId);
}

/* ---------------- Facts: SQL (D1 and PostgreSQL) ---------------- */

export async function queryTechJobFacts(driver: OpsSqlDriver, scope: OrganizationScope, window: ScorecardWindow & { techId?: string }): Promise<TechJobFact[]> {
  const org = scope.organizationId;
  const techParams: unknown[] = [org, ...(window.techId ? [window.techId] : [])];
  const params: unknown[] = [...techParams, org, org, org, org];
  const scoped = scopeWhere(scope, "st", params);
  params.push(window.from, window.to, org);
  const postgres = driver.dialect === "postgres";
  const planText = "CAST(s.revision AS TEXT) || '|' || s.precision || '|' || COALESCE(s.day, '') || '|' || s.planning_zone || '|' || s.recorded_at";
  const result = await driver.query({ sql: `WITH techs AS (
      SELECT m.id, u.display_name FROM ops_memberships m JOIN ops_users u ON u.id = m.user_id
      WHERE m.organization_id = ? AND m.role = 'internal_technician'${window.techId ? " AND m.id = ?" : ""}
    ), assigned AS (
      SELECT a.id AS assignment_id, a.work_order_id, a.internal_membership_id AS tech_id, a.assigned_at
      FROM ops_work_order_assignments a JOIN techs t ON t.id = a.internal_membership_id
      WHERE a.organization_id = ? AND a.kind = 'internal'
    ), worked AS (
      SELECT x.id, x.work_order_id, vs.internal_membership_id AS tech_id, x.outcome, x.outcome_recorded_at AS at, NULL AS blocker
      FROM ops_site_visit_work_orders x
      JOIN ops_visit_sessions vs ON vs.organization_id = x.organization_id AND vs.id = x.visit_id
      JOIN techs t ON t.id = vs.internal_membership_id
      WHERE x.organization_id = ? AND vs.provider_kind = 'internal' AND x.outcome IS NOT NULL AND x.outcome_recorded_at IS NOT NULL
      UNION ALL
      SELECT r.id, r.work_order_id, r.performer_membership_id AS tech_id, r.outcome, r.outcome_recorded_at AS at, r.blocker
      FROM ops_work_results r JOIN techs t ON t.id = r.performer_membership_id
      WHERE r.organization_id = ? AND r.site_visit_work_order_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM ops_work_results s WHERE s.organization_id = r.organization_id AND s.supersedes_result_id = r.id)
    ), pairs AS (
      SELECT work_order_id, tech_id, MIN(at) AS started_at FROM (
        SELECT work_order_id, tech_id, assigned_at AS at FROM assigned
        UNION ALL SELECT work_order_id, tech_id, at FROM worked
      ) touched GROUP BY work_order_id, tech_id
    ), jobs AS (
      SELECT w.organization_id, p.work_order_id, p.tech_id, p.started_at, w.number, w.problem, w.category_key, w.asset_id,
        CASE WHEN w.priority = 'planned' OR EXISTS (SELECT 1 FROM ops_pm_occurrences pm WHERE pm.organization_id = w.organization_id AND pm.work_order_id = w.id) THEN 1 ELSE 0 END AS pm,
        st.id AS store_id, st.store_number, st.name AS store_name, rg.id AS region_id, rg.name AS region_name, t.display_name AS tech_name
      FROM pairs p
      JOIN ops_work_orders w ON w.organization_id = ? AND w.id = p.work_order_id
      JOIN ops_stores st ON st.organization_id = w.organization_id AND st.id = w.store_id
      JOIN techs t ON t.id = p.tech_id
      LEFT JOIN ops_regions rg ON rg.organization_id = st.organization_id AND rg.id = st.region_id
      WHERE ${scoped} AND w.status <> 'cancelled' AND p.started_at >= ? AND p.started_at < ?
    ), firsts AS (
      SELECT wk.work_order_id, wk.tech_id, wk.outcome, wk.blocker, ROW_NUMBER() OVER (PARTITION BY wk.work_order_id, wk.tech_id ORDER BY wk.at ASC, wk.id ASC) AS n
      FROM worked wk JOIN jobs j ON j.work_order_id = wk.work_order_id AND j.tech_id = wk.tech_id
    ), completions AS (
      SELECT wk.work_order_id, wk.tech_id, MIN(wk.at) AS first_worked_at,
        MIN(CASE WHEN wk.outcome = 'completed' THEN wk.at END) AS first_completed_at, MAX(CASE WHEN wk.outcome = 'completed' THEN wk.at END) AS completed_at
      FROM worked wk JOIN jobs j ON j.work_order_id = wk.work_order_id AND j.tech_id = wk.tech_id
      GROUP BY wk.work_order_id, wk.tech_id
    ), plans AS (
      SELECT s.work_order_id, a.tech_id, ${postgres ? `STRING_AGG(${planText}, ';' ORDER BY s.revision)` : `GROUP_CONCAT(${planText}, ';')`} AS plans
      FROM ops_internal_schedules s
      JOIN assigned a ON a.assignment_id = s.assignment_id AND a.work_order_id = s.work_order_id
      JOIN jobs j ON j.work_order_id = s.work_order_id AND j.tech_id = a.tech_id
      WHERE s.organization_id = ? GROUP BY s.work_order_id, a.tech_id
    ), facts AS (
      SELECT j.*, f.outcome AS first_outcome, f.blocker AS first_blocker, c.first_worked_at, c.first_completed_at, c.completed_at, pl.plans
      FROM jobs j
      LEFT JOIN firsts f ON f.work_order_id = j.work_order_id AND f.tech_id = j.tech_id AND f.n = 1
      LEFT JOIN completions c ON c.work_order_id = j.work_order_id AND c.tech_id = j.tech_id
      LEFT JOIN plans pl ON pl.work_order_id = j.work_order_id AND pl.tech_id = j.tech_id
    ), callbacks AS (
      SELECT f.work_order_id, f.tech_id, o.id AS callback_work_order_id, o.created_at AS callback_at,
        ROW_NUMBER() OVER (PARTITION BY f.work_order_id, f.tech_id ORDER BY o.created_at ASC, o.id ASC) AS n
      FROM facts f
      JOIN ops_work_orders o ON o.organization_id = f.organization_id AND o.asset_id = f.asset_id AND o.id <> f.work_order_id AND o.created_at > f.completed_at
      WHERE f.completed_at IS NOT NULL AND o.status <> 'cancelled' AND o.priority <> 'planned'
        AND NOT EXISTS (SELECT 1 FROM ops_pm_occurrences p WHERE p.organization_id = o.organization_id AND p.work_order_id = o.id)
    )
    SELECT f.*, cb.callback_work_order_id, cb.callback_at
    FROM facts f
    LEFT JOIN callbacks cb ON cb.work_order_id = f.work_order_id AND cb.tech_id = f.tech_id AND cb.n = 1
    ORDER BY f.started_at ASC, f.work_order_id ASC, f.tech_id ASC`, params });
  const text = (value: unknown) => value == null ? undefined : value instanceof Date ? value.toISOString() : String(value);
  const plans = (value: unknown): TechPlan[] => (text(value) ?? "").split(";").filter(Boolean).map(part => {
    const [revision, precision, day, zone, ...rest] = part.split("|");
    return { revision: Number(revision), precision: precision!, day: day || undefined, zone: zone!, recordedAt: rest.join("|") };
  }).sort((a, b) => a.revision - b.revision);
  return result.rows.map(r => ({
    workOrderId: String(r.work_order_id), number: String(r.number), problem: String(r.problem), storeId: String(r.store_id),
    storeNumber: String(r.store_number), storeName: String(r.store_name), regionId: text(r.region_id), regionName: text(r.region_name),
    techId: String(r.tech_id), techName: String(r.tech_name), trade: text(r.category_key) ?? "unclassified", assetId: text(r.asset_id), pm: Number(r.pm) === 1,
    startedAt: text(r.started_at)!, firstOutcome: text(r.first_outcome), firstBlocker: text(r.first_blocker), firstWorkedAt: text(r.first_worked_at),
    firstCompletedAt: text(r.first_completed_at), completedAt: text(r.completed_at), plans: plans(r.plans),
    callbackWorkOrderId: text(r.callback_work_order_id), callbackAt: text(r.callback_at),
  })).sort(compareFacts);
}

/* ---------------- Per-job results ---------------- */

const dayIn = (iso: string, zone: string) => cachedDateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: zone }).format(new Date(iso));
const NOT_A_FIX_ATTEMPT = new Set(["no_issue_found", "work_not_authorized", "not_addressed"]);

/** Why the first visit didn't finish the job, in plain words. */
export function returnReason(fact: Pick<TechJobFact, "firstOutcome" | "firstBlocker">): string | undefined {
  if (!fact.firstOutcome || fact.firstOutcome === "completed") return undefined;
  if (fact.firstBlocker === "parts" || fact.firstOutcome === "parts_required") return "Waiting on parts";
  if (fact.firstBlocker === "help") return "Needed help";
  if (fact.firstBlocker === "vendor" || fact.firstOutcome === "quote_required") return "Handed to a vendor";
  if (fact.firstBlocker === "cannot_today" || fact.firstOutcome === "store_access_unavailable") return "Couldn't get in or do it that day";
  if (fact.firstOutcome === "temporary_repair") return "Temporary repair first";
  if (fact.firstOutcome === "diagnosis_only") return "Diagnosed first";
  return "Needed another trip";
}
/** Returns caused by something outside the technician's hands: shown, never flagged. */
export const outsideTheirControl = (fact: Pick<TechJobFact, "firstOutcome" | "firstBlocker">) =>
  ["Waiting on parts", "Handed to a vendor", "Couldn't get in or do it that day"].includes(returnReason(fact) ?? "");

/**
 * The planned-day result. Each plan is in force from when it was recorded until the next one.
 * A first visit while a plan is in force counts against that plan's day. A planned day that ends while
 * its plan is still in force — nobody there yet — is a miss, however it was re-planned afterwards.
 */
export function plannedDayResult(fact: Pick<TechJobFact, "plans" | "firstWorkedAt">, now: string): { counted: boolean; hit?: boolean; day?: string; doneDay?: string } {
  const plans = fact.plans;
  if (!plans.some(p => p.day)) return { counted: false };
  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i]!, next = plans[i + 1];
    if (!plan.day) continue;
    const done = fact.firstWorkedAt;
    if (done && (!next || done < next.recordedAt)) {
      const doneDay = dayIn(done, plan.zone);
      return { counted: true, hit: doneDay <= plan.day, day: plan.day, doneDay };
    }
    const passed = next ? dayIn(next.recordedAt, plan.zone) > plan.day : dayIn(now, plan.zone) > plan.day;
    if (passed) return { counted: true, hit: false, day: plan.day, doneDay: done ? dayIn(done, plan.zone) : undefined };
  }
  return { counted: false };
}

export function teamJobResult(fact: TechJobFact, measure: TeamMeasureKey, now: string): { counted: boolean; hit?: boolean; value?: number } {
  switch (measure) {
    case "jobs": return { counted: true, hit: Boolean(fact.firstCompletedAt) };
    case "finish": return fact.firstCompletedAt ? { counted: true, value: Math.max(0, Date.parse(fact.firstCompletedAt) - Date.parse(fact.startedAt)) / 3_600_000 } : { counted: false };
    case "plannedDay": { const r = plannedDayResult(fact, now); return { counted: r.counted, hit: r.hit }; }
    case "firstFix": return fact.pm || !fact.firstOutcome || NOT_A_FIX_ATTEMPT.has(fact.firstOutcome) ? { counted: false } : { counted: true, hit: fact.firstOutcome === "completed" };
    case "callbacks": {
      // A fix needs 30 days behind it before it can be judged.
      if (!fact.completedAt || !fact.assetId || Date.parse(fact.completedAt) + CALLBACK_DAYS * DAY_MS > Date.parse(now)) return { counted: false };
      return { counted: true, hit: Boolean(fact.callbackAt && Date.parse(fact.callbackAt) <= Date.parse(fact.completedAt) + CALLBACK_DAYS * DAY_MS) };
    }
  }
}

/** Why a job is left out of a measure, in plain words; undefined when it counts. Lets every list add back up to the jobs total. */
export function notCountedReason(fact: TechJobFact, measure: TeamMeasureKey, now: string): string | undefined {
  if (teamJobResult(fact, measure, now).counted) return undefined;
  switch (measure) {
    case "jobs": return undefined;
    case "finish": return "not done yet";
    case "plannedDay": return fact.plans.some(p => p.day) ? "planned day not reached yet" : "no planned day";
    case "firstFix": return fact.pm ? "routine maintenance" : !fact.firstOutcome ? "not visited yet" : "no repair needed";
    case "callbacks": return !fact.assetId ? "no equipment on the job" : !fact.completedAt ? "not done yet" : "fixed less than 30 days ago";
  }
}

/* ---------------- Summary ---------------- */

export interface TeamMeasureSummary {
  key: TeamMeasureKey; counted: number; hits: number; value?: number; tooFew: boolean;
  trend?: "better" | "worse"; priorValue?: number; emptyReason?: string;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b), mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function emptyReasonOf(facts: TechJobFact[], key: TeamMeasureKey): string {
  if (!facts.length) return "No jobs";
  switch (key) {
    case "finish": return "None finished yet";
    case "plannedDay": return facts.some(f => f.plans.some(p => p.day)) ? "No planned days passed yet" : "No planned days";
    case "firstFix": return facts.every(f => f.pm) ? "Only planned maintenance" : "No results recorded yet";
    case "callbacks": return !facts.some(f => f.assetId) ? "No equipment on these jobs" : facts.some(f => f.assetId && f.completedAt) ? "Fixes under 30 days old" : "No equipment fixes finished yet";
    default: return "No data yet";
  }
}

export function summarizeTeamMeasure(facts: TechJobFact[], key: TeamMeasureKey, now: string): TeamMeasureSummary {
  const results = facts.map(f => teamJobResult(f, key, now)).filter(r => r.counted);
  const hits = results.filter(r => r.hit).length;
  const values = results.map(r => r.value).filter((v): v is number => v !== undefined);
  const value = key === "jobs" ? results.length : key === "finish" ? (values.length ? median(values) : undefined) : results.length ? hits / results.length : undefined;
  return { key, counted: results.length, hits, value, tooFew: key !== "jobs" && results.length > 0 && results.length < TEAM_SMALL_SAMPLE, ...(results.length ? {} : { emptyReason: emptyReasonOf(facts, key) }) };
}

function trendOf(key: TeamMeasureKey, current: number, prior: number): "better" | "worse" | undefined {
  const direction = TEAM_MEASURE_INFO[key].direction;
  if (direction === "neutral") return undefined;
  const change = key === "finish" ? (Math.abs(current - prior) >= Math.max(2, prior * 0.15) ? current - prior : 0) : Math.abs(current - prior) >= 0.05 ? current - prior : 0;
  if (!change) return undefined;
  return (change < 0) === (direction === "lower") ? "better" : "worse";
}

export function summarizeTeam(facts: TechJobFact[], prior: TechJobFact[], now: string) {
  return Object.fromEntries(TEAM_MEASURES.map(key => {
    const summary = summarizeTeamMeasure(facts, key, now), before = summarizeTeamMeasure(prior, key, now);
    if (summary.value !== undefined && !summary.tooFew && before.value !== undefined && !before.tooFew && before.counted) {
      summary.priorValue = before.value;
      summary.trend = trendOf(key, summary.value, before.value);
    }
    return [key, summary];
  })) as Record<TeamMeasureKey, TeamMeasureSummary>;
}

export interface TeamScoreRow { key: string; label: string; measures: Record<TeamMeasureKey, TeamMeasureSummary> }

/** Rows grouped by any key (technician, district, type of work). Largest first. */
export function teamRows(facts: TechJobFact[], prior: TechJobFact[], now: string, keyOf: (fact: TechJobFact) => string, labelOf: (fact: TechJobFact) => string): TeamScoreRow[] {
  const groups = new Map<string, TechJobFact[]>();
  for (const fact of facts) groups.set(keyOf(fact), [...(groups.get(keyOf(fact)) ?? []), fact]);
  return [...groups.entries()].map(([key, rows]) => ({ key, label: labelOf(rows[0]!), measures: summarizeTeam(rows, prior.filter(f => keyOf(f) === key), now) }))
    .sort((a, b) => b.measures.jobs.counted - a.measures.jobs.counted || a.label.localeCompare(b.label));
}

/* ---------------- Worth a look ---------------- */

export type FlagMeasure = "firstFix" | "callbacks" | "plannedDay";
export interface TeamFlag { techId: string; techName: string; trade: string; measure: FlagMeasure; headline: string; text: string; gap: number }

/** The jobs a flag compares. First-visit fixes leave out returns that were outside the technician's hands. */
function flagCount(facts: TechJobFact[], measure: FlagMeasure, now: string) {
  let counted = 0, bad = 0, excluded = 0;
  for (const fact of facts) {
    const r = teamJobResult(fact, measure, now);
    if (!r.counted) continue;
    if (measure === "firstFix" && !r.hit && outsideTheirControl(fact)) { excluded++; continue; }
    counted++;
    if (measure === "callbacks" ? r.hit : !r.hit) bad++;
  }
  return { counted, bad, rate: counted ? bad / counted : 0, excluded };
}

const FLAG_WORDS: Record<FlagMeasure, (bad: number, counted: number) => string> = {
  firstFix: (bad, counted) => `${bad} of ${counted} jobs needed a second trip`,
  callbacks: (bad, counted) => `${bad} of ${counted} fixes were repaired again within 30 days`,
  plannedDay: (bad, counted) => `Missed the planned day on ${bad} of ${counted} jobs`,
};

/**
 * Results clearly worse than teammates doing the same type of work (by FLAG_GAP, with enough jobs on
 * both sides), or — when nobody else does that work — clearly worse than their own previous period.
 * Plain sentences, worst first. Not a ranking: most technicians will never appear here.
 */
export function teamFlags(facts: TechJobFact[], prior: TechJobFact[], now: string): TeamFlag[] {
  const flags: TeamFlag[] = [];
  const techs = new Map(facts.map(f => [f.techId, f.techName]));
  for (const [techId, techName] of techs) {
    const trades = new Set(facts.filter(f => f.techId === techId).map(f => f.trade));
    for (const trade of trades) {
      if (trade === "unclassified") continue;
      for (const measure of ["firstFix", "callbacks", "plannedDay"] as const) {
        const mine = flagCount(facts.filter(f => f.techId === techId && f.trade === trade), measure, now);
        if (mine.counted < FLAG_SAMPLE || mine.bad < FLAG_MIN_BAD) continue;
        const peers = flagCount(facts.filter(f => f.techId !== techId && f.trade === trade), measure, now);
        const note = mine.excluded ? ` ${mine.excluded} more waited on parts, access or a vendor and aren't counted.` : "";
        if (peers.counted >= FLAG_SAMPLE) {
          const gap = mine.rate - peers.rate;
          if (gap >= FLAG_GAP) flags.push({ techId, techName, trade, measure, gap, headline: `${techName} · ${tradeLabel(trade)}`,
            text: `${FLAG_WORDS[measure](mine.bad, mine.counted)}. Rest of the team: ${peers.bad} of ${peers.counted}.${note}` });
          continue;
        }
        const before = flagCount(prior.filter(f => f.techId === techId && f.trade === trade), measure, now);
        const gap = mine.rate - before.rate;
        if (before.counted >= FLAG_SAMPLE && gap >= TREND_FLAG_GAP) flags.push({ techId, techName, trade, measure, gap, headline: `${techName} · ${tradeLabel(trade)}`,
          text: `${FLAG_WORDS[measure](mine.bad, mine.counted)}, up from ${before.bad} of ${before.counted} the period before. Nobody else on the team did enough of this work to compare.${note}` });
      }
    }
  }
  return flags.sort((a, b) => b.gap - a.gap || a.techName.localeCompare(b.techName));
}

export const inTeamWindow = (fact: TechJobFact, window: ScorecardWindow) => fact.startedAt >= window.from && fact.startedAt < window.to;
export type { ScorecardPeriod, ScorecardWindow };
