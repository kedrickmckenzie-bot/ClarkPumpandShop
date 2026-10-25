import { StoreJump } from "@/components/ops/store-jump";
import Link from "next/link";
import { ReviewRouteButton } from "./review-routing";
import { plainNextAction } from "@/lib/ops/dispatch-calendar";
import { plainDay, plainDue } from "@/lib/ops/plain-time";
import { stuckFor } from "@/lib/ops/tech-week";
import type { DecideSection, DecideStage, ReviewItem, SentRow, StoreGroup } from "@/lib/server/review-decide";
import styles from "./review-decide.module.css";

const copy: Record<DecideStage, { title: string; hint: string; tag: string }> = {
  new: { title: "New · needs a decision", hint: "Decide who handles it, pick a quote or vendor, or set a date.", tag: "New" },
  stuck: { title: "Stuck", hint: "Waiting on parts, help or a decision.", tag: "Stuck" },
  done: { title: "Done · needs a check", hint: "Reported fixed. Confirm it works, then close it.", tag: "To check" },
};

/** New items that are a specific decision rather than "who handles this" open their own page. */
const decisionButton: Record<string, string> = { approve_quote: "Review quote", review_warranty: "Check warranty", schedule_service: "Set the date", schedule_return_visit: "Open job" };

type View = "mine" | "help" | "waiting";
const PAGE_SIZE = 25;
interface Props {
  view: View; sections: DecideSection[]; sent: SentRow[]; help: ReviewItem[]; onsiteByStore: StoreGroup[]; waiting: ReviewItem[];
  /** On-site work and items waiting on others: what someone else has to move. */
  stuck: ReviewItem[];
  counts: { mine: number; help: number; onsite: number; waiting: number; stores: number };
  asOf: string; canRoute: boolean; storeQuery?: string;
  /** A store manager sees their own to-dos and what is open at their store, not other stores' work to pick up. */
  storeView?: boolean;
  page?: number; q?: string;
  /** Set after a nudge: the item nudged, and whether it went to the next person up. */
  nudged?: { taskId: string; escalated: boolean };
}

function Actions({ row, canRoute }: { row: ReviewItem; canRoute: boolean }) {
  const recordId = row.workOrderId ?? row.serviceRequestId;
  const decision = row.stage === "new" ? decisionButton[row.taskType ?? ""] : undefined;
  const kind = row.workOrderId ? "work" : "request";
  return <div className={styles.actions}>
    {row.stage === "done" || decision
      ? <Link className={`${styles.btn} ${styles.btnPrimary}`} href={row.linkHref}>{decision ?? (row.taskType === "close_verified_work" ? "Close it" : "Check it")}</Link>
      : canRoute && recordId
        ? <ReviewRouteButton id={recordId} kind={kind} label={row.stage === "new" ? "Decide" : "Review"} primary/>
        : <Link className={`${styles.btn} ${styles.btnPrimary}`} href={row.linkHref}>Open</Link>}
    {row.stage !== "done" && !decision && canRoute && recordId ? <Link className={styles.btn} href={row.linkHref}>Details</Link> : null}
  </div>;
}

/** One job: the problem in bold, what it needs, then where and how long. */
/** Ask whoever it waits on to move it. Once a day per person; the third nudge sends it to the next person up. */
function Nudge({ row, returnTo }: { row: ReviewItem; returnTo: string }) {
  if (!row.nudge) return null;
  if (row.nudge.nudgedToday) return <span className={styles.nudged}>Nudged today</span>;
  return <form method="post" action="/api/ops/review/nudge" className={styles.nudgeForm}>
    <input type="hidden" name="taskId" value={row.id}/><input type="hidden" name="returnTo" value={returnTo}/>
    <button type="submit" className={styles.btn}>Nudge</button>
  </form>;
}

