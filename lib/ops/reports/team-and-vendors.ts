import { change, count, days, hours, money, pct, shortDate, type ReportDoc, type Section } from "./doc";
import { completedIn, costIn, type ReportContext } from "./facts";
import type { ReportOptions } from "./options";
import type { ReportPeriod } from "./period";
import { jobsFor, pmOnTime, providerLabel, repairsCompleted, scopeLabel, spendIn, techResults, typicalDays, vendorResults } from "./common";

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
type Measure = { value?: number; counted: number; tooFew: boolean };
const rate = (m: Measure) => m.value === undefined ? "—" : `${pct(m.value)}${m.tooFew ? "*" : ""}`;

/** Vendor performance: how each outside vendor did in the period. Outside vendors only. */
export function buildVendorPerformance(ctx: ReportContext, options: ReportOptions, period: ReportPeriod): ReportDoc {
  const vendors = vendorResults(ctx, period).filter(v => v.jobs || v.spend);
  const prior = period.prior ? new Map(vendorResults(ctx, period.prior).map(v => [v.vendorId, v])) : undefined;
  const jobs = vendors.reduce((s, v) => s + v.jobs, 0), spend = vendors.reduce((s, v) => s + v.spend, 0);
  const sure = vendors.filter(v => v.firstFix.value !== undefined && !v.firstFix.tooFew);
  const best = [...sure].sort((a, b) => b.firstFix.value! - a.firstFix.value!)[0];
  const callbacks = vendors.filter(v => v.callbacks.value !== undefined && !v.callbacks.tooFew && v.callbacks.value > 0).sort((a, b) => b.callbacks.value! - a.callbacks.value!)[0];
  const declined = vendors.filter(v => v.declined.hits).sort((a, b) => b.declined.hits - a.declined.hits)[0];
  const sections: Section[] = [{
    kind: "table", id: "records", title: "Each vendor", note: "* fewer than 5 jobs counted, so read it with care. On time: checked in within an hour of the agreed appointment.",
    columns: [{ key: "name", label: "Vendor", width: "wide" }, { key: "jobs", label: "Jobs", align: "end" }, { key: "spend", label: "Spend", align: "end" }, { key: "change", label: `Spend vs ${period.prior?.label ?? "last year"}` },
      { key: "response", label: "Typical reply", align: "end" }, { key: "onTime", label: "On time", align: "end" }, { key: "firstFix", label: "Fixed first visit", align: "end" }, { key: "callbacks", label: "Broke again in 30 days", align: "end" }, { key: "declined", label: "Declined", align: "end" }, { key: "invoice", label: "Invoice issues", align: "end" }],
    rows: vendors.map(v => ({ id: v.vendorId, href: `/app/vendors/${v.vendorId}`, cells: { name: v.name, jobs: count(v.jobs), spend: money(v.spend),
      change: prior ? change(v.spend, prior.get(v.vendorId)?.spend ?? 0, period.prior!.label, { lowerIsBetter: true }).text : "—",
      response: v.response.value === undefined ? "—" : v.response.value < 1 ? "Under 1 h" : `${Math.round(v.response.value)} h`, onTime: rate(v.onTime), firstFix: rate(v.firstFix), callbacks: rate(v.callbacks), declined: count(v.declined.hits), invoice: count(v.invoice.hits) } })),
    totals: { name: "All vendors", jobs: count(jobs), spend: money(spend) }, empty: "No vendor jobs in this period.",
  }];
  if (options.detail === "all") {
    const vendorJobs = ctx.jobs.filter(j => j.vendorId && (j.createdAt.slice(0, 10) >= period.from && j.createdAt.slice(0, 10) <= period.to || completedIn(j, period)));
    sections.push({ kind: "table", id: "jobs", title: "Every vendor job in this period", detailOnly: true,
      columns: [{ key: "number", label: "Work order" }, { key: "vendor", label: "Vendor" }, { key: "store", label: "Store" }, { key: "problem", label: "Problem", width: "wide" }, { key: "opened", label: "Opened" }, { key: "done", label: "Done" }, { key: "cost", label: "Cost", align: "end" }],
      rows: vendorJobs.map(j => ({ id: j.id, href: `/app/work-orders/${j.id}`, cells: { number: j.number, vendor: j.vendorName, store: j.storeName, problem: j.problem, opened: shortDate(j.createdAt), done: shortDate(j.completedAt), cost: money(costIn(j, { from: "0000-01-01", to: "9999-12-31" }, "vendor")) } })) });
  }
  return {
    reportId: "vendor-performance", title: "Vendor performance", audience: "vendor", organizationName: ctx.organizationName, scopeLabel: scopeLabel(ctx, options), period, options,
    purpose: "How each outside vendor did: speed, showing up on time, fixing it the first time, and whether the fix held.",
    howCounted: ["Jobs first sent to each vendor in the period; cancelled jobs are left out.", "Spend is vendor cost recorded in the period.", "Same rules as Vendor scorecards, so the numbers match the screen."],
    highlights: [
      `${count(vendors.length)} vendors handled ${count(jobs)} jobs for ${money(spend)}.`,
      ...(best ? [`${best.name} fixed ${pct(best.firstFix.value!)} of jobs on the first visit, the best this period.`] : []),
      ...(callbacks ? [`${callbacks.name}: ${pct(callbacks.callbacks.value!)} of fixes needed another repair within 30 days.`] : []),
      ...(declined ? [`${declined.name} declined ${count(declined.declined.hits)} ${declined.declined.hits === 1 ? "job" : "jobs"}.`] : []),
    ],
    kpis: [{ label: "Vendors used", value: count(vendors.length) }, { label: "Jobs sent", value: count(jobs) }, { label: "Vendor spend", value: money(spend), changes: period.prior ? [change(spend, spendIn(ctx, period.prior, "vendor"), period.prior.label, { lowerIsBetter: true, asMoney: true })] : undefined }],
    sections, recordsSectionId: options.detail === "all" ? "jobs" : "records",
  };
}

