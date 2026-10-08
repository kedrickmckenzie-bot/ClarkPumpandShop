import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadOperatorSession } from "@/app/app/_data/operator-loader";
import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import { reportCatalog, reportCatalogEntry } from "@/lib/ops/report-catalog";
import { canOpenReport } from "@/lib/ops/reports/registry";
import { parseReportOptions } from "@/lib/ops/reports/options";
import { PERIOD_LABELS, PERIOD_PRESETS, type PeriodPreset } from "@/lib/ops/reports/period";
import { WEEKDAYS, operatorRoleFor } from "@/lib/ops/reports/schedules";
import { reportDefaults } from "@/lib/server/report-model";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Schedule a report" };
type Query = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => Array.isArray(v) ? v[0] : v;
const HOURS = [5, 6, 7, 8, 9, 10, 12, 15, 17];
const hourLabel = (h: number) => `${h % 12 || 12}:00 ${h < 12 ? "AM" : "PM"}`;

/** Pick a report, how often it goes out, and who gets it. Options carry over from the report you were looking at. */
export default async function NewReportSchedulePage({ searchParams }: { searchParams: Promise<Query> }) {
  const [query, session] = await Promise.all([searchParams, loadOperatorSession()]);
  const builtReports = reportCatalog.filter(e => e.source.kind === "built" && canOpenReport(e, session.role));
  if (!builtReports.length) notFound();
  const entry = reportCatalogEntry(first(query.report) ?? "") ?? builtReports[0]!;
  if (entry.source.kind !== "built" || !canOpenReport(entry, session.role)) notFound();
  const defaults = reportDefaults(entry);
  const parsed = parseReportOptions(key => query[key], defaults);
  const period = (PERIOD_PRESETS as readonly string[]).includes(parsed.period) ? parsed.period : defaults.period;
  const repository = await getServerOpsRepository();
  const [people, stores, regions, vendors] = await Promise.all([
    repository.listReportRecipients(session.organizationId),
    parsed.store ? repository.getStore(session.organizationId, parsed.store) : null,
    parsed.region ? repository.getDispatchFilters({ organizationId: session.organizationId }).then(f => f.regions) : Promise.resolve([] as Array<{ id: string; name: string }>),
    parsed.vendor ? repository.getVendor(session.organizationId, parsed.vendor) : null,
  ]);
  const eligible = people.filter(p => canOpenReport(entry, operatorRoleFor(p.role)));
  const covers = [stores ? `Store ${stores.storeNumber}` : null, parsed.region ? regions.find(r => r.id === parsed.region)?.name : null, vendors?.name].filter(Boolean).join(" · ") || "All your stores";
  const error = first(query.error);
  return (
    <div className={styles.page}>
      <p className={styles.back}><Link href="/app/reports">← Reports</Link></p>
      <h1>Schedule a report</h1>
      <form className={styles.form} method="post" action="/api/ops/report-schedules">
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        <label>Report
          <select name="report" defaultValue={entry.id} disabled={builtReports.length < 2}>
            {builtReports.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
          </select>
        </label>
        {builtReports.length < 2 ? <input type="hidden" name="report" value={entry.id} /> : null}
        <p className={styles.covers}>Covers: <strong>{covers}</strong></p>
        {parsed.store ? <input type="hidden" name="store" value={parsed.store} /> : null}
        {parsed.region ? <input type="hidden" name="region" value={parsed.region} /> : null}
        {parsed.vendor ? <input type="hidden" name="vendor" value={parsed.vendor} /> : null}
        <label>Period
          <select name="period" defaultValue={period}>
            {PERIOD_PRESETS.map(p => <option key={p} value={p}>{PERIOD_LABELS[p as PeriodPreset]}</option>)}
          </select>
        </label>
        {entry.audience === "both" ? (
          <label>Who did the work
            <select name="work" defaultValue={parsed.work}>
              <option value="both">Vendors and in-house</option><option value="vendor">Outside vendors</option><option value="in_house">In-house team</option>
            </select>
          </label>
        ) : null}
        <fieldset className={styles.row}><legend>Show</legend>
          <label className={styles.radio}><input type="radio" name="detail" value="summary" defaultChecked={parsed.detail !== "all"} /> Summary</label>
          <label className={styles.radio}><input type="radio" name="detail" value="all" defaultChecked={parsed.detail === "all"} /> Every record</label>
        </fieldset>
        <fieldset className={styles.row}><legend>How often</legend>
          <label className={styles.radio}><input type="radio" name="frequency" value="weekly" defaultChecked={period === "this_month"} /> Weekly</label>
          <label className={styles.radio}><input type="radio" name="frequency" value="monthly" defaultChecked={period !== "this_month"} /> Monthly</label>
        </fieldset>
        <div className={styles.when}>
          <label className={styles.weekly}>Day
            <select name="weekday" defaultValue="1">{WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select>
          </label>
          <label className={styles.monthly}>Day of the month
            <select name="monthDay" defaultValue="1">{Array.from({ length: 28 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select>
          </label>
          <label>Time
            <select name="sendHour" defaultValue="7">{HOURS.map(h => <option key={h} value={h}>{hourLabel(h)}</option>)}</select>
          </label>
        </div>
        <fieldset className={styles.people}><legend>Send to</legend>
          {eligible.length ? eligible.map(p => (
            <label key={p.membershipId} className={styles.radio}><input type="checkbox" name="recipient" value={p.membershipId} defaultChecked={p.membershipId === session.membershipId} /> {p.name}</label>
          )) : <p>No one else can open this report yet.</p>}
          <small>Only people who can open this report are listed. Each person sees only their own stores.</small>
        </fieldset>
        <div className={styles.buttons}>
          <button type="submit">Save schedule</button>
          <Link href={`/app/reports/${entry.id}`}>Cancel</Link>
        </div>
      </form>
    </div>
  );
}