function Row({ row, asOf, canRoute, showStage, showWho, viewOnly, returnTo }: { row: ReviewItem; asOf: string; canRoute: boolean; showStage?: boolean; showWho?: boolean; viewOnly?: boolean; returnTo?: string }) {
  const due = row.dueAt ? plainDue(row.dueAt, asOf) : undefined;
  const urgent = row.priority === "critical" || row.priority === "high";
  const decision = row.stage === "new" ? decisionButton[row.taskType ?? ""] : undefined;
  return <li className={styles.row}>
    <div className={styles.main}>
      <p className={styles.problem}>
        {showStage ? <span className={`${styles.stage} ${styles[row.stage]}`}>{copy[row.stage].tag}</span> : null}
        {row.problem ?? row.title}
        {urgent ? <span className={styles.urgent}>Urgent</span> : null}
        {row.foundBy ? <span className={styles.found}>Reported by {row.foundBy}</span> : null}
      </p>
      {row.stage !== "new" || decision || showStage ? <p className={styles.need}>{[row.title, ...(row.alsoNeeds ?? [])].map(plainNextAction).join(" · ")}</p> : null}
      <p className={styles.meta}>
        {row.storeLabel ?? "Companywide"}
        {row.workNumber ?? row.requestReference ? ` · ${row.workNumber ?? row.requestReference}` : ""}
        {showWho ? <> · Waiting on <span className={styles.who}>{row.waitingOn}</span>{row.waitingSince ? <> for <span className={styles.stuckFor}>{stuckFor(row.waitingSince, asOf)}</span></> : ""}{row.nudge?.count ? ` · nudged ${row.nudge.count} ${row.nudge.count === 1 ? "time" : "times"}` : ""}</>
          : row.stuckSince ? <> · <span className={styles.stuckFor}>stuck {stuckFor(row.stuckSince, asOf)}</span></> : row.reportedAt ? ` · reported ${plainDay(row.reportedAt, asOf)}` : ""}
        {due ? <> · <span className={due.late ? styles.late : undefined}>{due.text}</span></> : null}
      </p>
    </div>
    {viewOnly ? <div className={styles.actions}>{returnTo ? <Nudge row={row} returnTo={returnTo}/> : null}<Link className={styles.btn} href={row.linkHref}>Open</Link></div> : <Actions row={row} canRoute={canRoute}/>}
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

/**
 * Review: what needs me, what I can help with, and what is stuck with someone else. Everyone sees the stuck work in
 * their stores and can nudge it; nobody can approve or take over work above their role from here.
 */
export function ReviewDecide(props: Props) {
  const { view, counts, storeQuery, q } = props;
  const link = (extra: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ store: storeQuery, q, ...extra })) if (value) params.set(key, value);
    return `/app/action-center?${params}`;
  };
  const tiles: Array<{ id: View; label: string; value: number; hint: string }> = [
    { id: "mine", label: "Needs me", value: counts.mine, hint: "Only you can do these" },
    ...(props.storeView ? [] : [{ id: "help" as const, label: "I can help", value: counts.help, hint: "Someone else's, but you're allowed to do it" }]),
    { id: "waiting", label: "Stuck with someone else", value: props.stuck.length, hint: "See who it's waiting on, and nudge them" },
  ];
  return <div className={styles.page}>
    <header className={styles.header}>
      <div><h1>Review</h1><p>What needs you, what you can pick up, and what&apos;s stuck.</p></div>
      {props.storeView ? null : <StoreJump />}
    </header>
    <nav className={styles.boxes} aria-label="Review views">{tiles.map(tile => <Link key={tile.id} href={link({ view: tile.id })} aria-current={view === tile.id ? "page" : undefined}>
      <span>{tile.label}</span><b>{tile.value}</b><small>{tile.hint}</small>
    </Link>)}</nav>
    {props.nudged ? <p className={styles.flash} role="status">{props.nudged.escalated ? "Nudge recorded. It's been nudged 3 times, so it went to the next person up." : "Nudge recorded on the job's history."} In this demo no email or text is sent.</p> : null}
    {view === "mine" ? <Mine {...props}/> : <Paged {...props} link={link}/>}
    <p className={styles.footer}><Link href="/app/action-center?lane=all">Search or filter every open item →</Link></p>
  </div>;
}

