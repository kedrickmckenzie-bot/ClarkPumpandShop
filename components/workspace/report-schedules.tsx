import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { loadOperatorSession } from "@/app/app/_data/operator-loader";
import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import { emailRuntimeFromEnvironment } from "@/lib/ops/email-delivery";
import { cachedDateTimeFormat } from "@/lib/ops/intl-format-cache";
import { reportCatalogEntry } from "@/lib/ops/report-catalog";
import { canOpenReport } from "@/lib/ops/reports/registry";
import { scheduleLabel, type ReportRun } from "@/lib/ops/reports/schedules";
import { PERIOD_LABELS, type PeriodPreset } from "@/lib/ops/reports/period";
import { WORK_LABELS, type ReportOptions } from "@/lib/ops/reports/options";
import styles from "./report-schedules.module.css";

const NOTICES: Record<string, string> = {
  "schedule-created": "Schedule saved.",
  "schedule-paused": "Schedule paused.",
  "schedule-resumed": "Schedule turned back on.",
  "schedule-removed": "Schedule removed.",
  "schedule-sent": "Report saved now. Open it below.",
};

function optionsLine(json: string, audience?: string) {
  try {
    const o = JSON.parse(json) as ReportOptions;
    const parts = [PERIOD_LABELS[o.period as PeriodPreset] ?? o.period];
    if (audience === "both" && o.work !== "both") parts.push(WORK_LABELS[o.work]);
    if (o.detail === "all") parts.push("Every record");
    return parts.join(" · ");
  } catch { return ""; }
}

/** Saved report schedules and their latest runs. Without email, each run is still saved here to open. */
export async function ReportSchedules({ notice }: { notice?: string }) {
  const session = await loadOperatorSession();
  const repository = await getServerOpsRepository();
  const [schedules, runs, people, organization] = await Promise.all([
    repository.listReportSchedules(session.organizationId),
    repository.listReportRuns(session.organizationId, 60),
    repository.listReportRecipients(session.organizationId),
    repository.getOrganization(session.organizationId),
  ]);
  const zone = organization?.timeZone ?? "America/New_York";
  const when = cachedDateTimeFormat("en-US", { timeZone: zone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const emailReady = Boolean(emailRuntimeFromEnvironment({ EMAIL_PROVIDER: process.env.EMAIL_PROVIDER, EMAIL_API_KEY: process.env.EMAIL_API_KEY, EMAIL_FROM: process.env.EMAIL_FROM, EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO, NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL }).provider);
  const names = new Map(people.map(p => [p.membershipId, p.name]));
  const visible = schedules.filter(s => { const entry = reportCatalogEntry(s.reportId); return entry && canOpenReport(entry, session.role); });
  const canManage = (createdBy?: string) => ["executive", "facilities"].includes(session.role) || createdBy === session.membershipId;
  const delivery = (run: ReportRun) => run.deliveryStatus === "sent" ? { text: "Emailed", tone: styles.good }
    : run.deliveryStatus === "no_recipients" ? { text: "No one to send to", tone: styles.warn }
    : run.deliveryStatus === "failed" ? { text: "Email failed", tone: styles.bad }
    : run.deliveryStatus === "email_not_set_up" || !emailReady ? { text: "Saved · email not set up yet", tone: styles.muted }
    : { text: "Sending", tone: styles.muted };
  return (
    <section className={styles.panel} aria-labelledby="report-schedules">
      <header>
        <div><h2 id="report-schedules"><CalendarClock size={19} aria-hidden="true" /> Scheduled reports</h2>
          <p>{emailReady ? "Each send emails a link. People see only the stores they have access to." : "Email isn't set up yet. Each scheduled report is still saved here on time, ready to open, print or save as PDF."}</p></div>
      </header>
      {notice && NOTICES[notice] ? <p className={styles.notice} role="status">{NOTICES[notice]}</p> : null}
      {visible.length === 0 ? <p className={styles.empty}>No schedules yet. Open a report and choose <strong>Schedule</strong>, or use Schedule on any report above.</p> : (
        <ul className={styles.list}>
          {visible.map(s => {
            const entry = reportCatalogEntry(s.reportId);
            const recent = runs.filter(r => r.scheduleId === s.id).slice(0, 3);
            const to = (JSON.parse(s.recipientsJson) as string[]).map(id => names.get(id) ?? "Former member");
            return (
              <li key={s.id}>
                <div className={styles.main}>
                  <h3><Link href={`/app/reports/${s.reportId}`}>{s.title}</Link> {s.status === "paused" ? <span className={styles.paused}>Paused</span> : null}</h3>
                  <p className={styles.facts}>{scheduleLabel(s)} · {optionsLine(s.optionsJson, entry?.audience)}</p>
                  <p className={styles.facts}>To {to.slice(0, 4).join(", ")}{to.length > 4 ? ` +${to.length - 4} more` : ""}</p>
                  <p className={styles.facts}>{s.status === "active" && s.nextRunAt ? <>Next: <strong>{when.format(new Date(s.nextRunAt))}</strong></> : "Not sending while paused"} · Made by {s.createdByName}</p>
                  {recent.length ? (
                    <ul className={styles.runs} aria-label="Recent sends">
                      {recent.map(run => { const d = delivery(run); return (
                        <li key={run.id}><Link href={`/app/reports/runs/${encodeURIComponent(run.id)}`}>{run.periodLabel}</Link><span>{when.format(new Date(run.runAt))}</span><span className={d.tone}>{d.text}</span></li>
                      ); })}
                    </ul>
                  ) : null}
                </div>
                {canManage(s.createdByMembershipId) ? (
                  <form className={styles.actions} method="post" action={`/api/ops/report-schedules/${encodeURIComponent(s.id)}`}>
                    <input type="hidden" name="version" value={s.version} />
                    <button name="action" value="send_now">Send now</button>
                    {s.status === "active" ? <button name="action" value="pause">Pause</button> : <button name="action" value="resume">Turn on</button>}
                    <button name="action" value="remove" className={styles.remove}>Remove</button>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
