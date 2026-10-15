import type { OpsCommandServices } from "./commands";
import { OpsDomainError } from "./errors";
import type { OpsStatement } from "./repository";
import type { ActorContext, OpsFixture } from "./types";
import { completedIn, costIn, daysToComplete, median, type JobFact, type ReportContext } from "./reports/facts";

/**
 * Maintenance spend totals from accounting, for a date range they choose: either the company's total maintenance spend
 * or the in-house part only. The app never splits a range into smaller pieces, because it can't know which day holds
 * which dollars. Ranges may not overlap; a wrong entry is withdrawn (kept on record) and entered again.
 */
export type SpendTotalKind = "total" | "in_house";
export const SPEND_TOTAL_KIND_LABELS: Record<SpendTotalKind, string> = { total: "Total maintenance spend (in-house and vendors)", in_house: "In-house maintenance spend only" };

export interface SpendTotal {
  id: string;
  organizationId: string;
  periodStart: string;
  periodEnd: string;
  kind: SpendTotalKind;
  amountMinor: number;
  currency: string;
  note?: string;
  enteredByName: string;
  enteredByActorId?: string;
  createdAt: string;
  withdrawnAt?: string;
  withdrawnByName?: string;
  withdrawnReason?: string;
}

const DAY = 86_400_000;
const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/u.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
export const addDay = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
export const overlaps = (a: { periodStart: string; periodEnd: string }, b: { periodStart: string; periodEnd: string }) => a.periodStart <= b.periodEnd && b.periodStart <= a.periodEnd;

function insert(table: string, values: Record<string, unknown>): OpsStatement {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined);
  return { sql: `INSERT INTO ${table} (${entries.map(([key]) => key).join(", ")}) VALUES (${entries.map(() => "?").join(", ")})`, params: entries.map(([, value]) => value) };
}
const audit = (organizationId: string, entry: SpendTotal, eventType: string, actor: ActorContext, now: string, extra: object = {}): OpsStatement =>
  insert("ops_audit_events", { id: `audit-${crypto.randomUUID()}`, organization_id: organizationId, aggregate_type: "spend_total", aggregate_id: entry.id, event_type: eventType, actor_type: actor.actorType, actor_id: actor.actorId, actor_name: actor.actorName, occurred_at: now, payload_json: JSON.stringify({ periodStart: entry.periodStart, periodEnd: entry.periodEnd, kind: entry.kind, amountMinor: entry.amountMinor, ...extra }) });

/** The entries that still count (not withdrawn), oldest period first. */
export const activeTotals = (entries: readonly SpendTotal[]) => entries.filter((entry) => !entry.withdrawnAt).sort((a, b) => a.periodStart.localeCompare(b.periodStart) || a.id.localeCompare(b.id));

export class SpendTotalOverlapError extends OpsDomainError {
  constructor(readonly overlapping: SpendTotal[]) {
    super("CONFLICT", `These dates overlap ${overlapping.length === 1 ? "an entry" : `${overlapping.length} entries`} already saved. Check both against your books: fix these dates, or withdraw the earlier entry if it was wrong.`);
  }
}

export async function addSpendTotal(svc: OpsCommandServices, input: { organizationId: string; periodStart: string; periodEnd: string; kind: string; amountMinor: number; note?: string; actor: ActorContext; key: string }) {
  if (input.actor.organizationId !== input.organizationId) throw new OpsDomainError("FORBIDDEN", "This is outside your organization.");
  if (!isDate(input.periodStart) || !isDate(input.periodEnd)) throw new OpsDomainError("VALIDATION", "Enter the first and last day the amount covers.");
  if (input.periodEnd < input.periodStart) throw new OpsDomainError("VALIDATION", "The last day is before the first day.");
  const now = svc.clock?.now() ?? new Date().toISOString();
  if (input.periodEnd > now.slice(0, 10)) throw new OpsDomainError("VALIDATION", "Enter totals for dates that have already happened.");
  if (input.kind !== "total" && input.kind !== "in_house") throw new OpsDomainError("VALIDATION", "Say whether this is total spend or in-house only.");
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 0 || input.amountMinor > 100_000_000_000) throw new OpsDomainError("VALIDATION", "Enter an amount of $0 or more.");
  if ((input.note ?? "").length > 500) throw new OpsDomainError("VALIDATION", "Keep the note under 500 characters.");
  if (!/^[A-Za-z0-9-]{8,80}$/u.test(input.key)) throw new OpsDomainError("VALIDATION", "Refresh the page and try again.");
  const id = `spend-total-${input.key}`;
  const existing = await svc.repository.listSpendTotals(input.organizationId);
  if (existing.some((entry) => entry.id === id)) return existing.find((entry) => entry.id === id)!;
  const clashes = activeTotals(existing).filter((entry) => overlaps(entry, input));
  if (clashes.length) throw new SpendTotalOverlapError(clashes);
  const entry: SpendTotal = { id, organizationId: input.organizationId, periodStart: input.periodStart, periodEnd: input.periodEnd, kind: input.kind, amountMinor: input.amountMinor, currency: "USD", note: input.note?.trim() || undefined, enteredByName: input.actor.actorName ?? "Team member", enteredByActorId: input.actor.actorId, createdAt: now };
  await svc.repository.atomicWrite([
    insert("ops_spend_totals", { id, organization_id: entry.organizationId, period_start: entry.periodStart, period_end: entry.periodEnd, kind: entry.kind, amount_minor: entry.amountMinor, currency: entry.currency, note: entry.note, entered_by_name: entry.enteredByName, entered_by_actor_id: entry.enteredByActorId, created_at: now }),
    audit(input.organizationId, entry, "spend_total.entered", input.actor, now),
  ]);
  return entry;
}