function Mine({ sections, sent, counts, asOf, canRoute, storeView, stuck }: Props) {
  if (!counts.mine) return <section className={`${styles.section} ${styles.caughtUp}`}>
    <h2>You&apos;re caught up</h2>
    <p>Nothing needs you right now.{!storeView && counts.help ? ` ${counts.help} ${counts.help === 1 ? "item" : "items"} you can help with.` : stuck.length ? ` ${stuck.length} stuck with someone else.` : ""}</p>
  </section>;
  return <>
    <SentByTechs rows={sent} asOf={asOf} canRoute={canRoute}/>
    {sections.filter(section => section.rows.length).map(section => <section key={section.stage} className={styles.section} aria-label={copy[section.stage].title}>
      <div className={styles.sectionHead}>
        <h2>{copy[section.stage].title} ({section.totalCount})</h2>
        <p>{copy[section.stage].hint}</p>
      </div>
      <ul className={styles.list}>{section.rows.map(row => <Row key={row.id} row={row} asOf={asOf} canRoute={canRoute}/>)}</ul>
    </section>)}
  </>;
}

const matches = (row: ReviewItem, q?: string) => !q?.trim() || [row.problem, row.title, row.storeLabel, row.workNumber, row.requestReference, row.waitingOn, row.vendorName].join(" ").toLowerCase().includes(q.trim().toLowerCase());

/** I can help, or Stuck with someone else: one list, searchable, 25 at a time. */
function Paged(props: Props & { link: (extra: Record<string, string | undefined>) => string }) {
  const { view, asOf, canRoute, link, q } = props;
  const waiting = view === "waiting";
  const all = (waiting ? [...props.stuck].sort((a, b) => {
    const lateA = a.dueAt && a.dueAt <= asOf ? 0 : 1, lateB = b.dueAt && b.dueAt <= asOf ? 0 : 1;
    return lateA - lateB || (a.waitingSince ?? "").localeCompare(b.waitingSince ?? "");
  }) : props.help).filter(row => matches(row, q));
  const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE)), page = Math.min(pages, Math.max(1, props.page ?? 1));
  const rows = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const here = link({ view, page: page > 1 ? String(page) : undefined });
  return <section className={styles.section} aria-label={waiting ? "Stuck with someone else" : "I can help"}>
    <div className={styles.sectionHead}>
      <div><h2>{waiting ? "Stuck with someone else" : "I can help"} ({all.length})</h2>
        <p>{waiting ? "Longest waiting first. Nudge the person it's waiting on." : "Assigned to someone else, but you can do it."}</p></div>
      <form method="get" action="/app/action-center" className={styles.search}>
        <input type="hidden" name="view" value={view}/>{props.storeQuery ? <input type="hidden" name="store" value={props.storeQuery}/> : null}
        <input type="search" name="q" defaultValue={q} placeholder="Search problem, store, job #" aria-label="Search this list"/>
      </form>
    </div>
    {rows.length ? <ul className={styles.list}>{rows.map(row => <Row key={row.id} row={row} asOf={asOf} canRoute={canRoute} showStage showWho viewOnly={waiting} returnTo={here}/>)}</ul>
      : <p className={styles.empty}>{q ? "Nothing matches that search." : waiting ? "Nothing is stuck with anyone else." : "Nothing to pick up right now."}</p>}
    {pages > 1 ? <nav className={styles.pager} aria-label="Pages">
      {page > 1 ? <Link href={link({ view, page: page - 1 > 1 ? String(page - 1) : undefined })}>← Previous</Link> : <span/>}
      <span>Page {page} of {pages}</span>
      {page < pages ? <Link href={link({ view, page: String(page + 1) })}>Next →</Link> : <span/>}
    </nav> : null}
  </section>;
}
