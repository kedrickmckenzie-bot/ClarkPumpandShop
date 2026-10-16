import { StoreJump } from "@/components/ops/store-jump";
import Link from "next/link";
import { ReviewRouteButton } from "./review-routing";
import { plainNextAction } from "@/lib/ops/dispatch-calendar";
import { plainDay, plainDue } from "@/lib/ops/plain-time";
import { stuckFor } from "@/lib/ops/tech-week";
import type { DecideRow, DecideSection, DecideStage, SentRow } from "@/lib/server/review-decide";
import styles from "./review-decide.module.css";

const copy: Record<DecideStage, { title: string; hint: string; empty: string }> = {
  new: { title: "New · needs a decision", hint: "Decide who handles it, pick a quote or vendor, or set a date.", empty: "Nothing new to decide." },
  stuck: { title: "Stuck", hint: "Waiting on parts, help or a decision.", empty: "Nothing is stuck." },
  done: { title: "Done · needs a check", hint: "Reported fixed. Confirm it works, then close it.", empty: "Nothing is waiting for a check." },
};

/** New items that are a specific decision rather than "who handles this" open their own page. */
const decisionButton: Record<string, string> = { approve_quote: "Review quote", review_warranty: "Check warranty", schedule_service: "Set the date", schedule_return_visit: "Open job" };

function Row({ row, stage, asOf, canRoute }: { row: DecideRow; stage: DecideStage; asOf: string; canRoute: boolean }) {
  const recordId = row.workOrderId ?? row.serviceRequestId;
  const decision = stage === "new" ? decisionButton[row.taskType ?? ""] : undefined;
  const kind = row.workOrderId ? "work" : "request";
  const due = row.dueAt ? plainDue(row.dueAt, asOf) : undefined;
  const urgent = row.priority === "critical" || row.priority === "high";
  return <li className={styles.row}>
    <div className={styles.main}>
      <p className={styles.problem}>
        {row.problem ?? row.title}
        {urgent ? <span className={styles.urgent}>Urgent</span> : null}
        {row.foundBy ? <span className={styles.found}>Reported by {row.foundBy}</span> : null}
      </p>
      {stage !== "new" || decision ? <p className={styles.need}>{[row.title, ...(row.alsoNeeds ?? [])].map(plainNextAction).join(" · ")}</p> : null}
      <p className={styles.meta}>
        {row.storeLabel ?? "Companywide"}
        {row.workNumber ?? row.requestReference ? ` · ${row.workNumber ?? row.requestReference}` : ""}
        {row.stuckSince ? <> · <span className={styles.stuckFor}>stuck {stuckFor(row.stuckSince, asOf)}</span></> : row.reportedAt ? ` · reported ${plainDay(row.reportedAt, asOf)}` : ""}
        {due ? <> · <span className={due.late ? styles.late : undefined}>{due.text}</span></> : null}
      </p>
    </div>
    <div className={styles.actions}>
      {stage === "done" || decision
        ? <Link className={`${styles.btn} ${styles.btnPrimary}`} href={row.linkHref}>{decision ?? (row.taskType === "close_verified_work" ? "Close it" : "Check it")}</Link>
        : canRoute && recordId
          ? <ReviewRouteButton id={recordId} kind={kind} label={stage === "new" ? "Decide" : "Review"} primary/>
          : <Link className={`${styles.btn} ${styles.btnPrimary}`} href={row.linkHref}>Open</Link>}
      {stage !== "done" && !decision && canRoute && recordId ? <Link className={styles.btn} href={row.linkHref}>Details</Link> : null}
    </div>
  </li>;
}

function SentByTechs({ rows, asOf, canRoute }: { rows: SentRow[]; asOf: string; canRoute: boolean }) {
  if (!rows.length) return null;
  return <section className={`${styles.section} ${styles.sent}`} aria-label="Sent by techs">
    <div className={styles.sectionHead}>
      <h2>Sent by techs ({rows.length})</h2>
      <p>Problems techs found on site. Choose who handles each one.</p>
    </div>
    <ul className={styles.list}>{rows.map(row => {
      const due = row.dueAt ? plainDue(row.dueAt, asOf) : undefined;
      return <li key={row.id} className={styles.row}>
        <div className={styles.main}>
          <p className={styles.problem}>{row.problem}<span className={styles.found}>Reported by {row.foundBy}</span></p>
          <p className={styles.meta}>
            {row.storeLabel} · {row.number} · reported {plainDay(row.reportedAt, asOf)}
            {due ? <> · <span className={due.late ? styles.late : undefined}>{due.text}</span></> : null}
          </p>
        </div>
        <div className={styles.actions}>
          {canRoute ? <ReviewRouteButton id={row.id} kind="work" label="Decide" primary/> : null}
          <Link className={canRoute ? styles.btn : `${styles.btn} ${styles.btnPrimary}`} href={`/app/work-orders/${encodeURIComponent(row.id)}`}>{canRoute ? "Details" : "Open"}</Link>
        </div>
      </li>;
    })}</ul>
  </section>;
}

/** Review's default view for managers: three short sections that each end in one decision. */
export function ReviewDecide({ sections, sent = [], allOpenCount, asOf, canRoute, storeQuery }: {
  sections: DecideSection[]; sent?: SentRow[]; allOpenCount: number; asOf: string; canRoute: boolean; storeQuery?: string;
}) {
  const href = (extra: Record<string, string>) => `/app/action-center?${new URLSearchParams({ lane: "all", ...extra, ...(storeQuery ? { store: storeQuery } : {}) })}`;
  return <div className={styles.page}>
    <header className={styles.header}>
      <div>
        <h1>Review</h1>
        <p>Decide how each job gets handled.</p>
      </div>
      <Link className={styles.allLink} href={href({})}>See everything open ({allOpenCount}) →</Link>
    </header>
    <StoreJump />
    <SentByTechs rows={sent} asOf={asOf} canRoute={canRoute}/>
    {sections.map(section => <section key={section.stage} className={styles.section} aria-label={copy[section.stage].title}>
      <div className={styles.sectionHead}>
        <h2>{copy[section.stage].title} ({section.totalCount})</h2>
        <p>{copy[section.stage].hint}</p>
      </div>
      {section.rows.length
        ? <ul className={styles.list}>{section.rows.map(row => <Row key={row.id} row={row} stage={section.stage} asOf={asOf} canRoute={canRoute}/>)}</ul>
        : <p className={styles.empty}>{copy[section.stage].empty}</p>}
      {section.totalCount > section.rows.reduce((n, row) => n + 1 + (row.alsoNeeds?.length ?? 0), 0) ? <Link className={styles.more} href={href({ stage: section.stage })}>Show all {section.totalCount} →</Link> : null}
    </section>)}
  </div>;
}
