import Link from "next/link";
import { CalendarClock, Download, FileBarChart2 } from "lucide-react";
import { REPORT_GROUPS, type ReportCatalogEntry, type ReportGroup } from "@/lib/ops/report-catalog";
import { AUDIENCE_LABELS } from "@/lib/ops/reports/options";
import styles from "./reporting-center.module.css";

const ORDER: ReportGroup[] = ["leadership", "vendors", "team", "operations"];

/**
 * Reports, grouped by who reads them. Each card says whether it covers outside vendors, the in-house team or both,
 * and opens straight into the report, where the period and stores are chosen.
 */
export function ReportingCenter({ entries, schedules }: { entries: ReportCatalogEntry[]; schedules?: React.ReactNode }) {
  return (
    <div className={styles.workspace}>
      <header className={styles.header}>
        <div><h1>Reports</h1><span>Open a report, pick the period and stores, then print, save as PDF, download, or schedule it.</span></div>
      </header>
      {ORDER.map(group => {
        const items = entries.filter(e => e.group === group);
        if (!items.length) return null;
        return (
          <section key={group} className={styles.group} aria-labelledby={`group-${group}`}>
            <h2 id={`group-${group}`}>{REPORT_GROUPS[group].title}</h2>
            <p className={styles.groupNote}>{REPORT_GROUPS[group].description}</p>
            <div className={styles.grid}>
              {items.map(entry => (
                <article key={entry.id}>
                  <header>
                    <span aria-hidden="true"><FileBarChart2 size={18} /></span>
                    <div>
                      <h3><Link href={`/app/reports/${entry.id}`}>{entry.title}</Link></h3>
                      <small className={styles[`aud_${entry.audience}`]}>{AUDIENCE_LABELS[entry.audience]}</small>
                    </div>
                  </header>
                  <p>{entry.description}</p>
                  <footer>
                    <Link className={styles.primary} href={`/app/reports/${entry.id}`}>Open</Link>
                    {entry.source.kind === "built" ? <Link href={`/app/reports/schedules/new?report=${entry.id}`}><CalendarClock size={14} aria-hidden="true" /> Schedule</Link> : null}
                    <a href={`/api/ops/reports/${entry.id}`}><Download size={14} aria-hidden="true" /> CSV</a>
                  </footer>
                </article>
              ))}
            </div>
          </section>
        );
      })}
      {schedules}
    </div>
  );
}
