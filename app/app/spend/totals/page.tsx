import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import { loadOperatorSession } from "@/app/app/_data/operator-loader";
import { getRequestOpsFixtureSnapshot } from "@/app/app/_data/request-data";
import { RecordForm } from "@/components/ops/record-form";
import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import { civilDate } from "@/lib/ops/dispatch-calendar";
import { formatOperationsDate } from "@/lib/ops/local-time";
import { buildReportContext } from "@/lib/ops/reports/facts";
import { money } from "@/lib/ops/reports/doc";
import { activeTotals, spendCoverage, spendSplit, SPEND_TOTAL_KIND_LABELS, type SpendTotal } from "@/lib/ops/spend-totals";
import styles from "@/components/workspace/compliance.module.css";
import own from "./totals.module.css";

export const metadata: Metadata = { title: "Maintenance spend totals" };
type Query = { notice?: string; overlap?: string; from?: string; to?: string; kind?: string; amount?: string };

const day = (value: string) => formatOperationsDate(`${value}T12:00:00Z`, "UTC");
const range = (entry: { periodStart: string; periodEnd: string }) => `${day(entry.periodStart)} – ${day(entry.periodEnd)}`;

/**
 * Accounting enters maintenance spend from their books for dates they choose. The app puts each total next to the
 * outside-vendor cost it recorded for the same days, so the in-house part can be estimated without splitting periods.
 */
