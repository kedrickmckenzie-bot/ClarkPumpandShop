import Link from "next/link";
import { dispatchPlanLabel } from "@/lib/ops/dispatch-board";
import { oneLine } from "@/lib/product/one-line";
import { providerKindLabel, providerName } from "@/lib/product/provider-label";
import { roleCanAccessListRoute } from "@/components/ops/role-policy";
import { formatOperationsDateTime } from "@/lib/ops/local-time";
import { completionSummary } from "@/lib/ops/work-order-outcome";
import { storeWorkspaceContext } from "@/lib/server/store-workspace-context";
import { getServerOpsReportingAsOf } from "@/lib/server/ops-repository-provider";
import styles from "./store-tasks.module.css";

const OPEN_STATUSES = ["draft", "awaiting_approval", "approved", "issued", "accepted", "scheduled", "in_progress", "waiting_on_vendor", "waiting_on_parts", "completed_pending_review", "resolved"] as const;
const SHOWN = 8;

/** Store overview: what needs attention and the work that is open, with who handles it and what happens next. */
export async function StoreActiveWork({ id }: { id: string }) {
  const { session, repository, store } = await storeWorkspaceContext(id);
  if (!roleCanAccessListRoute(session.role, "work-orders")) return null;
  const scope = { ...session, storeIds: [id] }, today = new Date().toISOString().slice(0, 10);
  const [open, confirm, inspections, upcoming] = await Promise.all([
    repository.listWorkOrders(scope, { storeId: id, statuses: OPEN_STATUSES, limit: 50 }),
    repository.listWorkOrders(scope, { storeId: id, needsConfirmation: true, limit: 5 }),
    repository.queryInspections(scope, { today, storeId: id, limit: 1 }),
    // Confirmed vendor appointments (not work-order deadlines), next first.
    repository.listUpcomingAppointments(scope, { storeId: id, now: getServerOpsReportingAsOf(), limit: 3 }),
  ]);

  const base = `/app/stores/${encodeURIComponent(id)}`;
  const openCount = open.totalCount ?? open.items.length;
  const rows = [...open.items].sort((a, b) => (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999")).slice(0, SHOWN);
  const nowIso = new Date().toISOString();
  const confirmCount = confirm.totalCount ?? confirm.items.length;
  // Each confirmation says who recorded the result and when (from the outcome record), next to the button.
  const outcomes = await Promise.all(confirm.items.slice(0, 3).map((work) => repository.listWorkOutcomesForWorkOrder(session.organizationId, work.id)));
  const confirmations = confirm.items.slice(0, 3).map((work, index) => ({
    key: work.id, href: `/app/work-orders/${encodeURIComponent(work.id)}?view=confirmation#work-verification`,
    title: `${work.number} · ${oneLine(work.problem)}`,
    detail: completionSummary(outcomes[index], (iso) => formatOperationsDateTime(iso, store.timeZone)),
    who: `${work.accountableParty}: confirm it's working.`,
  }));
  const attention = [
    ...(confirmCount > 3 ? [{ key: "confirm-all", href: `/app/work-orders?${new URLSearchParams({ store: id, status: "confirmation" })}`, text: `See all ${confirmCount} repairs to confirm` }] : []),
    ...(inspections.summary.overdue ? [{ key: "overdue", href: `${base}/compliance?view=overdue`, text: `${inspections.summary.overdue} overdue inspection${inspections.summary.overdue === 1 ? "" : "s"}` }] : []),
    ...(inspections.summary.performed ? [{ key: "awaiting", href: `${base}/compliance?view=performed`, text: `${inspections.summary.performed} inspection${inspections.summary.performed === 1 ? "" : "s"} awaiting review` }] : []),
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
      <header className={styles.header}><h2 id="store-upcoming">Upcoming visits</h2><Link href={`/app/visits?${new URLSearchParams({ status: "upcoming", store: id })}`}>{(upcoming.totalCount ?? 0) > upcoming.items.length ? `All ${upcoming.totalCount} upcoming visits →` : "All upcoming visits →"}</Link></header>
      {upcoming.items.length ? <ul className={styles.decisionList}>{upcoming.items.map((visit) => <li key={visit.id}>
        <div><strong>{formatOperationsDateTime(visit.startsAt, visit.timeZone)}</strong><p>{visit.vendorName} · <Link href={`/app/work-orders/${encodeURIComponent(visit.workOrderId)}?view=service`}>{visit.workOrderNumber}</Link> · {visit.problem}</p></div>
      </li>)}</ul> : <p className={styles.muted}>No confirmed visits coming up.</p>}
    </section>
    <section className={`${styles.page} ${styles.panel} ${styles.fullWidth}`} aria-labelledby="store-active-work">
      <header className={styles.header}><h2 id="store-active-work"><Link href={allHref}>{openCount} open job{openCount === 1 ? "" : "s"}</Link></h2><Link href={allHref}>All open work →</Link></header>
      {rows.length ? <div className={styles.scroll}><table className={styles.table}>
        <thead><tr><th>Job</th><th>Who&apos;s handling it</th><th>Next step</th><th>Due</th></tr></thead>
        <tbody>{rows.map((work) => <tr key={work.id}>
          <td data-label="Job"><Link href={`/app/work-orders/${encodeURIComponent(work.id)}`}>{oneLine(work.problem)}</Link><p className={styles.muted}>{work.number}{work.priority === "urgent" || work.priority === "emergency" ? ` · ${work.priority === "urgent" ? "Urgent" : "Emergency"}` : ""}</p></td>
          <td data-label="Who's handling it">{work.accountableParty}{work.assignmentKind !== "choose_later" ? <p className={styles.muted}>{providerKindLabel(work.assignmentKind)}: {providerName({ kind: work.assignmentKind, vendorName: work.vendorName, internalName: work.internalAssigneeName })}</p> : null}</td>
          <td data-label="Next step">{work.nextAction}{work.assignmentKind==="internal"?<>{work.schedule?<p>When: {dispatchPlanLabel(work.schedule,store.timeZone??"America/New_York")}</p>:null}{work.targetCompletionAt?<p>Finish by: {formatOperationsDateTime(work.targetCompletionAt,store.timeZone)}</p>:null}</>:null}</td>
          <td data-label="Due">{work.dueAt ? <>{formatOperationsDateTime(work.dueAt, store.timeZone)}{work.dueAt < nowIso ? <p className={styles.muted}>Overdue</p> : null}</> : "No date"}</td>
        </tr>)}</tbody>
      </table></div> : <p className={styles.muted}>No open work at this store.</p>}
      {openCount > rows.length ? <p className={styles.muted}><Link href={allHref}>Show all {openCount} open jobs</Link></p> : null}
    </section>
  </>;
}

/** One line of store context: active warranties, vendors and inspections awaiting review, each opening its list. */
export async function StoreContextRow({ id }: { id: string }) {
  const { session, repository } = await storeWorkspaceContext(id);
  const scope = { ...session, storeIds: [id] }, today = new Date().toISOString().slice(0, 10), base = `/app/stores/${encodeURIComponent(id)}`;
  const inspections = await repository.queryInspections(scope, { today, storeId: id, limit: 1 });
  const [warranties, vendors] = await Promise.all([
    repository.listWarrantyDirectory(scope, { today, view: "active", limit: 1 }).catch(() => null),
    repository.queryStoreVendors(scope, id, {}).catch(() => null),
  ]);
  const preferred = vendors?.preferredTotal ?? 0, covering = vendors?.coveredTotal ?? 0;
  const context = [
    warranties ? { key: "warranties", href: `${base}/warranties`, text: `${warranties.totalCount} active ${warranties.totalCount === 1 ? "warranty" : "warranties"}` } : null,
    vendors ? { key: "vendors", href: `${base}/vendors`, text: preferred ? `${preferred} preferred ${preferred === 1 ? "vendor" : "vendors"} · ${covering} covering` : `${covering} ${covering === 1 ? "vendor covers" : "vendors cover"} this store` } : null,
    { key: "inspections", href: `${base}/compliance?view=performed`, text: `${inspections.summary.performed ?? 0} ${inspections.summary.performed === 1 ? "inspection" : "inspections"} awaiting review` },
  ].filter((item): item is { key: string; href: string; text: string } => Boolean(item));
  return <nav className={`${styles.contextRow} ${styles.fullWidth}`} aria-label="Store context">{context.map((item) => <Link key={item.key} href={item.href}>{item.text} →</Link>)}</nav>;
}
