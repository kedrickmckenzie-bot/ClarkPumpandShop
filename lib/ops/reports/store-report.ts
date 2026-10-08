import { change, count, days, money, pct, shortDate, type ReportDoc, type Section } from "./doc";
import { costIn, completedIn, jobMatchesWork, type ReportContext } from "./facts";
import type { ReportOptions } from "./options";
import type { ReportPeriod } from "./period";
import { categoryLabel, pmOnTime, providerLabel, repairsCompleted, repeatProblems, scopeLabel, spendBy, typicalDays } from "./common";

/**
 * Store report. One store: what happened there and how it compares with the average store.
 * Several stores: every store side by side, so the outliers stand out.
 */
export function buildStoreReport(ctx: ReportContext, options: ReportOptions, period: ReportPeriod, companyAverage: () => number): ReportDoc {
  const work = options.work, all = options.detail === "all";
  const prior = period.prior;
  const jobs = ctx.jobs.filter(j => jobMatchesWork(j, work));
  const spend = spendBy(ctx, period, work, j => j.storeId), spendPrior = prior ? spendBy(ctx, prior, work, j => j.storeId) : new Map<string, number>();
  const base = { reportId: "store-report", audience: "both" as const, organizationName: ctx.organizationName, scopeLabel: scopeLabel(ctx, options), period, options };

  if (ctx.stores.length !== 1) {
    const rows = ctx.stores.map(store => {
      const mine = jobs.filter(j => j.storeId === store.id);
      const pm = pmOnTime({ ...ctx, stores: [store] }, period, work);
      return { store, spend: spend.get(store.id) ?? 0, before: spendPrior.get(store.id) ?? 0, repairs: repairsCompleted(mine, period).length,
        open: mine.filter(j => j.open).length, pastDue: mine.filter(j => j.pastDue).length, pm, repeats: repeatProblems({ ...ctx, jobs: mine }, period.to, work).length };
    }).sort((a, b) => b.spend - a.spend);
    const avg = rows.reduce((s, r) => s + r.spend, 0) / Math.max(1, rows.length);
    const high = rows.filter(r => avg && r.spend > avg * 1.5);
    return { ...base, title: "Store comparison",
      purpose: "Every store side by side: spending, repairs, open work and planned maintenance.",
      howCounted: ["Spending is recorded work cost by the date the work was done.", "Open and past-due counts are as of today.", "Pick one store to get its own report."],
      highlights: [
        `Average spend per store: ${money(avg)}.`,
        ...(high.length ? [`${high.map(r => ctx.storeLabel(r.store.id)).join(", ")} spent more than 1.5× the average.`] : []),
        ...(rows.filter(r => r.pastDue).length ? [`${rows.filter(r => r.pastDue).length} stores have past-due work today.`] : []),
      ],
      kpis: [{ label: "Stores", value: count(rows.length) }, { label: "Average spend per store", value: money(avg) }, { label: "Open today", value: count(rows.reduce((s, r) => s + r.open, 0)) }],
      sections: [{ kind: "table", id: "records", title: "Each store",
        columns: [{ key: "store", label: "Store", width: "wide" }, { key: "spend", label: "Spend", align: "end" }, { key: "vs", label: `vs ${prior?.label ?? "last year"}` }, { key: "repairs", label: "Repairs done", align: "end" }, { key: "open", label: "Open", align: "end" }, { key: "pastDue", label: "Past due", align: "end" }, { key: "pm", label: "PM on time", align: "end" }, { key: "repeats", label: "Repeat problems", align: "end" }],
        rows: rows.map(r => ({ id: r.store.id, href: `/app/stores/${r.store.id}`, tone: avg && r.spend > avg * 1.5 ? "warn" as const : undefined,
          cells: { store: ctx.storeLabel(r.store.id), spend: money(r.spend), vs: prior ? change(r.spend, r.before, prior.label, { lowerIsBetter: true }).text : "—", repairs: count(r.repairs), open: count(r.open), pastDue: count(r.pastDue), pm: r.pm.due ? `${r.pm.done}/${r.pm.due}` : "—", repeats: count(r.repeats) } })),
        totals: { store: "All stores", spend: money(rows.reduce((s, r) => s + r.spend, 0)), repairs: count(rows.reduce((s, r) => s + r.repairs, 0)), open: count(rows.reduce((s, r) => s + r.open, 0)) } }],
      recordsSectionId: "records" };
  }

  const store = ctx.stores[0]!;
  const mine = jobs;
  const total = spend.get(store.id) ?? 0, before = spendPrior.get(store.id) ?? 0, avg = companyAverage();
  const repairs = repairsCompleted(mine, period), open = mine.filter(j => j.open), pastDue = open.filter(j => j.pastDue);
  const pm = pmOnTime(ctx, period, work), repeats = repeatProblems(ctx, period.to, work);
  const byArea = spendBy(ctx, period, work, j => j.category ?? "unclassified");
  const byAsset = new Map<string, { name: string; calls: number; cost: number }>();
  for (const job of mine) if (job.assetId && !job.pm && job.createdAt.slice(0, 10) >= period.from && job.createdAt.slice(0, 10) <= period.to) {
    const r = byAsset.get(job.assetId) ?? { name: job.assetName ?? "Equipment", calls: 0, cost: 0 }; r.calls++; r.cost += costIn(job, period, work); byAsset.set(job.assetId, r);
  }
  const done = mine.filter(j => completedIn(j, period));
  const jobCols = [{ key: "number", label: "Work order" }, { key: "problem", label: "Problem", width: "wide" as const }, { key: "by", label: "With" }, { key: "date", label: "Date" }, { key: "cost", label: "Cost", align: "end" as const }];
  const sections: Section[] = [
    { kind: "bars", id: "areas", title: "Spending by type of work", empty: "No recorded spending in this period.", items: [...byArea.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: categoryLabel(k === "unclassified" ? undefined : k), value: v, display: money(v), extra: `${pct(v / Math.max(1, total))}` })) },
    { kind: "table", id: "equipment", title: "Equipment that needed the most repairs", columns: [{ key: "name", label: "Equipment", width: "wide" }, { key: "calls", label: "Repair calls", align: "end" }, { key: "cost", label: "Cost", align: "end" }],
      rows: [...byAsset.entries()].sort((a, b) => b[1].calls - a[1].calls || b[1].cost - a[1].cost).slice(0, all ? 50 : 5).map(([id, r]) => ({ id, href: `/app/equipment/${id}`, cells: { name: r.name, calls: count(r.calls), cost: money(r.cost) } })), empty: "No equipment repairs in this period." },
    { kind: "table", id: "open", title: "Open today", columns: jobCols, rows: open.sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? "")).slice(0, all ? 500 : 10).map(j => ({ id: j.id, href: `/app/work-orders/${j.id}`, tone: j.pastDue ? "warn" as const : undefined, cells: { number: j.number, problem: j.problem, by: providerLabel(j), date: j.pastDue ? `Past due · ${shortDate(j.dueAt)}` : `Due ${shortDate(j.dueAt)}`, cost: money(costIn(j, { from: "0000-01-01", to: "9999-12-31" }, work)) } })),
      empty: "Nothing open.", more: !all && open.length > 10 ? `${open.length - 10} more in the full version` : undefined },
    { kind: "table", id: "records", title: "Completed in this period", columns: jobCols,
      rows: done.slice(0, all ? 1000 : 10).map(j => ({ id: j.id, href: `/app/work-orders/${j.id}`, cells: { number: j.number, problem: j.problem, by: providerLabel(j), date: shortDate(j.completedAt), cost: money(costIn(j, period, work)) } })),
      empty: "Nothing completed in this period.", more: !all && done.length > 10 ? `${done.length - 10} more in the full version` : undefined },
  ];
  return { ...base, title: `Store report · ${ctx.storeLabel(store.id)}`,
    purpose: "What happened at this store, what it cost, and how it compares with the average store.",
    howCounted: ["Spending is recorded work cost by the date the work was done.", `The average store figure covers every store you can see (${money(avg)} this period).`, "Open and past-due counts are as of today."],
    highlights: [
      `Spending was ${money(total)}, ${avg ? `${total > avg ? `${pct(total / avg - 1)} above` : `${pct(1 - total / avg)} below`} the average store` : "with no other stores to compare"}.`,
      ...(prior && (total || before) ? [`Compared with ${prior.label}: ${change(total, before, prior.label, { lowerIsBetter: true, asMoney: true }).text.replace(/ vs .*$/, "").toLowerCase()}.`] : []),
      ...(repeats[0] ? [`${repeats[0].name} needed ${repeats[0].calls} repair calls in 60 days (${money(repeats[0].cost)}).`] : []),
      ...(pastDue.length ? [`${count(pastDue.length)} open ${pastDue.length === 1 ? "job is" : "jobs are"} past due.`] : []),
    ],
    kpis: [
      { label: "Spending", value: money(total), changes: prior ? [change(total, before, prior.label, { lowerIsBetter: true, asMoney: true })] : undefined, note: `Average store: ${money(avg)}` },
      { label: "Repairs completed", value: count(repairs.length) },
      { label: "Typical time to fix", value: days(typicalDays(repairs)) },
      { label: "Open today", value: count(open.length), note: pastDue.length ? `${count(pastDue.length)} past due` : "None past due" },
      { label: "Planned maintenance on time", value: pm.due ? pct(pm.done / pm.due) : "—", note: pm.due ? `${pm.done} of ${pm.due}` : "None due" },
    ],
    sections, recordsSectionId: "records" };
}
