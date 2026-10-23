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
const HELP_SHOWN = 8;

type View = "mine" | "stores";
interface Props {
  view: View; sections: DecideSection[]; sent: SentRow[]; help: ReviewItem[]; onsiteByStore: StoreGroup[]; waiting: ReviewItem[];
  counts: { mine: number; help: number; onsite: number; waiting: number; stores: number };
  asOf: string; canRoute: boolean; storeQuery?: string; showOnsite: boolean; showAllHelp: boolean;
  /** A store manager sees their own to-dos and what is open at their store, not other stores' work to pick up. */
  storeView?: boolean;
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
function Row({ row, asOf, canRoute, showStage, showWho, viewOnly }: { row: ReviewItem; asOf: string; canRoute: boolean; showStage?: boolean; showWho?: boolean; viewOnly?: boolean }) {
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
        {showWho ? <> · Waiting on <span className={styles.who}>{row.waitingOn}</span>{row.waitingSince ? ` since ${plainDay(row.waitingSince, asOf)}` : ""}</>
          : row.stuckSince ? <> · <span className={styles.stuckFor}>stuck {stuckFor(row.stuckSince, asOf)}</span></> : row.reportedAt ? ` · reported ${plainDay(row.reportedAt, asOf)}` : ""}
        {due ? <> · <span className={due.late ? styles.late : undefined}>{due.text}</span></> : null}
      </p>
    </div>
    {viewOnly ? <div className={styles.actions}><Link className={styles.btn} href={row.linkHref}>Open</Link></div> : <Actions row={row} canRoute={canRoute}/>}
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
 * Review for managers. "Mine" is only what needs this person. "My stores" is everything else open in their stores:
 * what they can help with from anywhere, on-site work (hidden until asked for, but always counted), and what waits on others.
 */
export function ReviewDecide(props: Props) {
  const { view, counts, storeQuery } = props;
  const link = (extra: Record<string, string>, hash = "") => `/app/action-center?${new URLSearchParams({ ...(storeQuery ? { store: storeQuery } : {}), ...extra })}${hash}`;
  const mineTotal = counts.mine;
  return <div className={styles.page}>
    <header className={styles.header}>
      <div>
        <h1>Review</h1>
        <p>{view === "mine" ? "What needs you." : props.storeView ? "Everything open at your store, and who it's waiting on." : "Everything open in your stores."}</p>
      </div>
      {props.storeView ? null : <StoreJump />}
    </header>
    <nav className={styles.tabs} aria-label="Review views">
      <Link href={link({ view: "mine" })} aria-current={view === "mine" ? "page" : undefined}>Mine <b>{mineTotal}</b></Link>
      <Link href={link({ view: "stores" })} aria-current={view === "stores" ? "page" : undefined}>{props.storeView ? "My store" : "My stores"} <b>{counts.stores}</b></Link>
    </nav>
    {view === "mine" ? <Mine {...props}/> : props.storeView ? <StoreStatus {...props}/> : <Stores {...props} link={link}/>}
    <p className={styles.footer}><Link href={link({ lane: "all" })}>Search or filter every open item →</Link></p>
  </div>;
}

function Mine({ sections, sent, counts, asOf, canRoute, storeQuery }: Props) {
  const link = `/app/action-center?${new URLSearchParams({ view: "stores", ...(storeQuery ? { store: storeQuery } : {}) })}`;
  if (!counts.mine) return <section className={`${styles.section} ${styles.caughtUp}`}>
    <h2>You&apos;re caught up</h2>
    <p>Nothing needs you right now.</p>
    {counts.help ? <Link className={`${styles.btn} ${styles.btnPrimary}`} href={link}>See {counts.help} {counts.help === 1 ? "item" : "items"} you can help with</Link>
      : counts.stores ? <Link className={styles.btn} href={link}>See what&apos;s open ({counts.stores})</Link> : null}
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

function Stores({ help, onsiteByStore, waiting, counts, asOf, canRoute, showOnsite, showAllHelp, link }: Props & { link: (extra: Record<string, string>, hash?: string) => string }) {
  const keep = { view: "stores", ...(showOnsite ? { onsite: "1" } : {}), ...(showAllHelp ? { helpAll: "1" } : {}) };
  const shownHelp = showAllHelp ? help : help.slice(0, HELP_SHOWN);
  return <>
    <div className={styles.summary}>
      <a href="#help"><b>{counts.help}</b> you can help with</a>
      <a href="#onsite"><b>{counts.onsite}</b> need someone on site</a>
      <a href="#waiting"><b>{counts.waiting}</b> waiting on others</a>
    </div>

    <section id="help" className={styles.section} aria-label="You can help">
      <div className={styles.sectionHead}>
        <h2>You can help ({counts.help})</h2>
        <p>Assigned to someone else, but you can do it from anywhere.</p>
      </div>
      {help.length ? <ul className={styles.list}>{shownHelp.map(row => <Row key={row.id} row={row} asOf={asOf} canRoute={canRoute} showStage showWho/>)}</ul>
        : <p className={styles.empty}>Nothing to pick up right now.</p>}
      {help.length > shownHelp.length ? <Link className={styles.more} href={link({ ...keep, helpAll: "1" }, "#help")}>Show all {help.length} →</Link> : null}
    </section>

    <section id="onsite" className={styles.section} aria-label="On-site work">
      <div className={styles.sectionHead}>
        <div><h2>On-site work ({counts.onsite})</h2><p>Needs someone at the store. Check the pile, or plan a visit.</p></div>
        {counts.onsite ? <Link className={styles.toggle} href={link(showOnsite ? { ...keep, onsite: "" } : { ...keep, onsite: "1" }, "#onsite")} aria-expanded={showOnsite}>{showOnsite ? "Hide" : `Show on-site work (${counts.onsite})`}</Link> : null}
      </div>
      {!counts.onsite ? <p className={styles.empty}>No on-site work waiting.</p>
        : !showOnsite ? <ul className={styles.storePeek}>{onsiteByStore.slice(0, 6).map(group => <li key={group.storeId}><b>{group.storeLabel}</b> · {group.rows.length} {group.rows.length === 1 ? "item" : "items"}{group.oldest ? ` · oldest ${plainDay(group.oldest, asOf)}` : ""}</li>)}{onsiteByStore.length > 6 ? <li>and {onsiteByStore.length - 6} more stores</li> : null}</ul>
          : onsiteByStore.map(group => <div key={group.storeId} className={styles.storeGroup}>
            <h3>{group.storeLabel} <span>· {group.rows.length} {group.rows.length === 1 ? "item" : "items"}{group.oldest ? ` · oldest ${plainDay(group.oldest, asOf)}` : ""}</span></h3>
            <ul className={styles.list}>{group.rows.map(row => <Row key={row.id} row={row} asOf={asOf} canRoute={canRoute} showStage showWho/>)}</ul>
          </div>)}
    </section>

    <section id="waiting" className={styles.section} aria-label="Waiting on others">
      <details>
        <summary className={styles.sectionHead}><div><h2>Waiting on others ({counts.waiting})</h2><p>A vendor, a higher approval, or a date that hasn&apos;t come yet. Nothing to do unless it&apos;s late.</p></div></summary>
        {waiting.length ? <ul className={styles.list}>{waiting.map(row => <Row key={row.id} row={row} asOf={asOf} canRoute={canRoute} showStage showWho/>)}</ul> : <p className={styles.empty}>Nothing is waiting on others.</p>}
      </details>
    </section>
  </>;
}

/** A store manager's view of their store: every open item and who it is waiting on, newest decisions first. */
function StoreStatus({ waiting, counts, asOf, canRoute }: Props) {
  return <section className={styles.section} aria-label="Open at your store">
    <div className={styles.sectionHead}>
      <h2>Open at your store ({counts.stores})</h2>
      <p>Being handled by someone else. Open one to see where it stands.</p>
    </div>
    {waiting.length ? <ul className={styles.list}>{waiting.map(row => <Row key={row.id} row={row} asOf={asOf} canRoute={canRoute} showStage showWho viewOnly/>)}</ul>
      : <p className={styles.empty}>Nothing else is open at your store.</p>}
  </section>;
}
