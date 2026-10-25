import Link from "next/link";
import { getRequestOpsFixtureSnapshot } from "@/app/app/_data/request-data";
import type { OperatorSession } from "@/components/ops/data-contract";
import { civilDate } from "@/lib/ops/dispatch-calendar";
import { buildReportContext } from "@/lib/ops/reports/facts";
import { money } from "@/lib/ops/reports/doc";
import { vendorJobFactsFromFixture } from "@/lib/ops/vendor-scorecard";
import {
  factSeries, isVendorTrendMeasure, monthJobs, spendSeries, trendMonths, VENDOR_TREND_INFO, VENDOR_TREND_MEASURES,
  type VendorTrendFilter, type VendorTrendMeasure, type VendorTrendPoint, type VendorTrendSeries,
} from "@/lib/ops/vendor-trends";
import { TrendTabs } from "./trend-tabs";
import { VendorTrendControls } from "./vendor-trend-controls";
import styles from "./vendor-trends.module.css";

type Query = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const monthShort = (month: string) => new Date(`${month}-15T12:00:00Z`).toLocaleString("en-US", { month: "short", timeZone: "UTC" });
const monthLong = (month: string) => new Date(`${month}-15T12:00:00Z`).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const compactMoney = (minor: number) => { const d = minor / 100; return d >= 1000 ? `$${Math.round(d / 100) / 10}k` : `$${Math.round(d)}`; };

function format(key: VendorTrendMeasure, value: number | undefined, compact = false) {
  if (value === undefined) return "—";
  const unit = VENDOR_TREND_INFO[key].unit;
  if (unit === "percent") return `${Math.round(value * 100)}%`;
  if (unit === "money") return compact ? compactMoney(value) : money(Math.round(value));
  return String(Math.round(value));
}

/**
 * Trends → Vendors: outside vendors only, month by month for the last 12 months. All vendors together, one
 * category, or one vendor. Each chart says whether a change is one bad month or a trend; a month opens its jobs.
 */