export default async function SpendTotalsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const session = await loadOperatorSession();
  if (!["facilities", "finance", "executive"].includes(session.role)) notFound();
  const edit = session.role === "facilities" || session.role === "finance" || session.role === "executive";
  const repository = await getServerOpsRepository();
  const [entries, fixture] = await Promise.all([repository.listSpendTotals(session.organizationId), getRequestOpsFixtureSnapshot(session.organizationId)]);
  const now = new Date().toISOString();
  const today = civilDate(now, fixture.organizations.find((row) => row.id === session.organizationId)?.timeZone ?? "America/New_York");
  const ctx = buildReportContext(fixture, { organizationId: session.organizationId }, {}, now, today);
  const rows = spendSplit(ctx, entries).reverse();
  const withdrawn = entries.filter((entry) => entry.withdrawnAt).sort((a, b) => b.withdrawnAt!.localeCompare(a.withdrawnAt!));
  const coverage = spendCoverage(entries);
  const clashIds = new Set((query.overlap ?? "").split(",").filter(Boolean));
  const clashes = activeTotals(entries).filter((entry) => clashIds.has(entry.id));
  const attempted = query.from && query.to ? { periodStart: query.from, periodEnd: query.to } : undefined;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Maintenance spend totals</h1>
          <p>Totals from your accounting system. They show what in-house work costs over time.</p>
        </div>
        <Link href="/app/trends?view=in_house">See in-house vs vendors →</Link>
      </header>
      {query.notice ? <p role="status" className={styles.notice}>{query.notice}</p> : null}

      <section className={`${styles.panel} ${own.status}`} aria-label="What has been entered">
        {coverage.lastDay ? (
          <>
            <p className={own.big}>Entered through <strong>{day(coverage.lastDay)}</strong></p>
            <p>Next, pull a maintenance spend report starting <strong>{day(coverage.nextStart!)}</strong>.</p>
          </>
        ) : <p className={own.big}>Nothing entered yet. Pull a maintenance spend report from your accounting system for any past period, like last quarter.</p>}
        {coverage.gaps.length ? (
          <div className={own.gaps} role="alert">
            <strong>Missing dates</strong>
            <ul>{coverage.gaps.map((gap) => <li key={gap.from}>{range({ periodStart: gap.from, periodEnd: gap.to })}</li>)}</ul>
          </div>
        ) : null}
      </section>

      {clashes.length && attempted ? (
        <section className={own.overlap} role="alert" aria-labelledby="overlap-title">
          <h2 id="overlap-title">These dates overlap. Nothing was saved.</h2>
          <p>Check both against your books. Then fix the new dates, or withdraw the saved entry if it was wrong.</p>
          <table className={styles.table}>
            <thead><tr><th></th><th>Dates</th><th>Amount</th></tr></thead>
            <tbody>
              <tr><td>Your new entry</td><td>{range(attempted)}</td><td>{query.amount && Number.isFinite(Number(query.amount)) ? `$${Number(query.amount).toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "—"}</td></tr>
              {clashes.map((entry) => <tr key={entry.id}><td>Saved by {entry.enteredByName}</td><td>{range(entry)}</td><td>{money(entry.amountMinor)}</td></tr>)}
            </tbody>
          </table>
        </section>
      ) : null}

      {edit ? (
        <section className={styles.panel} id="enter" aria-labelledby="enter-title">
          <h2 id="enter-title">Enter a total</h2>
          <RecordForm action="/api/ops/spend-totals" offerSavedWork={false} className={styles.form}>
            <input type="hidden" name="action" value="add" />
            <input type="hidden" name="key" value={randomUUID()} />
            <fieldset className={own.kinds}>
              <legend>What does this amount cover?</legend>
              {(["total", "in_house"] as const).map((kind) => (
                <label key={kind} className={styles.check}><input type="radio" name="kind" value={kind} defaultChecked={(query.kind ?? "total") === kind} required />{SPEND_TOTAL_KIND_LABELS[kind]}</label>
              ))}
            </fieldset>
            <div className={styles.pair}>
              <label>First day<input type="date" name="periodStart" required max={today} defaultValue={query.from ?? coverage.nextStart} /></label>
              <label>Last day<input type="date" name="periodEnd" required max={today} defaultValue={query.to} /></label>
            </div>
            <div className={styles.pair}>
              <label>Amount ($)<input name="amount" inputMode="decimal" required placeholder="48,250.00" defaultValue={query.amount} /></label>
              <label><span>Note <small>optional</small></span><input name="note" maxLength={500} placeholder="Like: GL 6100–6190, Q3 close" /></label>
            </div>
            <div><button type="submit">Save total</button></div>
          </RecordForm>
        </section>
      ) : null}

      <section className={styles.panel} aria-labelledby="entries-title">
        <h2 id="entries-title">Entries · {rows.length}</h2>
        {rows.length ? (
          <div className={styles.scroll}>
            <table className={`${styles.table} ${styles.operatingTable}`}>
              <thead><tr><th>Dates</th><th>Entered amount</th><th>Vendor costs in the app</th><th>In-house</th><th>Entered by</th></tr></thead>
              <tbody>{rows.map((row) => (
                <tr key={row.entry.id} className={clashIds.has(row.entry.id) ? own.flagged : undefined}>
                  <td data-label="Dates"><strong>{range(row.entry)}</strong>{row.entry.note ? <p><small>{row.entry.note}</small></p> : null}</td>
                  <td data-label="Entered amount">{money(row.entry.amountMinor)}<p><small>{row.entry.kind === "total" ? "Total spend" : "In-house only"}</small></p></td>
                  <td data-label="Vendor costs in the app">{money(row.vendorMinor)}<p><small>Recorded for the same dates</small></p></td>
                  <td data-label="In-house">
                    {money(row.inHouseMinor)}
                    <p><small>{row.inHouseEstimated ? "Estimated: total minus vendor costs" : "Entered by accounting"}</small></p>
                    {row.inHouseEstimated && row.vendorJobsWithoutCost.length ? (
                      <details className={own.warn}>
                        <summary>{row.vendorJobsWithoutCost.length} vendor {row.vendorJobsWithoutCost.length === 1 ? "job has" : "jobs have"} no cost yet</summary>
                        <p><small>Until their costs are entered, this estimate is too high.</small></p>
                        <ul>{row.vendorJobsWithoutCost.slice(0, 20).map((job) => <li key={job.id}><Link href={`/app/work-orders/${encodeURIComponent(job.id)}`}>{job.number}</Link> · {job.problem}</li>)}</ul>
                      </details>
                    ) : null}
                  </td>
                  <td data-label="Entered by">
                    {row.entry.enteredByName}<p><small>{formatOperationsDate(row.entry.createdAt, "America/New_York")}</small></p>
                    {edit ? <Withdraw entry={row.entry} /> : null}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p>No totals yet.</p>}
        {withdrawn.length ? (
          <details>
            <summary>Withdrawn entries · {withdrawn.length}</summary>
            <ul className={own.withdrawn}>{withdrawn.map((entry) => (
              <li key={entry.id}><s>{range(entry)} · {money(entry.amountMinor)}</s> · withdrawn by {entry.withdrawnByName}: {entry.withdrawnReason}</li>
            ))}</ul>
          </details>
        ) : null}
      </section>
      <p className={styles.muted}>In-house estimates are rough. Vendor costs count by service date; your books may count by invoice date.</p>
    </div>
  );
}

function Withdraw({ entry }: { entry: SpendTotal }) {
  return (
    <details className={own.withdraw}>
      <summary>Withdraw</summary>
      <RecordForm action="/api/ops/spend-totals" offerSavedWork={false}>
        <input type="hidden" name="action" value="withdraw" />
        <input type="hidden" name="id" value={entry.id} />
        <label>Why is it wrong?<input name="reason" required maxLength={300} placeholder="Like: wrong dates" /></label>
        <button type="submit">Withdraw entry</button>
      </RecordForm>
    </details>
  );
}

