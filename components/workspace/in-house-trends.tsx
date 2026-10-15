import Link from "next/link";
import { getRequestOpsFixtureSnapshot } from "@/app/app/_data/request-data";
import type { OperatorSession } from "@/components/ops/data-contract";
import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import { civilDate } from "@/lib/ops/dispatch-calendar";
import { formatOperationsDate } from "@/lib/ops/local-time";
import { buildReportContext, completedIn, costIn, type JobFact, type ReportContext } from "@/lib/ops/reports/facts";
import { money } from "@/lib/ops/reports/doc";
import { activeTotals, addDay, repairQuality, spendSplit, teamVisits, type QualityJob, type SpendSplitRow } from "@/lib/ops/spend-totals";
import { TrendTabs } from "./trend-tabs";
import styles from "./in-house-trends.module.css";

type Query = Record<string, string | string[] | undefined>;
type Range = { from: string; to: string };
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const day = (value: string) => formatOperationsDate(`${value}T12:00:00Z`, "UTC");
const rangeLabel = (range: Range) => `${day(range.from)} – ${day(range.to)}`;
const pct = (value?: number) => value === undefined ? "—" : `${Math.round(value * 100)}%`;
const days = (value?: number) => value === undefined ? "—" : value < 1 ? "Same day" : `${Math.round(value * 10) / 10} days`;
const hours = (seconds: number) => `${Math.round(seconds / 360) / 10} h`;
const PERIODS = [3, 6, 12, 24] as const;

/** Calendar quarters covering the chosen months, used when accounting hasn't entered totals for those dates. */
function quarters(today: string, months: number): Range[] {
  const out: Range[] = [];
  let year = Number(today.slice(0, 4)), q = Math.floor((Number(today.slice(5, 7)) - 1) / 3);
  for (let i = 0; i < Math.max(1, Math.ceil(months / 3)); i++) {
    q -= 1; if (q < 0) { q = 3; year -= 1; }
    const from = `${year}-${String(q * 3 + 1).padStart(2, "0")}-01`;
    out.unshift({ from, to: addDay(q === 3 ? `${year + 1}-01-01` : `${year}-${String(q * 3 + 4).padStart(2, "0")}-01`, -1) });
  }
  return out;
}

/**
 * In-house vs vendors. Spend uses accounting's entered totals for exactly the dates they cover; workload and repair
 * quality come from the work records. No per-job or per-hour cost: jobs vary too much and visits cover several jobs.
 */
