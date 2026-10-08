import { vendorJobFactsFromFixture, summarizeMeasure } from "../vendor-scorecard";
import { REPEAT_DAYS } from "../equipment-issues";
import { lifecycleQueueFromFixture } from "../lifecycle-queue";
import { pmScheduleState } from "../pm-schedule-query";
import { addDays, type DateRange } from "./period";
import { completedIn, costIn, daysToComplete, jobMatchesWork, median, type JobFact, type Provider, type ReportContext } from "./facts";
import { WORK_LABELS, type ReportOptions, type WorkFilter } from "./options";
import { titleCase } from "./doc";

export function scopeLabel(ctx: ReportContext, options: ReportOptions) {
  const where = options.store && ctx.stores.length === 1 ? ctx.storeLabel(ctx.stores[0]!.id)
    : options.region ? `${ctx.fixture.regions.find(r => r.id === options.region)?.name ?? "One area"} · ${ctx.stores.length} stores`
    : `All ${ctx.stores.length} stores`;
  return `${where} · ${WORK_LABELS[options.work]}`;
}

export const jobsFor = (ctx: ReportContext, work: WorkFilter) => ctx.jobs.filter(job => jobMatchesWork(job, work));
export const spendIn = (ctx: ReportContext, range: DateRange, work: WorkFilter) => ctx.jobs.reduce((sum, job) => sum + costIn(job, range, work), 0);
export const repairsCompleted = (jobs: JobFact[], range: DateRange) => jobs.filter(job => !job.pm && completedIn(job, range));
export const typicalDays = (jobs: JobFact[]) => median(jobs.flatMap(job => { const d = daysToComplete(job); return d === undefined ? [] : [d]; }));

/** Spend per key (store, service area, vendor...) in a range. */
export function spendBy(ctx: ReportContext, range: DateRange, work: WorkFilter, key: (job: JobFact) => string | undefined) {
  const totals = new Map<string, number>();
  for (const job of ctx.jobs) {
    const amount = costIn(job, range, work), k = key(job);
    if (amount && k) totals.set(k, (totals.get(k) ?? 0) + amount);
  }
  return totals;
}

/** Equipment with 3+ unplanned repair calls in the 60 days ending `to`. */
export function repeatProblems(ctx: ReportContext, to: string, work: WorkFilter) {
  const window = { from: addDays(to, -(REPEAT_DAYS - 1)), to, label: "" };
  const byAsset = new Map<string, JobFact[]>();
  for (const job of jobsFor(ctx, work)) {
    if (!job.assetId || job.pm || job.status === "cancelled" || job.createdAt.slice(0, 10) < window.from || job.createdAt.slice(0, 10) > window.to) continue;
    byAsset.set(job.assetId, [...(byAsset.get(job.assetId) ?? []), job]);
  }
  return [...byAsset.entries()].filter(([, jobs]) => jobs.length >= 3).map(([assetId, jobs]) => ({
    assetId, name: jobs[0]!.assetName ?? "Equipment", store: jobs[0]!.storeName, calls: jobs.length,
    cost: jobs.reduce((sum, job) => sum + costIn(job, window, work), 0), last: jobs.map(j => j.createdAt).sort().at(-1)!,
  })).sort((a, b) => b.calls - a.calls || b.cost - a.cost);
}

/** Planned maintenance whose window closed in the range: done on time vs due. */
export function pmOnTime(ctx: ReportContext, range: DateRange, work: WorkFilter) {
  const storeIds = new Set(ctx.stores.map(s => s.id)), jobById = new Map(ctx.jobs.map(j => [j.id, j]));
  const rows = ctx.fixture.pmOccurrences.filter(p => p.organizationId === ctx.organizationId && storeIds.has(p.storeId)
    && p.windowEndsAt.slice(0, 10) >= range.from && p.windowEndsAt.slice(0, 10) <= range.to && p.windowEndsAt < ctx.now
    && !["waived", "cancelled"].includes(p.status)
    && (work === "both" || (p.workOrderId && jobById.get(p.workOrderId) && jobMatchesWork(jobById.get(p.workOrderId)!, work))));
  const done = rows.filter(p => pmScheduleState(p, ctx.now) === "completed");
  return { due: rows.length, done: done.length, missed: rows.length - done.length };
}

