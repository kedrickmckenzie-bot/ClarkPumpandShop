import { OpsDomainError } from "@/lib/ops/errors";
import Link from "next/link";
import { getOpsRequestContext } from "@/lib/server/ops-request-context";
import { internalDispatchScope } from "@/lib/server/internal-dispatch-context";
import { civilDate, mondayOf } from "@/lib/ops/dispatch-calendar";
import { dispatchPlanLabel, dispatchStatus } from "@/lib/ops/dispatch-board";
import { addCalendarDays } from "@/lib/ops/internal-schedule-types";
import { dispatchStatuses } from "@/lib/server/dispatch-board-page";
import type { WorkOrderListPage } from "@/lib/ops/view-models";
import styles from "@/components/workspace/dispatch-board.module.css";

async function renderTechnicianPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params, query = await searchParams;
  const { repository, session } = await getOpsRequestContext(["facilities", "regional", "executive"]);
  const actorScope = await internalDispatchScope(repository, session);
  const membership = await repository.getMembership(actorScope.organizationId, id);
  const covered = membership?.role === "internal_technician" && membership.status === "active" ? await repository.listStoreIdsForMembership(actorScope.organizationId, id) : [];
  const storeIds = actorScope.storeIds!.filter(storeId => covered.includes(storeId));
  const person = membership && storeIds.length ? await repository.getUserInOrganization(actorScope.organizationId, membership.userId) : null;
  if (!person || person.status !== "active") return <section><h1>Technician not available</h1><p>You don&apos;t have access to this technician&apos;s stores.</p><Link href="/app/dispatch">← Dispatch</Link></section>;
  const scope = { ...actorScope, storeIds }, organization = await repository.getOrganization(scope.organizationId);
  const zone = organization!.timeZone, week = mondayOf(civilDate(new Date().toISOString(), zone));
  const base = { internalMembershipId: id, maintenanceTeamOnly: true };
  const [planned, open, waiting, finished, stores] = await Promise.all([
    repository.listWorkOrders(scope, { ...base, internalOnly: true, statuses: dispatchStatuses, scheduleView: "week", scheduleFrom: week, scheduleTo: addCalendarDays(week, 6), limit: 25, cursor: query.weekCursor }),
    repository.listWorkOrders(scope, { ...base, internalOnly: true, statuses: dispatchStatuses.filter(status => !["completed_pending_review", "resolved"].includes(status)), limit: 25, cursor: query.openCursor }),
    repository.listWorkOrders(scope, { ...base, internalOnly: true, statuses: dispatchStatuses, dispatchReadiness: "waiting", limit: 25, cursor: query.waitingCursor }),
    repository.listWorkOrders(scope, { ...base, statuses: ["completed_pending_review", "resolved", "closed"], activityOrder: true, limit: 10, cursor: query.finishedCursor }),
    repository.searchStores(scope, "", { limit: 25, cursor: query.storeCursor }),
  ]);
  const list = (title: string, page: WorkOrderListPage, cursorKey: string) => <section className={styles.list} aria-label={title}>
    <h2>{title} ({page.totalCount ?? page.items.length})</h2>
    {page.items.length ? <ul>{page.items.map(job => <li className={styles.listRow} key={job.id}><Link href={`/app/work-orders/${encodeURIComponent(job.id)}`}>Store {job.storeNumber} · {job.problem}</Link><span>{dispatchStatus(job).label}</span>{job.schedule?<span>{dispatchPlanLabel(job.schedule, zone)}</span>:null}</li>)}</ul>
      : <p>{title === "This week" ? "No jobs are scheduled this week." : title === "Waiting" ? "No jobs are waiting." : "No jobs here right now."}</p>}
    {page.nextCursor ? <p className={styles.partial}>Showing {page.items.length} of {page.totalCount ?? page.items.length} · <Link href={`?${cursorKey}=${encodeURIComponent(page.nextCursor)}`}>Show more</Link></p> : null}
  </section>;
  return <div className={styles.workspace}><header className={styles.heading}><div><Link href="/app/dispatch">← Dispatch</Link><h1>{person.displayName}</h1>{person.phone ? <p><a href={`tel:${person.phone}`}>{person.phone}</a></p> : null}</div></header>
    {list("This week", planned, "weekCursor")}{list("Open jobs", open, "openCursor")}{list("Waiting", waiting, "waitingCursor")}{list("Recently finished", finished, "finishedCursor")}
    <section className={styles.list}><h2>Stores covered</h2><ul>{stores.items.map(store => <li key={store.id}><Link href={`/app/stores/${encodeURIComponent(store.id)}`}>Store {store.storeNumber} · {store.name}</Link></li>)}</ul>
      {stores.nextCursor ? <p className={styles.partial}>Showing {stores.items.length} of {stores.totalCount ?? stores.items.length} stores · <Link href={`?storeCursor=${encodeURIComponent(stores.nextCursor)}`}>Show more</Link></p> : null}</section>
  </div>;
}

export default async function TechnicianPage(props:Parameters<typeof renderTechnicianPage>[0]) {
  try { return await renderTechnicianPage(props); } catch(error) {
    if (!(error instanceof OpsDomainError) || error.code !== "FORBIDDEN") throw error;
    return <section><h1>Technician not available</h1><p>You don&apos;t have access to this page.</p><Link href="/app/dispatch">← Dispatch</Link></section>;
  }
}