export default async function InHouseTrends({ session, query }: { session: OperatorSession; query: Query }) {
  const repository = await getServerOpsRepository();
  const [fixture, entries] = await Promise.all([getRequestOpsFixtureSnapshot(session.organizationId), repository.listSpendTotals(session.organizationId)]);
  const now = new Date().toISOString();
  const today = civilDate(now, fixture.organizations.find((row) => row.id === session.organizationId)?.timeZone ?? "America/New_York");
  const months = PERIODS.find((value) => String(value) === one(query.period)) ?? 12;
  const scope = { organizationId: session.organizationId, storeIds: session.storeIds, regionIds: session.regionIds };
  const regions = fixture.regions.filter((row) => row.organizationId === session.organizationId && (!session.regionIds || session.regionIds.includes(row.id)));
  const region = regions.find((row) => row.id === one(query.region))?.id;
  const ctx = buildReportContext(fixture, scope, { region }, now, today);
  const companyWide = !region && !session.storeIds && !session.regionIds;
  const seeSpend = companyWide && ["facilities", "finance", "executive"].includes(session.role);
  const start = addDay(`${today.slice(0, 7)}-01`, 0);
  const windowFrom = (() => { const d = new Date(`${start}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() - months); return d.toISOString().slice(0, 10); })();
  const window: Range = { from: windowFrom, to: today };
  const split = seeSpend ? spendSplit(ctx, activeTotals(entries).filter((entry) => entry.periodEnd >= window.from)) : [];
  const periods: Array<{ range: Range; row?: SpendSplitRow }> = split.length ? split.map((row) => ({ range: { from: row.entry.periodStart, to: row.entry.periodEnd }, row })) : quarters(today, months).map((range) => ({ range }));
  const base = { view: "in_house", period: String(months), ...(region ? { region } : {}) };
  const link = (extra: Record<string, string>) => `/app/trends?${new URLSearchParams({ ...base, ...extra })}#records`;
  const categoryName = (key?: string) => key ? fixture.taxonomyNodes.find((node) => node.organizationId === session.organizationId && node.nodeKind === "category" && node.canonicalKey === key)?.name ?? key : "Not classified yet";
  const categories = [...new Set(ctx.jobs.filter((job) => !job.pm && completedIn(job, window)).map((job) => job.category ?? "unclassified"))].sort((a, b) => categoryName(a === "unclassified" ? undefined : a).localeCompare(categoryName(b === "unclassified" ? undefined : b)));
  const quality = (category?: string) => ({ in_house: repairQuality(ctx, window, "in_house", category), vendor: repairQuality(ctx, window, "vendor", category) });
  const maxTotal = Math.max(1, ...split.map((row) => row.totalMinor));
  const show = one(query.show);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div><h1>Trends</h1><p>In-house team and outside vendors, side by side.</p></div>
        {["facilities", "finance", "executive"].includes(session.role) ? <Link className={styles.secondary} href="/app/spend/totals">Spend totals →</Link> : null}
      </header>
      <TrendTabs active="in_house" query={{ period: String(months), ...(region ? { region } : {}) }} />
      <form className={styles.controls} action="/app/trends" method="get">
        <input type="hidden" name="view" value="in_house" />
        <label>Dates<select name="period" defaultValue={String(months)}>{PERIODS.map((value) => <option key={value} value={value}>Last {value} months</option>)}</select></label>
        {regions.length > 1 ? <label>Region<select name="region" defaultValue={region ?? ""}><option value="">All regions</option>{regions.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label> : null}
        <button type="submit">Show</button>
      </form>

      <section className={styles.panel} aria-labelledby="spend-title">
        <h2 id="spend-title">Spend over time</h2>
        {!seeSpend ? <p className={styles.muted}>{companyWide ? "Spend totals are shown to facilities, finance and executives." : "Accounting enters spend for the whole company, so spend shows only with all regions selected."}</p>
          : !split.length ? <p>No spend totals for these dates yet. {session.role !== "executive" ? <Link href="/app/spend/totals">Enter totals from accounting →</Link> : "Accounting can enter them on Spend totals."}</p>
            : <>
              <div className={styles.legend} aria-hidden="true"><span><i className={styles.vendorSwatch} />Outside vendors</span><span><i className={styles.inHouseSwatch} />In-house</span></div>
              <ul className={styles.bars} aria-label="Spend by period">
                {split.map((row) => (
                  <li key={row.entry.id}>
                    <span className={styles.barLabel}>{rangeLabel({ from: row.entry.periodStart, to: row.entry.periodEnd })}</span>
                    <span className={styles.barTrack} title={`Vendors ${money(row.vendorMinor)} · In-house ${money(row.inHouseMinor)}`}>
                      <span className={styles.vendorBar} style={{ width: `${(row.vendorMinor / maxTotal) * 100}%` }} />
                      <span className={`${styles.inHouseBar} ${row.inHouseEstimated ? styles.estimated : ""}`} style={{ width: `${(row.inHouseMinor / maxTotal) * 100}%` }} />
                    </span>
                    <strong>{money(row.totalMinor)}</strong>
                  </li>
                ))}
              </ul>
              <div className={styles.scroll}>
                <table className={styles.table}>
                  <thead><tr><th>Dates</th><th className={styles.num}>Total</th><th className={styles.num}>Outside vendors</th><th className={styles.num}>In-house</th><th className={styles.num}>In-house share</th></tr></thead>
                  <tbody>{split.map((row) => {
                    const range = { from: row.entry.periodStart, to: row.entry.periodEnd };
                    return (
                      <tr key={row.entry.id}>
                        <td data-label="Dates">{rangeLabel(range)}</td>
                        <td data-label="Total" className={styles.num}><Link href="/app/spend/totals">{money(row.totalMinor)}</Link><small>{row.entry.kind === "total" ? "Entered by accounting" : "In-house entered + vendors"}</small></td>
                        <td data-label="Outside vendors" className={styles.num}><Link href={link({ show: `vendor-cost:${range.from}:${range.to}` })}>{money(row.vendorMinor)}</Link><small>Recorded in the app</small></td>
                        <td data-label="In-house" className={styles.num}>
                          {money(row.inHouseMinor)}<small>{row.inHouseEstimated ? "Estimated" : "Entered by accounting"}</small>
                          {row.inHouseEstimated && row.vendorJobsWithoutCost.length ? <Link className={styles.warn} href={link({ show: `no-cost:${range.from}:${range.to}` })}>{row.vendorJobsWithoutCost.length} vendor {row.vendorJobsWithoutCost.length === 1 ? "job" : "jobs"} with no cost yet</Link> : null}
                        </td>
                        <td data-label="In-house share" className={styles.num}>{row.totalMinor ? `${Math.round((row.inHouseMinor / row.totalMinor) * 100)}%` : "—"}</td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
              <p className={styles.note}>Estimated in-house = accounting&apos;s total minus vendor costs recorded for the same dates.</p>
            </>}
      </section>

      <section className={styles.panel} aria-labelledby="workload-title">
        <h2 id="workload-title">Workload</h2>
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead><tr><th>Dates</th><th className={styles.num}>Repairs done in-house</th><th className={styles.num}>Repairs done by vendors</th><th className={styles.num}>Team hours on site</th></tr></thead>
            <tbody>{periods.map(({ range }) => {
              const done = ctx.jobs.filter((job) => !job.pm && completedIn(job, range));
              const visits = teamVisits(ctx, range);
              return (
                <tr key={range.from}>
                  <td data-label="Dates">{rangeLabel(range)}</td>
                  <td data-label="Repairs done in-house" className={styles.num}><Link href={link({ show: `done:in_house:${range.from}:${range.to}` })}>{done.filter((job) => job.provider === "in_house").length}</Link></td>
                  <td data-label="Repairs done by vendors" className={styles.num}><Link href={link({ show: `done:vendor:${range.from}:${range.to}` })}>{done.filter((job) => job.provider === "vendor").length}</Link></td>
                  <td data-label="Team hours on site" className={styles.num}><Link href={link({ show: `hours:${range.from}:${range.to}` })}>{hours(visits.reduce((sum, visit) => sum + (visit.observedDurationSeconds ?? 0), 0))}</Link><small>{visits.length} visits</small></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
        <p className={styles.note}>Hours are check-in to check-out for the whole team. One visit can cover several jobs, so hours aren&apos;t split by job.</p>
      </section>

      <section className={styles.panel} aria-labelledby="quality-title">
        <h2 id="quality-title">Repair quality by equipment type · {rangeLabel(window)}</h2>
        <div className={styles.scroll}>
          <table className={`${styles.table} ${styles.quality}`}>
            <thead>
              <tr><th rowSpan={2}>Equipment type</th><th colSpan={4} className={styles.group}>In-house</th><th colSpan={4} className={styles.group}>Outside vendors</th></tr>
              <tr>{["in_house", "vendor"].flatMap((side) => [<th key={`${side}-d`} className={styles.num}>Repairs</th>, <th key={`${side}-f`} className={styles.num}>Fixed first visit</th>, <th key={`${side}-b`} className={styles.num}>Broke again in 30 days</th>, <th key={`${side}-t`} className={styles.num}>Typical time to fix</th>])}</tr>
            </thead>
            <tbody>{[undefined, ...categories].map((category) => {
              const row = quality(category);
              return (
                <tr key={category ?? "all"} className={category ? undefined : styles.allRow}>
                  <td data-label="Equipment type">{category ? categoryName(category === "unclassified" ? undefined : category) : "All equipment"}</td>
                  {(["in_house", "vendor"] as const).flatMap((side) => {
                    const href = link({ show: `quality:${side}:${category ?? "all"}` }), q = row[side];
                    return [
                      <td key={`${side}-d`} data-label={`${side === "vendor" ? "Vendors" : "In-house"} repairs`} className={styles.num}><Link href={href}>{q.completed}</Link></td>,
                      <td key={`${side}-f`} data-label="Fixed first visit" className={styles.num}>{pct(q.firstVisitFix)}{q.firstVisitCounted && q.firstVisitCounted < q.completed ? <small>of {q.firstVisitCounted} with visits</small> : null}</td>,
                      <td key={`${side}-b`} data-label="Broke again in 30 days" className={styles.num}>{pct(q.brokeAgain)}{q.brokeAgainCounted && q.brokeAgainCounted < q.completed ? <small>of {q.brokeAgainCounted} on equipment</small> : null}</td>,
                      <td key={`${side}-t`} data-label="Typical time to fix" className={styles.num}>{days(q.typicalDays)}</td>,
                    ];
                  })}
                </tr>
              );
            })}</tbody>
          </table>
        </div>
        <p className={styles.note}>Repairs only (planned maintenance left out). Jobs both sides worked on count for neither. Differences are worth a look, not proof.</p>
      </section>

      {show ? <Records ctx={ctx} show={show} categoryName={categoryName} window={window} closeHref={`/app/trends?${new URLSearchParams(base)}`} /> : null}
    </div>
  );
}

function Records({ ctx, show, categoryName, window, closeHref }: { ctx: ReportContext; show: string; categoryName: (key?: string) => string; window: Range; closeHref: string }) {
  const [kind, a, b, c] = show.split(":");
  const valid = (value?: string) => Boolean(value && /^\d{4}-\d{2}-\d{2}$/u.test(value));
  let title = "", body: React.ReactNode = null;
  const jobLink = (job: JobFact) => <><Link href={`/app/work-orders/${encodeURIComponent(job.id)}`}>{job.number}</Link><small>{job.problem}</small></>;
  if (kind === "vendor-cost" && valid(a) && valid(b)) {
    const range = { from: a!, to: b! };
    const jobs = ctx.jobs.map((job) => ({ job, cost: costIn(job, range, "vendor") })).filter((row) => row.cost !== 0).sort((x, y) => y.cost - x.cost);
    title = `Vendor costs · ${rangeLabel(range)} · ${money(jobs.reduce((sum, row) => sum + row.cost, 0))}`;
    body = <table className={styles.table}><thead><tr><th>Work order</th><th>Store</th><th>Vendor</th><th className={styles.num}>Cost in these dates</th></tr></thead><tbody>{jobs.map(({ job, cost }) => <tr key={job.id}><td data-label="Work order">{jobLink(job)}</td><td data-label="Store">{job.storeName}</td><td data-label="Vendor">{job.vendorName ?? "—"}</td><td data-label="Cost" className={styles.num}>{money(cost)}</td></tr>)}</tbody></table>;
  } else if ((kind === "done" && (a === "in_house" || a === "vendor") && valid(b) && valid(c)) || (kind === "no-cost" && valid(a) && valid(b))) {
    const range = kind === "done" ? { from: b!, to: c! } : { from: a!, to: b! };
    const jobs = ctx.jobs.filter((job) => !job.pm && completedIn(job, range) && (kind === "done" ? job.provider === a : job.provider === "vendor" && !job.costs.some((line) => line.provider === "vendor")));
    title = kind === "done" ? `Repairs done ${a === "vendor" ? "by vendors" : "in-house"} · ${rangeLabel(range)} · ${jobs.length}` : `Vendor jobs with no cost yet · ${rangeLabel(range)} · ${jobs.length}`;
    body = <table className={styles.table}><thead><tr><th>Work order</th><th>Store</th><th>Equipment type</th><th>Done</th><th>{a === "in_house" ? "Technician" : "Vendor"}</th></tr></thead><tbody>{jobs.map((job) => <tr key={job.id}><td data-label="Work order">{jobLink(job)}</td><td data-label="Store">{job.storeName}</td><td data-label="Type">{categoryName(job.category)}</td><td data-label="Done">{day(job.completedAt!.slice(0, 10))}</td><td data-label="Who">{a === "in_house" ? job.techName ?? "—" : job.vendorName ?? "—"}</td></tr>)}</tbody></table>;
  } else if (kind === "hours" && valid(a) && valid(b)) {
    const range = { from: a!, to: b! };
    const visits = teamVisits(ctx, range);
    const covered = new Map<string, JobFact[]>();
    const linked = ctx.fixture.siteVisitWorkOrders.filter((row) => row.organizationId === ctx.organizationId);
    const jobById = new Map(ctx.jobs.map((job) => [job.id, job]));
    for (const row of linked) { const job = jobById.get(row.workOrderId); if (job) covered.set(row.visitId, [...(covered.get(row.visitId) ?? []), job]); }
    title = `Team visits · ${rangeLabel(range)} · ${hours(visits.reduce((sum, visit) => sum + (visit.observedDurationSeconds ?? 0), 0))}`;
    body = <table className={styles.table}><thead><tr><th>Checked in</th><th>Store</th><th>Technician</th><th className={styles.num}>On site</th><th>Work orders</th></tr></thead><tbody>{visits.map((visit) => <tr key={visit.id}><td data-label="Checked in">{formatOperationsDate(visit.checkedInAt, "America/New_York")}</td><td data-label="Store">{ctx.storeLabel(visit.storeId)}</td><td data-label="Technician">{ctx.personName(visit.internalMembershipId)}</td><td data-label="On site" className={styles.num}>{visit.observedDurationSeconds ? hours(visit.observedDurationSeconds) : "Still on site or not checked out"}</td><td data-label="Work orders">{(covered.get(visit.id) ?? []).map((job) => <Link key={job.id} href={`/app/work-orders/${encodeURIComponent(job.id)}`}>{job.number} </Link>)}</td></tr>)}</tbody></table>;
  } else if (kind === "quality" && (a === "in_house" || a === "vendor") && b) {
    const rows: QualityJob[] = repairQuality(ctx, window, a, b === "all" ? undefined : b).jobs;
    const yesNo = (value?: boolean) => value === undefined ? "—" : value ? "Yes" : "No";
    title = `${a === "vendor" ? "Vendor" : "In-house"} repairs · ${b === "all" ? "All equipment" : categoryName(b === "unclassified" ? undefined : b)} · ${rows.length}`;
    body = <table className={styles.table}><thead><tr><th>Work order</th><th>Store</th><th>Fixed first visit</th><th>Broke again in 30 days</th><th className={styles.num}>Time to fix</th></tr></thead><tbody>{rows.map((row) => <tr key={row.job.id}><td data-label="Work order">{jobLink(row.job)}</td><td data-label="Store">{row.job.storeName}</td><td data-label="Fixed first visit">{yesNo(row.firstVisitFixed)}</td><td data-label="Broke again">{yesNo(row.brokeAgain)}</td><td data-label="Time to fix" className={styles.num}>{days(row.days)}</td></tr>)}</tbody></table>;
  } else return null;
  return (
    <section className={styles.panel} id="records" aria-labelledby="records-title">
      <div className={styles.recordsHead}><h2 id="records-title">{title}</h2><Link href={closeHref}>Close</Link></div>
      <div className={styles.scroll}>{body}</div>
    </section>
  );
}