/** Withdraws a wrong entry. It stays on record, marked withdrawn, with who did it and why. */
export async function withdrawSpendTotal(svc: OpsCommandServices, input: { organizationId: string; id: string; reason: string; actor: ActorContext }) {
  if (input.actor.organizationId !== input.organizationId) throw new OpsDomainError("FORBIDDEN", "This is outside your organization.");
  const reason = input.reason.trim();
  if (!reason || reason.length > 300) throw new OpsDomainError("VALIDATION", "Say briefly why this entry is wrong.");
  const entry = (await svc.repository.listSpendTotals(input.organizationId)).find((row) => row.id === input.id);
  if (!entry) throw new OpsDomainError("NOT_FOUND", "Entry not found.");
  if (entry.withdrawnAt) return;
  const now = svc.clock?.now() ?? new Date().toISOString();
  await svc.repository.atomicWrite([
    { sql: "UPDATE ops_spend_totals SET withdrawn_at = ?, withdrawn_by_name = ?, withdrawn_reason = ? WHERE organization_id = ? AND id = ? AND withdrawn_at IS NULL", params: [now, input.actor.actorName ?? "Team member", reason, input.organizationId, entry.id] },
    audit(input.organizationId, entry, "spend_total.withdrawn", input.actor, now, { reason }),
  ]);
}

/** What has been entered: the last day covered, the next day to start from, and any missing stretches in between. */
export function spendCoverage(entries: readonly SpendTotal[]) {
  const active = activeTotals(entries);
  if (!active.length) return { lastDay: undefined, nextStart: undefined, gaps: [] as Array<{ from: string; to: string }> };
  const gaps: Array<{ from: string; to: string }> = [];
  let coveredTo = active[0]!.periodEnd;
  for (const entry of active.slice(1)) {
    if (entry.periodStart > addDay(coveredTo, 1)) gaps.push({ from: addDay(coveredTo, 1), to: addDay(entry.periodStart, -1) });
    if (entry.periodEnd > coveredTo) coveredTo = entry.periodEnd;
  }
  return { lastDay: coveredTo, nextStart: addDay(coveredTo, 1), gaps };
}

/**
 * In-house visits that started in the range, each counted once. One visit can cover several work orders, so hours
 * are only ever totaled for the team, never split across jobs.
 */
export function teamVisits(ctx: ReportContext, range: { from: string; to: string }) {
  const stores = new Set(ctx.stores.map((store) => store.id));
  return ctx.fixture.visits.filter((visit) => visit.organizationId === ctx.organizationId && visit.providerKind === "internal" && stores.has(visit.storeId) && visit.checkedInAt.slice(0, 10) >= range.from && visit.checkedInAt.slice(0, 10) <= range.to)
    .sort((a, b) => a.checkedInAt.localeCompare(b.checkedInAt) || a.id.localeCompare(b.id));
}

export interface SpendSplitRow {
  entry: SpendTotal;
  /** Recorded outside-vendor cost in the app for the same days. */
  vendorMinor: number;
  inHouseMinor: number;
  totalMinor: number;
  /** True when the in-house figure was worked out as total minus vendor cost. */
  inHouseEstimated: boolean;
  /** Vendor jobs finished in the range with no cost recorded yet: they make an estimated in-house figure too high. */
  vendorJobsWithoutCost: JobFact[];
  inHouseJobsDone: number;
  vendorJobsDone: number;
  teamHoursOnSite: number;
}

/** Puts each entered total next to the vendor cost the app recorded for exactly the same days. */
export function spendSplit(ctx: ReportContext, entries: readonly SpendTotal[]): SpendSplitRow[] {
  return activeTotals(entries).map((entry) => {
    const range = { from: entry.periodStart, to: entry.periodEnd };
    const vendorMinor = ctx.jobs.reduce((sum, job) => sum + costIn(job, range, "vendor"), 0);
    const done = ctx.jobs.filter((job) => completedIn(job, range) && !job.pm);
    const vendorJobsWithoutCost = done.filter((job) => job.provider === "vendor" && !job.costs.some((line) => line.provider === "vendor"));
    const seconds = teamVisits(ctx, range).reduce((sum, visit) => sum + (visit.observedDurationSeconds ?? 0), 0);
    const inHouseMinor = entry.kind === "in_house" ? entry.amountMinor : Math.max(0, entry.amountMinor - vendorMinor);
    return {
      entry, vendorMinor, inHouseMinor, totalMinor: entry.kind === "total" ? entry.amountMinor : entry.amountMinor + vendorMinor,
      inHouseEstimated: entry.kind === "total", vendorJobsWithoutCost,
      inHouseJobsDone: done.filter((job) => job.provider === "in_house").length, vendorJobsDone: done.filter((job) => job.provider === "vendor").length,
      teamHoursOnSite: Math.round(seconds / 360) / 10,
    };
  });
}

