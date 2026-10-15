import Link from "next/link";
import { OpsDomainError } from "@/lib/ops/errors";
import { addCalendarDays } from "@/lib/ops/internal-schedule-types";
import { calendarDate, civilDate, mondayOf } from "@/lib/ops/dispatch-calendar";
import { dueLabel, dispatchPlanLabel } from "@/lib/ops/dispatch-board";
import { formatOperationsDate } from "@/lib/ops/local-time";
import type { WorkOrderListQuery } from "@/lib/ops/repository";
import type { WorkOrderListRow } from "@/lib/ops/view-models";
import { getOpsRequestContext } from "@/lib/server/ops-request-context";
import { internalDispatchScope } from "@/lib/server/internal-dispatch-context";
import styles from "@/components/workspace/my-week.module.css";

export const metadata = { title: "My week" };
type Query = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const OPEN: NonNullable<WorkOrderListQuery["statuses"]> = ["approved", "issued", "accepted", "scheduled", "in_progress"];
const WAITING: NonNullable<WorkOrderListQuery["statuses"]> = ["waiting_on_parts", "waiting_on_vendor"];
const weekday = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
const shortDay = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** A technician's own week: their planned jobs by day, what isn't planned yet, and what's waiting. Only their jobs. */
async function renderMyWeek(query: Query) {
  const { repository, session } = await getOpsRequestContext(["technician"]);
  const scope = await internalDispatchScope(repository, session);
  const organization = await repository.getOrganization(scope.organizationId);
  const zone = organization?.timeZone ?? "America/New_York";
  const now = new Date().toISOString(), today = civilDate(now, zone), thisWeek = mondayOf(today);
  let week = thisWeek;
  try { if (one(query.week)) week = mondayOf(calendarDate(one(query.week)!)); } catch { /* An invalid week keeps this week. */ }
  const mine: WorkOrderListQuery = { internalOnly: true, internalMembershipId: session.membershipId ?? "__none__", limit: 100 };
  const [planned, unplanned, waiting] = await Promise.all([
    repository.listWorkOrders(scope, { ...mine, statuses: OPEN, scheduleView: "week", scheduleFrom: week, scheduleTo: addCalendarDays(week, 6) }),
    repository.listWorkOrders(scope, { ...mine, statuses: OPEN, scheduleView: "backlog", excludeHeld: true, limit: 25 }),
    repository.listWorkOrders(scope, { ...mine, statuses: WAITING, limit: 25 }),
  ]);
  const days = Array.from({ length: 7 }, (_, i) => addCalendarDays(week, i));
  const byDay = new Map(days.map(day => [day, planned.items.filter(job => job.schedule?.day === day)]));
  // Weekends only when something is planned on them.
  const shown = days.filter((day, i) => i < 5 || byDay.get(day)!.length);
  const card = (job: WorkOrderListRow, showPlan = false) => {
    const late = job.dueAt && Date.parse(job.dueAt) < Date.parse(now);
    return <li key={job.id}><Link className={styles.card} href={`/app/my-work/${encodeURIComponent(job.id)}`}>
      <span className={styles.store}>Store {job.storeNumber}</span>
      <span className={styles.problem}>{job.shortName ?? job.problem}</span>
      {showPlan && job.schedule ? <span className={styles.meta}>Planned for {dispatchPlanLabel(job.schedule, zone)}</span> : null}
      {job.dueAt ? <span className={late ? styles.late : styles.meta}>{dueLabel({ dueAt: job.dueAt }, today, zone, now)}</span> : null}
    </Link></li>;
  };
  const href = (w: string) => w === thisWeek ? "/app/my-week" : `/app/my-week?week=${w}`;
  return <div className={styles.page}>
    <header className={styles.header}>
      <h1>My week</h1>
      <nav className={styles.weekNav} aria-label="Week">
        <Link href={href(addCalendarDays(week, -7))}>← Last week</Link>
        <strong>Week of {formatOperationsDate(week)}</strong>
        <Link href={href(addCalendarDays(week, 7))}>Next week →</Link>
        {week !== thisWeek ? <Link href="/app/my-week">This week</Link> : null}
      </nav>
    </header>
    <div className={styles.days} style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}>
      {shown.map(day => {
        const jobs = byDay.get(day)!;
        return <section key={day} className={day === today ? styles.today : styles.day} aria-label={`${weekday(day)} ${shortDay(day)}`}>
          <h2>{weekday(day)} <span>{shortDay(day)}</span>{day === today ? <em>Today</em> : null}</h2>
          {jobs.length ? <ul>{jobs.map(job => card(job))}</ul> : <p className={styles.empty}>Nothing planned</p>}
        </section>;
      })}
    </div>
    <div className={styles.side}>
      <section aria-labelledby="unplanned-title">
        <h2 id="unplanned-title">Not planned yet <span>{unplanned.totalCount ?? unplanned.items.length}</span></h2>
        {unplanned.items.length ? <ul>{unplanned.items.map(job => card(job))}</ul> : <p className={styles.empty}>Every job has a day.</p>}
      </section>
      <section aria-labelledby="waiting-title">
        <h2 id="waiting-title">Waiting <span>{waiting.totalCount ?? waiting.items.length}</span></h2>
        {waiting.items.length ? <ul>{waiting.items.map(job => card(job, true))}</ul> : <p className={styles.empty}>Nothing waiting on parts or help.</p>}
      </section>
    </div>
  </div>;
}

export default async function MyWeekPage({ searchParams }: { searchParams: Promise<Query> }) {
  try { return await renderMyWeek(await searchParams); } catch (error) {
    if (!(error instanceof OpsDomainError) || error.code !== "FORBIDDEN") throw error;
    return <section><h1>My week</h1><p>This page is for technicians.</p><Link href="/app/overview">Go to overview</Link></section>;
  }
}