export function replaceCandidates(ctx: ReportContext) {
  const scope = { organizationId: ctx.organizationId, storeIds: ctx.stores.map(s => s.id) };
  return lifecycleQueueFromFixture(ctx.fixture, scope, { view: "review" }).items;
}

/** Vendor results in a range, using the same rules as the vendor scorecards. */
export function vendorResults(ctx: ReportContext, range: DateRange) {
  const scope = { organizationId: ctx.organizationId, storeIds: ctx.stores.map(s => s.id) };
  const facts = vendorJobFactsFromFixture(ctx.fixture, scope, { from: range.from, to: range.to });
  const byVendor = new Map<string, typeof facts>();
  for (const fact of facts) byVendor.set(fact.vendorId, [...(byVendor.get(fact.vendorId) ?? []), fact]);
  // Each vendor cost line counts for the vendor it names, or the job's vendor when older lines name none.
  const spend = new Map<string, number>();
  for (const job of ctx.jobs) for (const line of job.costs) {
    const vendorId = line.vendorId ?? job.vendorId;
    if (line.provider === "vendor" && vendorId && line.date >= range.from && line.date <= range.to) spend.set(vendorId, (spend.get(vendorId) ?? 0) + line.amountMinor);
  }
  return [...new Set([...byVendor.keys(), ...spend.keys()])].map(vendorId => {
    const rows = byVendor.get(vendorId) ?? [];
    const m = (key: Parameters<typeof summarizeMeasure>[1]) => summarizeMeasure(rows, key, ctx.now);
    return { vendorId, name: ctx.vendorName(vendorId), jobs: rows.length, completed: rows.filter(r => r.completedAt).length, spend: spend.get(vendorId) ?? 0,
      response: m("response"), onTime: m("onTime"), firstFix: m("firstFix"), callbacks: m("callbacks"), declined: m("declined"), invoice: m("invoice"), cost: m("cost") };
  }).sort((a, b) => b.spend - a.spend || b.jobs - a.jobs);
}

/** In-house technicians' work in a range. A workload view, not a rating. */
export function techResults(ctx: ReportContext, range: DateRange) {
  const rows = new Map<string, { techId: string; name: string; completed: number; visits: number; seconds: number; returns: number; cost: number; openNow: number }>();
  const row = (techId: string) => rows.get(techId) ?? rows.set(techId, { techId, name: ctx.personName(techId), completed: 0, visits: 0, seconds: 0, returns: 0, cost: 0, openNow: 0 }).get(techId)!;
  for (const job of ctx.jobs) {
    for (const visit of job.visits) if (visit.provider === "in_house" && visit.techId && visit.at.slice(0, 10) >= range.from && visit.at.slice(0, 10) <= range.to) {
      const r = row(visit.techId); r.visits++; r.seconds += visit.seconds ?? 0;
      if (visit.outcome && visit.outcome !== "completed") r.returns++;
    }
    if (job.techId && job.provider === "in_house") {
      if (completedIn(job, range)) row(job.techId).completed++;
      if (job.open) row(job.techId).openNow++;
      const cost = costIn(job, range, "in_house");
      if (cost) row(job.techId).cost += cost;
    }
  }
  // Technicians always appear; anyone else (a store manager with an inspection task) only when they did work in the period.
  const technicians = new Set(ctx.fixture.memberships.filter(m => m.organizationId === ctx.organizationId && ["internal_technician", "field_manager"].includes(m.role)).map(m => m.id));
  return [...rows.values()].filter(r => technicians.has(r.techId) || r.completed || r.visits)
    .sort((a, b) => b.completed - a.completed || b.visits - a.visits || a.name.localeCompare(b.name));
}

export const providerLabel = (job: JobFact) => job.provider === "vendor" ? job.vendorName ?? "Outside vendor" : job.provider === "in_house" ? (job.techName ? `In-house · ${job.techName}` : "In-house team") : "Not assigned";
export const categoryLabel = (key?: string) => titleCase(key);
export const providerOf = (p: Provider) => p === "vendor" ? "Outside vendors" : "In-house team";
