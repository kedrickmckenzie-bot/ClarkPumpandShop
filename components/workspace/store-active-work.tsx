import Link from "next/link";
import { roleCanAccessListRoute } from "@/components/ops/role-policy";
import { formatOperationsDateTime } from "@/lib/ops/local-time";
import { storeWorkspaceContext } from "@/lib/server/store-workspace-context";
import styles from "./store-tasks.module.css";

const OPEN_STATUSES = ["draft", "awaiting_approval", "approved", "issued", "accepted", "scheduled", "in_progress", "waiting_on_vendor", "waiting_on_parts", "completed_pending_review", "resolved"] as const;
const SHOWN = 8;

/** Store overview: what needs attention and the work that is open, with who handles it and what happens next. */
export async function StoreActiveWork({ id }: { id: string }) {
  const { session, repository, store } = await storeWorkspaceContext(id);
  if (!roleCanAccessListRoute(session.role, "work-orders")) return null;
  const scope = { ...session, storeIds: [id] }, today = new Date().toISOString().slice(0, 10);
  const [open, confirm, inspections, scheduled] = await Promise.all([
    repository.listWorkOrders(scope, { storeId: id, statuses: OPEN_STATUSES, limit: 50 }),
    repository.listWorkOrders(scope, { storeId: id, needsConfirmation: true, limit: 5 }),
    repository.queryInspections(scope, { today, storeId: id, limit: 1 }),
    repository.listWorkOrders(scope, { storeId: id, statuses: ["scheduled"], limit: 20 }),
  ]);
  const base = `/app/stores/${encodeURIComponent(id)}`;
  const openCount = open.totalCount ?? open.items.length;
  const rows = [...open.items].sort((a, b) => (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999")).slice(0, SHOWN);
  const nowIso = new Date().toISOString();
  const confirmCount = confirm.totalCount ?? confirm.items.length;
  const upcoming = scheduled.items.filter((work) => work.dueAt && work.dueAt >= nowIso).sort((a, b) => a.dueAt!.localeCompare(b.dueAt!)).slice(0, 3);
  // Each confirmation says what happened and who confirms, next to the button that does it.
  const confirmations = confirm.items.slice(0, 3).map((work) => ({
    key: work.id, href: `/app/work-orders/${encodeURIComponent(work.id)}?view=confirmation#work-verification`,
    title: `${work.number} · ${work.problem}`,
    detail: `${work.vendorName ?? "The technician"} reports the work completed${work.updatedAt ? ` ${formatOperationsDateTime(work.updatedAt, store.timeZone)}` : ""}.`,
    who: `${work.accountableParty}: confirm it's working.`,
  }));
  const attention = [
    ...(confirmCount > 3 ? [{ key: "confirm-all", href: `/app/work-orders?${new URLSearchParams({ store: id, status: "confirmation" })}`, text: `See all ${confirmCount} repairs to confirm` }] : []),
    ...(inspections.summary.overdue ? [{ key: "overdue", href: `${base}/compliance?view=overdue`, text: `${inspections.summary.overdue} overdue inspection${inspections.summary.overdue === 1 ? "" : "s"}` }] : []),
    ...(inspections.summary.action_needed ? [{ key: "findings", href: `${base}/compliance?view=action_needed`, text: `${inspections.summary.action_needed} inspection finding${inspections.summary.action_needed === 1 ? "" : "s"} to fix` }] : []),
  ];
  const allHref = `/app/work-orders?${new URLSearchParams({ store: id, status: "open" })}`;
  return <>
    {attention.length || confirmations.length ? <section className={`${styles.page} ${styles.panel} ${styles.fullWidth}`} aria-labelledby="store-attention">
      <header className={styles.header}><h2 id="store-attention">Needs attention</h2></header>
      {confirmations.length ? <ul className={styles.decisionList}>{confirmations.map((item) => <li key={item.key}>
        <div><strong>{item.title}</strong><p>{item.detail}</p><p className={styles.muted}>{item.who}</p></div>
        <Link className={styles.addAction} href={item.href}>Confirm result</Link>
      </li>)}</ul> : null}
      {attention.length ? <ul className={styles.attentionList}>{attention.map((item) => <li key={item.key}><Link href={item.href}>{item.text}</Link></li>)}</ul> : null}
    </section> : null}
    <section className={`${styles.page} ${styles.panel} ${styles.fullWidth}`} aria-labelledby="store-upcoming">
      <header className={styles.header}><h2 id="store-upcoming">Upcoming visits</h2><Link href={`${base}?section=work`}>All visits →</Link></header>
      {upcoming.length ? <ul className={styles.decisionList}>{upcoming.map((work) => <li key={work.id}>
        <div><strong>{formatOperationsDateTime(work.dueAt!, store.timeZone)}</strong><p>{work.vendorName ?? work.accountableParty} · <Link href={`/app/work-orders/${encodeURIComponent(work.id)}`}>{work.number}</Link> · {work.problem}</p></div>
      </li>)}</ul> : <p className={styles.muted}>No visits scheduled.</p>}
    </section>
    <section className={`${styles.page} ${styles.panel} ${styles.fullWidth}`} aria-labelledby="store-active-work">
      <header className={styles.header}><h2 id="store-active-work"><Link href={allHref}>{openCount} open job{openCount === 1 ? "" : "s"}</Link></h2><Link href={allHref}>All open work →</Link></header>
      {rows.length ? <div className={styles.scroll}><table className={styles.table}>
        <thead><tr><th>Job</th><th>Who&apos;s handling it</th><th>Next step</th><th>Due</th></tr></thead>
        <tbody>{rows.map((work) => <tr key={work.id}>
          <td data-label="Job"><Link href={`/app/work-orders/${encodeURIComponent(work.id)}`}>{work.problem}</Link><p className={styles.muted}>{work.number}{work.priority === "urgent" || work.priority === "emergency" ? ` · ${work.priority === "urgent" ? "Urgent" : "Emergency"}` : ""}</p></td>
          <td data-label="Who's handling it">{work.accountableParty}{work.vendorName && work.vendorName !== work.accountableParty ? <p className={styles.muted}>Vendor: {work.vendorName}</p> : null}</td>
          <td data-label="Next step">{work.nextAction}</td>
          <td data-label="Due">{work.dueAt ? <>{formatOperationsDateTime(work.dueAt, store.timeZone)}{work.dueAt < nowIso ? <p className={styles.muted}>Overdue</p> : null}</> : "No date"}</td>
        </tr>)}</tbody>
      </table></div> : <p className={styles.muted}>No open work at this store.</p>}
      {openCount > rows.length ? <p className={styles.muted}><Link href={allHref}>Show all {openCount} open jobs</Link></p> : null}
    </section>
  </>;
}