/** In-house team: what the maintenance team did. In-house only; a workload view, never a rating. */
export function buildInHouseTeam(ctx: ReportContext, options: ReportOptions, period: ReportPeriod): ReportDoc {
  const jobs = jobsFor(ctx, "in_house").filter(j => j.provider === "in_house" || j.blended);
  const done = repairsCompleted(jobs, period), donePrior = period.prior ? repairsCompleted(jobs, period.prior) : undefined;
  const techs = techResults(ctx, period).filter(t => t.completed || t.visits || t.openNow);
  const seconds = techs.reduce((s, t) => s + t.seconds, 0), visits = techs.reduce((s, t) => s + t.visits, 0);
  const pm = pmOnTime(ctx, period, "in_house");
  const handed = jobs.filter(j => j.blended && completedIn(j, period));
  const parts = jobs.filter(j => j.open && j.status === "waiting_on_parts");
  const cost = spendIn(ctx, period, "in_house");
  const sections: Section[] = [{
    kind: "table", id: "records", title: "Each technician", note: "Onsite time is approximate, from check-in to check-out. “Needed a return” means a visit ended without finishing the job.",
    columns: [{ key: "name", label: "Technician", width: "wide" }, { key: "completed", label: "Jobs done", align: "end" }, { key: "visits", label: "Store visits", align: "end" }, { key: "onsite", label: "Onsite", align: "end" }, { key: "returns", label: "Needed a return", align: "end" }, { key: "cost", label: "Parts & costs entered", align: "end" }, { key: "open", label: "Open today", align: "end" }],
    rows: techs.map(t => ({ id: t.techId, cells: { name: t.name, completed: count(t.completed), visits: count(t.visits), onsite: hours(t.seconds), returns: count(t.returns), cost: money(t.cost), open: count(t.openNow) } })),
    totals: { name: "Team", completed: count(techs.reduce((s, t) => s + t.completed, 0)), visits: count(visits), onsite: hours(seconds) }, empty: "No in-house work recorded in this period.",
  }];
  if (parts.length) sections.push({ kind: "table", id: "parts", title: "Waiting on parts today",
    columns: [{ key: "number", label: "Work order" }, { key: "store", label: "Store" }, { key: "problem", label: "Problem", width: "wide" }, { key: "tech", label: "Technician" }],
    rows: parts.map(j => ({ id: j.id, href: `/app/work-orders/${j.id}`, cells: { number: j.number, store: j.storeName, problem: j.problem, tech: j.techName ?? "—" } })) });
  if (options.detail === "all") sections.push({ kind: "table", id: "jobs", title: "Every in-house job completed in this period", detailOnly: true,
    columns: [{ key: "number", label: "Work order" }, { key: "store", label: "Store" }, { key: "problem", label: "Problem", width: "wide" }, { key: "by", label: "Done by" }, { key: "done", label: "Done" }, { key: "took", label: "Took", align: "end" }],
    rows: jobs.filter(j => completedIn(j, period)).map(j => ({ id: j.id, href: `/app/work-orders/${j.id}`, cells: { number: j.number, store: j.storeName, problem: j.problem, by: providerLabel(j), done: shortDate(j.completedAt), took: days((Date.parse(j.completedAt!) - Date.parse(j.createdAt)) / 86_400_000) } })) });
  return {
    reportId: "in-house-team", title: "In-house maintenance team", audience: "in_house", organizationName: ctx.organizationName, scopeLabel: scopeLabel(ctx, options), period, options,
    purpose: "What the in-house team got done, how long it took, and what is holding work up.",
    howCounted: ["Jobs assigned to the in-house team, including jobs later handed to an outside vendor.", "Time to fix runs from when a job was opened to when it was marked done (middle job).", "This is a workload view, not a performance rating."],
    highlights: [
      `The team completed ${count(done.length)} repairs${donePrior ? ` (${lowerFirst(change(done.length, donePrior.length, period.prior!.label).text)})` : ""} across ${count(visits)} store visits, about ${hours(seconds)} onsite.`,
      ...(handed.length ? [`${count(handed.length)} ${handed.length === 1 ? "job was" : "jobs were"} started in-house and finished with an outside vendor.`] : []),
      ...(parts.length ? [`${count(parts.length)} in-house ${parts.length === 1 ? "job is" : "jobs are"} waiting on parts today.`] : []),
      ...(pm.due ? [`Planned maintenance: ${pm.done} of ${pm.due} done in their window.`] : []),
    ],
    kpis: [
      { label: "Repairs completed", value: count(done.length), changes: donePrior ? [{ ...change(done.length, donePrior.length, period.prior!.label), tone: "neutral" }] : undefined },
      { label: "Typical time to fix", value: days(typicalDays(done)) },
      { label: "Store visits", value: count(visits), note: `About ${hours(seconds)} onsite` },
      { label: "Parts & costs entered", value: money(cost) },
    ],
    sections, recordsSectionId: options.detail === "all" ? "jobs" : "records",
  };
}