export interface QualityJob { job: JobFact; firstVisitFixed?: boolean; brokeAgain?: boolean; days?: number }
export interface QualityRow { jobs: QualityJob[]; completed: number; firstVisitFix?: number; firstVisitCounted: number; brokeAgain?: number; brokeAgainCounted: number; typicalDays?: number }

/**
 * Repair quality by who did the work, with no money involved: fixed on the first visit, needed another repair within 30 days on
 * the same equipment, and typical days to fix. Planned maintenance is left out; jobs both sides worked on count for neither.
 */
export function repairQuality(ctx: ReportContext, range: { from: string; to: string }, provider: "vendor" | "in_house", category?: string): QualityRow {
  const repairs = ctx.jobs.filter((job) => !job.pm);
  const jobs: QualityJob[] = repairs.filter((job) => !job.blended && job.provider === provider && completedIn(job, range) && (!category || (category === "unclassified" ? !job.category : job.category === category))).map((job) => {
    const own = job.visits.filter((visit) => visit.provider === provider).sort((a, b) => a.at.localeCompare(b.at));
    const done = job.completedAt!.slice(0, 10);
    const watched = Boolean(job.assetId) && addDay(done, 30) <= ctx.today;
    return {
      job,
      firstVisitFixed: own.length ? own[0]!.outcome === "completed" : undefined,
      brokeAgain: watched ? repairs.some((other) => other.id !== job.id && other.assetId === job.assetId && other.createdAt > job.completedAt! && other.createdAt.slice(0, 10) <= addDay(done, 30)) : undefined,
      days: daysToComplete(job),
    };
  }).sort((a, b) => b.job.completedAt!.localeCompare(a.job.completedAt!));
  const visited = jobs.filter((row) => row.firstVisitFixed !== undefined), watched = jobs.filter((row) => row.brokeAgain !== undefined);
  return {
    jobs, completed: jobs.length,
    firstVisitCounted: visited.length, firstVisitFix: visited.length ? visited.filter((row) => row.firstVisitFixed).length / visited.length : undefined,
    brokeAgainCounted: watched.length, brokeAgain: watched.length ? watched.filter((row) => row.brokeAgain).length / watched.length : undefined,
    typicalDays: median(jobs.flatMap((row) => row.days === undefined ? [] : [row.days])),
  };
}

/**
 * Fictional accounting totals for the Clark Pump and Shop showcase: the last four full quarters of total maintenance
 * spend, each a believable in-house amount on top of the vendor cost already in the data. Stable IDs; insert-only.
 */
export function addSpendTotalsDemo(f: OpsFixture): OpsFixture {
  const org = f.organizations[0]?.id;
  if (!org || f.stores.filter((store) => store.organizationId === org).length !== 15 || !f.costLines.length) return f;
  f.spendTotals ??= [];
  const asOf = f.asOf.slice(0, 10);
  const quarterStart = (date: string) => `${date.slice(0, 4)}-${String(Math.floor((Number(date.slice(5, 7)) - 1) / 3) * 3 + 1).padStart(2, "0")}-01`;
  let end = addDay(quarterStart(asOf), -1);
  const inHouse = [25_200_00, 23_800_00, 26_500_00, 24_100_00];
  for (let index = 0; index < 4; index++) {
    const start = quarterStart(end);
    const id = `spend-demo-${start}`;
    if (!f.spendTotals.some((entry) => entry.id === id)) {
      // Vendor cost already recorded for the quarter, so "total minus vendors" lands near a realistic in-house figure.
      const vendor = f.costLines.filter((line) => line.organizationId === org && line.providerType !== "internal" && line.amount.currency === "USD" && line.serviceDate.slice(0, 10) >= start && line.serviceDate.slice(0, 10) <= end).reduce((sum, line) => sum + line.amount.amountMinor, 0);
      f.spendTotals.push({ id, organizationId: org, periodStart: start, periodEnd: end, kind: "total", amountMinor: vendor + inHouse[index]!, currency: "USD", note: "Fictional: maintenance accounts, quarterly close", enteredByName: "Fictional demo setup", createdAt: `${addDay(end, 20) < asOf ? addDay(end, 20) : addDay(asOf, -1)}T15:00:00.000Z` });
    }
    end = addDay(start, -1);
  }
  return f;
}
