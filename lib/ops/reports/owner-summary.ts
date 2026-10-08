import { change, count, days, hours, money, pct, shortDate, type ReportDoc, type Row, type Section } from "./doc";
import { costIn, completedIn, type ReportContext } from "./facts";
import type { ReportOptions } from "./options";
import type { ReportPeriod } from "./period";
import { categoryLabel, jobsFor, pmOnTime, providerLabel, repairsCompleted, repeatProblems, replaceCandidates, scopeLabel, spendBy, spendIn, techResults, typicalDays, vendorResults } from "./common";

/**
 * Owner summary: where the maintenance money went, what changed, and the few things that need a decision.
 * Written for an owner or senior leader who reads it in two minutes; every figure comes from source records.
 */
export function buildOwnerSummary(ctx: ReportContext, options: ReportOptions, period: ReportPeriod): ReportDoc {
  const work = options.work, all = options.detail === "all";
  const prior = period.prior, ly = period.lastYear;
  const jobs = jobsFor(ctx, work);

  const spend = spendIn(ctx, period, work), spendPrior = prior ? spendIn(ctx, prior, work) : undefined, spendLy = spendIn(ctx, ly, work);
  const repairs = repairsCompleted(jobs, period), repairsPrior = prior ? repairsCompleted(jobs, prior) : undefined;
  const typical = typicalDays(repairs), typicalPrior = repairsPrior ? typicalDays(repairsPrior) : undefined;
  const open = jobs.filter(j => j.open), pastDue = open.filter(j => j.pastDue);
  const pm = pmOnTime(ctx, period, work);
  const repeats = repeatProblems(ctx, period.to, work);
  const replace = work === "vendor" || work === "in_house" ? [] : replaceCandidates(ctx);

  const kpis: ReportDoc["kpis"] = [
    { label: "Maintenance spend", value: money(spend), changes: [
      ...(spendPrior !== undefined ? [change(spend, spendPrior, prior!.label, { lowerIsBetter: true, asMoney: true })] : []),
      change(spend, spendLy, ly.label, { lowerIsBetter: true, asMoney: true })] },
    { label: "Repairs completed", value: count(repairs.length), changes: repairsPrior ? [{ ...change(repairs.length, repairsPrior.length, prior!.label), tone: "neutral" }] : undefined },
    { label: "Typical time to fix", value: days(typical), note: "Opened to done, middle job", changes: typical !== undefined && typicalPrior !== undefined ? [change(typical, typicalPrior, prior!.label, { lowerIsBetter: true })] : undefined },
    { label: "Open today", value: count(open.length), note: pastDue.length ? `${count(pastDue.length)} past due` : "None past due" },
    { label: "Planned maintenance on time", value: pm.due ? pct(pm.done / pm.due) : "—", note: pm.due ? `${pm.done} of ${pm.due} done in their window` : "None due in this period" },
    { label: "Repeat problems", value: count(repeats.length), note: "3+ repair calls in 60 days" },
  ];

  // What changed: the store and service area that moved the most.
  const byStore = spendBy(ctx, period, work, j => j.storeId), byStorePrior = prior ? spendBy(ctx, prior, work, j => j.storeId) : new Map<string, number>();
  const byArea = spendBy(ctx, period, work, j => j.category ?? "unclassified"), byAreaPrior = prior ? spendBy(ctx, prior, work, j => j.category ?? "unclassified") : new Map<string, number>();
  const biggestMove = (now: Map<string, number>, before: Map<string, number>) => [...new Set([...now.keys(), ...before.keys()])]
    .map(k => ({ k, d: (now.get(k) ?? 0) - (before.get(k) ?? 0) })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];

  const highlights: string[] = [];
  if (spendPrior !== undefined && spendPrior > 0) {
    const ratio = (spend - spendPrior) / spendPrior, move = biggestMove(byStore, byStorePrior);
    if (Math.abs(ratio) >= 0.1) highlights.push(`Spending was ${ratio > 0 ? "up" : "down"} ${pct(Math.abs(ratio))} from ${prior!.label} (${money(Math.abs(spend - spendPrior))} ${ratio > 0 ? "more" : "less"}).${move && Math.abs(move.d) > 0 ? ` The biggest change was ${ctx.storeLabel(move.k)} (${move.d > 0 ? "+" : "−"}${money(Math.abs(move.d))}).` : ""}`);
    else highlights.push(`Spending was about level with ${prior!.label} (${money(spend)} vs ${money(spendPrior)}).`);
  }
  if (work === "both" && spend > 0) {
    const vendorSpend = spendIn(ctx, period, "vendor"), inHouseRepairs = repairs.filter(j => j.provider === "in_house").length;
    highlights.push(`Outside vendors were ${pct(vendorSpend / spend)} of spending; the in-house team completed ${count(inHouseRepairs)} of ${count(repairs.length)} repairs.`);
  }
  if (repeats[0]) highlights.push(`${repeats[0].name} at ${repeats[0].store} needed ${repeats[0].calls} repair calls in 60 days (${money(repeats[0].cost)}).${replace.some(r => r.id === repeats[0]!.assetId) ? " It is waiting on a repair-or-replace decision." : ""}`);
  if (pastDue.length) {
    const oldest = [...pastDue].sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""))[0]!;
    highlights.push(`${count(pastDue.length)} open ${pastDue.length === 1 ? "job is" : "jobs are"} past due. The oldest is ${oldest.number} at ${oldest.storeName}, due ${shortDate(oldest.dueAt)}.`);
  }
  if (pm.due && pm.missed) highlights.push(`${count(pm.missed)} planned maintenance ${pm.missed === 1 ? "visit was" : "visits were"} missed or late (${pm.done} of ${pm.due} on time).`);
  if (replace.length) highlights.push(`${count(replace.length)} ${replace.length === 1 ? "unit is" : "units are"} waiting on a repair-or-replace decision.`);

  const sections: Section[] = [];
  if (work === "both") {
    const part = (p: "vendor" | "in_house"): Extract<Section, { kind: "split" }>["parts"][number] => {
      const done = repairs.filter(j => j.provider === p), cost = spendIn(ctx, period, p);
      const visits = ctx.jobs.flatMap(j => j.visits).filter(v => v.provider === p && v.at.slice(0, 10) >= period.from && v.at.slice(0, 10) <= period.to);
      return { label: p === "vendor" ? "Outside vendors" : "In-house team", tone: p, value: cost, display: money(cost),
        facts: [`${count(done.length)} repairs completed`, `Typical time to fix: ${days(typicalDays(done))}`, `${count(visits.length)} store visits${p === "in_house" ? ` · about ${hours(visits.reduce((s, v) => s + (v.seconds ?? 0), 0))} onsite` : ""}`] };
    };
    sections.push({ kind: "split", id: "who", title: "Who did the work", note: "Spending is recorded work cost. In-house cost is what was entered on in-house jobs (parts, materials, time where recorded).", parts: [part("vendor"), part("in_house")] });
  }

  const storeItems = [...byStore.entries()].sort((a, b) => b[1] - a[1]);
  const shownStores = all ? storeItems : storeItems.slice(0, 10);
  const otherStores = storeItems.slice(shownStores.length).reduce((s, [, v]) => s + v, 0);
  sections.push({ kind: "bars", id: "stores", title: "Spending by store", note: storeItems.length ? `Average per store: ${money(spend / Math.max(1, ctx.stores.length))}.` : undefined, empty: "No recorded spending in this period.",
    items: [...shownStores.map(([id, value]) => ({ label: ctx.storeLabel(id), value, display: money(value), extra: prior ? change(value, byStorePrior.get(id) ?? 0, prior.label, { lowerIsBetter: true }).text : undefined })),
      ...(otherStores ? [{ label: `Other ${storeItems.length - shownStores.length} stores`, value: otherStores, display: money(otherStores), other: true }] : [])] });

  const areaItems = [...byArea.entries()].sort((a, b) => b[1] - a[1]);
  sections.push({ kind: "bars", id: "areas", title: "Spending by type of work", empty: "No recorded spending in this period.",
    items: areaItems.map(([k, value]) => ({ label: categoryLabel(k === "unclassified" ? undefined : k), value, display: money(value), extra: `${pct(value / Math.max(1, spend))} of spend${prior ? ` · ${change(value, byAreaPrior.get(k) ?? 0, prior.label, { lowerIsBetter: true }).text}` : ""}` })) });

  const costly = jobs.map(job => ({ job, cost: costIn(job, period, work) })).filter(r => r.cost > 0).sort((a, b) => b.cost - a.cost);
  const jobRow = ({ job, cost }: { job: typeof jobs[number]; cost: number }): Row => ({ id: job.id, href: `/app/work-orders/${job.id}`,
    cells: { number: job.number, store: job.storeName, problem: job.problem, by: providerLabel(job), cost: money(cost) }, sub: { problem: job.assetName } });
  const jobColumns = [{ key: "number", label: "Work order" }, { key: "store", label: "Store" }, { key: "problem", label: "Problem", width: "wide" as const }, { key: "by", label: "Done by" }, { key: "cost", label: "Cost", align: "end" as const }];
  sections.push({ kind: "table", id: "costly", title: "Most expensive jobs", columns: jobColumns, rows: costly.slice(0, 5).map(jobRow), empty: "No job had recorded cost in this period." });

  sections.push({ kind: "table", id: "repeats", title: "Repeat problems", note: "Equipment with 3 or more repair calls in the 60 days up to the end of the period. Often worth a closer look or a repair-or-replace decision.",
    columns: [{ key: "name", label: "Equipment", width: "wide" }, { key: "store", label: "Store" }, { key: "calls", label: "Calls", align: "end" }, { key: "cost", label: "Cost (60 days)", align: "end" }, { key: "last", label: "Last call" }],
    rows: (all ? repeats : repeats.slice(0, 8)).map(r => ({ id: r.assetId, href: `/app/equipment/${r.assetId}`, cells: { name: r.name, store: r.store, calls: count(r.calls), cost: money(r.cost), last: shortDate(r.last) } })),
    empty: "No equipment had 3 or more repair calls in 60 days.", more: !all && repeats.length > 8 ? `${repeats.length - 8} more in the full version` : undefined });

  if (replace.length) sections.push({ kind: "table", id: "replace", title: "Waiting on a repair-or-replace decision",
    columns: [{ key: "name", label: "Equipment", width: "wide" }, { key: "store", label: "Store" }, { key: "problem", label: "Current problem", width: "wide" }, { key: "repair", label: "Repair estimate", align: "end" }],
    rows: replace.slice(0, all ? 100 : 6).map(r => ({ id: r.id, href: `/app/equipment/${r.id}`, cells: { name: r.name, store: `Store ${r.storeNumber}`, problem: r.problem, repair: r.repairMinor ? money(r.repairMinor) : "—" } })) });

  if (work !== "in_house") {
    const vendors = vendorResults(ctx, period).filter(v => v.jobs || v.spend);
    const rate = (m: { value?: number; counted: number; tooFew: boolean }) => m.value === undefined ? "—" : `${pct(m.value)}${m.tooFew ? "*" : ""}`;
    sections.push({ kind: "table", id: "vendors", title: "Outside vendors", note: "Jobs sent in the period. * means fewer than 5 jobs counted, so read it with care. Same rules as Vendor scorecards.",
      columns: [{ key: "name", label: "Vendor", width: "wide" }, { key: "jobs", label: "Jobs", align: "end" }, { key: "spend", label: "Spend", align: "end" }, { key: "firstFix", label: "Fixed first visit", align: "end" }, { key: "onTime", label: "On time", align: "end" }, { key: "callbacks", label: "Broke again in 30 days", align: "end" }],
      rows: vendors.map(v => ({ id: v.vendorId, href: `/app/vendors/${v.vendorId}`, cells: { name: v.name, jobs: count(v.jobs), spend: money(v.spend), firstFix: rate(v.firstFix), onTime: rate(v.onTime), callbacks: rate(v.callbacks) } })),
      empty: "No vendor jobs in this period." });
  }
  if (work !== "vendor") {
    const techs = techResults(ctx, period).filter(t => t.completed || t.visits);
    sections.push({ kind: "table", id: "team", title: "In-house team", note: "A workload view, not a performance rating. Onsite time is approximate, from check-in to check-out.",
      columns: [{ key: "name", label: "Technician", width: "wide" }, { key: "completed", label: "Jobs done", align: "end" }, { key: "visits", label: "Store visits", align: "end" }, { key: "onsite", label: "Onsite", align: "end" }, { key: "returns", label: "Needed a return", align: "end" }, { key: "open", label: "Open today", align: "end" }],
      rows: techs.map(t => ({ id: t.techId, cells: { name: t.name, completed: count(t.completed), visits: count(t.visits), onsite: hours(t.seconds), returns: count(t.returns), open: count(t.openNow) } })),
      empty: "No in-house work recorded in this period." });
  }

  const late = [...pastDue].sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));
  sections.push({ kind: "table", id: "pastdue", title: "Past due today", columns: [{ key: "number", label: "Work order" }, { key: "store", label: "Store" }, { key: "problem", label: "Problem", width: "wide" }, { key: "by", label: "With" }, { key: "due", label: "Was due" }],
    rows: (all ? late : late.slice(0, 5)).map(j => ({ id: j.id, href: `/app/work-orders/${j.id}`, cells: { number: j.number, store: j.storeName, problem: j.problem, by: providerLabel(j), due: shortDate(j.dueAt) } })),
    empty: "Nothing is past due.", more: !all && late.length > 5 ? `${late.length - 5} more in the full version` : undefined });

  if (all) {
    sections.push({ kind: "table", id: "records", title: "Every job with cost in this period", detailOnly: true, columns: jobColumns, rows: costly.map(jobRow),
      totals: { number: "Total", cost: money(costly.reduce((s, r) => s + r.cost, 0)) } });
    const done = jobs.filter(j => completedIn(j, period));
    sections.push({ kind: "table", id: "completed", title: "Every job completed in this period", detailOnly: true,
      columns: [{ key: "number", label: "Work order" }, { key: "store", label: "Store" }, { key: "problem", label: "Problem", width: "wide" }, { key: "by", label: "Done by" }, { key: "done", label: "Done" }, { key: "took", label: "Took", align: "end" }],
      rows: done.map(j => ({ id: j.id, href: `/app/work-orders/${j.id}`, cells: { number: j.number, store: j.storeName, problem: j.problem, by: providerLabel(j), done: shortDate(j.completedAt), took: days((Date.parse(j.completedAt!) - Date.parse(j.createdAt)) / 86_400_000) } })) });
  }

  return {
    reportId: "owner-summary", title: "Owner summary", audience: "both", organizationName: ctx.organizationName, scopeLabel: scopeLabel(ctx, options), period, options,
    purpose: "Where the maintenance money went, what changed, and what needs a decision.",
    howCounted: [
      "Spending is recorded work cost, by the date the work was done. Invoices, quotes and approved limits are not added in.",
      "Repairs are unplanned jobs. Planned maintenance is counted on its own.",
      "Time to fix runs from when a job was opened to when it was marked done; the middle job is shown so one slow job doesn't skew it.",
      "Open and past-due counts are as of today, not the end of the period.",
      `Compared with ${[prior?.label, ly.label].filter(Boolean).join(" and ")}.`,
    ],
    highlights: highlights.slice(0, 5), kpis, sections, recordsSectionId: all ? "records" : "costly",
    notes: ["This report does not approve or pay invoices."],
  };
}