export default async function VendorTrends({ session, query }: { session: OperatorSession; query: Query }) {
  const fixture = await getRequestOpsFixtureSnapshot(session.organizationId);
  const org = session.organizationId, now = new Date().toISOString();
  const timeZone = fixture.organizations.find((row) => row.id === org)?.timeZone ?? "America/New_York";
  const today = civilDate(now, timeZone), months = trendMonths(today);
  const scope = { organizationId: org, storeIds: session.storeIds, regionIds: session.regionIds };
  const from = new Date(Date.UTC(Number(months[0]!.slice(0, 4)) - 1, Number(months[0]!.slice(5, 7)) - 1, 1)).toISOString();
  const facts = vendorJobFactsFromFixture(fixture, scope, { from, to: now });
  const ctx = buildReportContext(fixture, scope, {}, now, today);

  const vendors = fixture.vendors.filter((row) => row.organizationId === org).sort((a, b) => a.name.localeCompare(b.name));
  const vendorName = (id?: string) => vendors.find((row) => row.id === id)?.name ?? "Vendor";
  const categoryName = (key: string) => fixture.taxonomyNodes.find((node) => node.organizationId === org && node.nodeKind === "category" && node.canonicalKey === key)?.name ?? key;
  const categoryKeys = [...new Set(facts.map((fact) => fact.trade).filter((key) => key !== "unclassified"))].sort((a, b) => categoryName(a).localeCompare(categoryName(b)));
  const vendorId = vendors.some((row) => row.id === one(query.vendor)) ? one(query.vendor) : undefined;
  const category = categoryKeys.includes(one(query.category) ?? "") ? one(query.category) : undefined;
  const filter: VendorTrendFilter = { vendorId, category };
  const base: Record<string, string> = { view: "vendors", ...(vendorId ? { vendor: vendorId } : {}), ...(category ? { category } : {}) };
  const href = (extra: Record<string, string> = {}, hash = "") => `/app/trends?${new URLSearchParams({ ...base, ...extra })}${hash}`;

  const seriesFor = (f: VendorTrendFilter) => VENDOR_TREND_MEASURES.map((key) => key === "spend" ? spendSeries(ctx.jobs, months, f, today) : factSeries(facts, months, key, f, now, timeZone, today));
  const series = seriesFor(filter);
  const who = [vendorId ? vendorName(vendorId) : "All outside vendors", category ? categoryName(category) : undefined].filter(Boolean).join(" · ");
  const seeScorecard = ["executive", "facilities", "regional"].includes(session.role) && session.persona !== "field_manager";

  const measure = isVendorTrendMeasure(one(query.measure)) ? one(query.measure) as VendorTrendMeasure : undefined;
  const month = months.includes(one(query.month) ?? "") ? one(query.month) : undefined;
  const drill = measure && month ? monthJobs({ facts, jobs: ctx.jobs, month, key: measure, filter, now, timeZone, vendorName }) : undefined;
  const storeLabel = ctx.storeLabel;

  // Vendors with work in these months, for the side-by-side rows.
  const activeVendors = vendors.filter((row) => facts.some((fact) => fact.vendorId === row.id && (!category || fact.trade === category) && months.includes(fact.sentAt.slice(0, 7))));

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div><h1>Trends</h1><p>Outside vendors, month by month. Is it a bad month, or getting worse?</p></div>
        {seeScorecard ? <Link className={styles.secondary} href={vendorId ? `/app/vendors/scorecards?vendor=${encodeURIComponent(vendorId)}` : "/app/vendors/scorecards"}>{vendorId ? "This vendor's scorecard →" : "Vendor scorecards →"}</Link> : null}
      </header>
      <TrendTabs active="vendors" />
      <VendorTrendControls vendors={vendors.map((row) => ({ value: row.id, label: row.name }))} categories={categoryKeys.map((key) => ({ key, label: categoryName(key) }))} vendor={vendorId} category={category} />

      <section className={styles.charts} aria-label={`${who}, last 12 months`}>
        <h2 className={styles.who}>{who} <span>· {monthLong(months[0]!)} – {monthLong(months.at(-1)!)}</span></h2>
        {category ? <p className={styles.hint}>Jobs without a category are left out of category views.</p> : null}
        <div className={styles.grid}>
          {series.map((row) => <Chart key={row.key} series={row} href={(m) => href({ measure: row.key, month: m }, "#vendor-jobs")} selected={measure === row.key ? month : undefined} />)}
        </div>
      </section>

      {drill && measure && month ? (
        <section id="vendor-jobs" className={styles.panel} aria-labelledby="vendor-jobs-title">
          <div className={styles.drillHead}>
            <h2 id="vendor-jobs-title">{VENDOR_TREND_INFO[measure].label} · {monthLong(month)} · {who}</h2>
            <Link href={href()}>Close</Link>
          </div>
          <p className={styles.hint}>{VENDOR_TREND_INFO[measure].basis}</p>
          {drill.length ? (
            <div className={styles.scroll}>
              <table className={styles.table}>
                <thead><tr><th>Job</th><th>Store</th><th>Vendor</th><th>{measure === "spend" ? "Recorded this month" : "Result"}</th></tr></thead>
                <tbody>{drill.slice(0, 200).map((row) => (
                  <tr key={row.workOrderId} className={row.result.startsWith("Not counted") ? styles.dim : undefined}>
                    <td data-label="Job"><Link href={`/app/work-orders/${encodeURIComponent(row.workOrderId)}`}>{row.number}</Link><small>{row.problem}</small></td>
                    <td data-label="Store">{storeLabel(row.storeId)}</td>
                    <td data-label="Vendor">{row.vendorName}</td>
                    <td data-label={measure === "spend" ? "Recorded" : "Result"}>{measure === "spend" ? money(row.amountMinor ?? 0) : <>{row.result}{row.amountMinor !== undefined ? <small>{money(Math.round(row.amountMinor))}</small> : null}</>}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <p className={styles.muted}>No jobs in this month.</p>}
        </section>
      ) : null}

      {!vendorId && activeVendors.length > 1 ? (
        <section className={styles.panel} aria-labelledby="by-vendor-title">
          <h2 id="by-vendor-title">Each vendor{category ? ` · ${categoryName(category)}` : ""}</h2>
          <div className={styles.scroll}>
            <table className={`${styles.table} ${styles.vendorTable}`}>
              <thead><tr><th>Vendor</th>{(["spend", "onTime", "callbacks", "costPerJob"] as const).map((key) => <th key={key}>{VENDOR_TREND_INFO[key].label}</th>)}</tr></thead>
              <tbody>{activeVendors.map((row) => {
                const rowSeries = seriesFor({ vendorId: row.id, category });
                return (
                  <tr key={row.id}>
                    <td data-label="Vendor"><Link href={`/app/trends?${new URLSearchParams({ view: "vendors", vendor: row.id, ...(category ? { category } : {}) })}`}>{row.name}</Link></td>
                    {(["spend", "onTime", "callbacks", "costPerJob"] as const).map((key) => {
                      const s = rowSeries.find((item) => item.key === key)!;
                      return <td key={key} data-label={VENDOR_TREND_INFO[key].label}>
                        <span className={styles.cell}><Spark points={s.points} measure={key} /><b>{format(key, yearValue(s), false)}</b><small className={styles[s.verdict.tone]}>{s.verdict.short}</small></span>
                      </td>;
                    })}
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
          <p className={styles.note}>Numbers cover the last 12 months: total spend, and the share or average across all those jobs. Pick a vendor to see their charts.</p>
        </section>
      ) : null}
    </div>
  );
}

/** The 12-month figure: total spend, or the share/average across every counted job (not an average of months). */
function yearValue(series: VendorTrendSeries) {
  if (series.key === "spend" || series.key === "jobs") return series.points.reduce((sum, p) => sum + (p.value ?? 0), 0);
  const counted = series.points.reduce((sum, p) => sum + (p.value === undefined ? 0 : p.counted), 0);
  return counted ? series.points.reduce((sum, p) => sum + (p.value ?? 0) * (p.value === undefined ? 0 : p.counted), 0) / counted : undefined;
}

const W = 560, H = 200, PAD = { l: 60, r: 14, t: 14, b: 30 };

/** Spend and job counts are truly zero in a month with no jobs; rates and averages have no value, so the line bridges the gap. */
const zeroWhenEmpty = (key: VendorTrendMeasure) => key === "spend" || key === "jobs";
function linePaths(values: Array<number | undefined>, x: (i: number) => number, y: (v: number) => number) {
  let solid = "", bridge = "", pen = false, last: number | undefined;
  values.forEach((v, i) => {
    if (v === undefined) { pen = false; return; }
    if (!pen && last !== undefined) bridge += `M${x(last).toFixed(1)},${y(values[last]!).toFixed(1)}L${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    solid += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`; pen = true; last = i;
  });
  return { solid, bridge };
}

function Chart({ series, href, selected }: { series: VendorTrendSeries; href: (month: string) => string; selected?: string }) {
  const info = VENDOR_TREND_INFO[series.key];
  const pts = zeroWhenEmpty(series.key) ? series.points.map((p) => ({ ...p, value: p.value ?? (p.partial ? undefined : 0), lastYear: p.lastYear ?? 0 })) : series.points;
  const values = pts.flatMap((p) => [p.value, p.lastYear]).filter((v): v is number => v !== undefined);
  const max = info.unit === "percent" ? 1 : Math.max(1, ...values) * 1.1;
  const x = (i: number) => PAD.l + (i * (W - PAD.l - PAD.r)) / (pts.length - 1);
  const y = (v: number) => H - PAD.b - (v / max) * (H - PAD.t - PAD.b);
  const path = (get: (p: VendorTrendPoint) => number | undefined) => linePaths(pts.map(get), x, y);
  const now = path((p) => p.value);
  const ticks = [0, 0.5, 1].map((f) => f * max);
  const latest = [...pts].reverse().find((p) => p.value !== undefined && !p.partial);
  const showLastYear = series.key === "spend" || series.key === "jobs";
  return (
    <figure className={styles.chart}>
      <figcaption>
        <span className={styles.chartLabel}>{info.label}</span>
        <strong>{latest ? format(series.key, latest.value) : "—"}<small> in {latest ? monthShort(latest.month) : "—"}</small></strong>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${info.label} by month: ${pts.map((p) => `${monthShort(p.month)} ${format(series.key, p.value)}`).join(", ")}`}>
        {ticks.map((t) => <g key={t}><line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className={styles.grid} /><text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" className={styles.axis}>{format(series.key, t, true)}</text></g>)}
        {series.normal !== undefined ? <line x1={PAD.l} x2={W - PAD.r} y1={y(series.normal)} y2={y(series.normal)} className={styles.normal} /> : null}
        {showLastYear ? <path d={path((p) => p.lastYear).solid} className={styles.lastYear} /> : null}
        <path d={now.bridge} className={styles.bridge} />
        <path d={now.solid} className={styles.line} />
        {pts.map((p, i) => (
          <a key={p.month} href={href(p.month)} aria-label={`${monthLong(p.month)}: ${format(series.key, p.value)}${p.partial ? " so far" : ""}${p.tooFew ? `, only ${p.counted} job${p.counted === 1 ? "" : "s"}` : ""}. Show jobs`}>
            <title>{`${monthLong(p.month)}: ${p.value === undefined ? "no jobs this month" : format(series.key, p.value)}${p.partial ? " so far" : ""} · ${p.counted} job${p.counted === 1 ? "" : "s"}${p.tooFew ? " (too few to judge)" : ""}${showLastYear && p.lastYear !== undefined ? ` · last year ${format(series.key, p.lastYear)}` : ""}`}</title>
            <rect x={x(i) - 18} y={PAD.t} width={36} height={H - PAD.t - PAD.b} className={styles.hit} />
            {p.value !== undefined ? <circle cx={x(i)} cy={y(p.value)} r={selected === p.month ? 7 : 5} className={p.partial || p.tooFew ? styles.hollow : selected === p.month ? styles.selectedDot : styles.dot} />
              : <circle cx={x(i)} cy={y(0)} r={3.5} className={styles.noData} />}
            <text x={x(i)} y={H - 8} textAnchor="middle" className={styles.axis}>{monthShort(p.month)}</text>
          </a>
        ))}
      </svg>
      <p className={`${styles.verdict} ${styles[series.verdict.tone]}`}>{series.verdict.text}</p>
      <p className={styles.key}>{series.normal !== undefined ? <><i className={styles.normalKey} />Normal month</> : null}{showLastYear ? <><i className={styles.lastYearKey} />Same month last year</> : null}<><i className={styles.hollowKey} />So far, or too few jobs</>{!zeroWhenEmpty(series.key) && pts.some((p) => p.value === undefined) ? <><i className={styles.noDataKey} />No jobs that month</> : null}</p>
    </figure>
  );
}

function Spark({ points, measure }: { points: VendorTrendPoint[]; measure: VendorTrendMeasure }) {
  const filled = points.map((p) => p.value ?? (zeroWhenEmpty(measure) && !p.partial ? 0 : undefined));
  const values = filled.filter((v): v is number => v !== undefined);
  if (values.length < 2) return <span className={styles.sparkEmpty}>—</span>;
  const max = Math.max(...values) || 1, min = Math.min(0, ...values);
  const x = (i: number) => (i * 96) / (points.length - 1) + 2, y = (v: number) => 26 - ((v - min) / (max - min || 1)) * 22;
  const { solid, bridge } = linePaths(filled, x, y);
  return <svg className={styles.spark} viewBox="0 0 100 30" aria-hidden="true"><path d={bridge} className={styles.sparkBridge} /><path d={solid} /></svg>;
}
