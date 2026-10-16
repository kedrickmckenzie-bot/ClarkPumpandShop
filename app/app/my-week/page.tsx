import Link from "next/link";
import { OpsDomainError } from "@/lib/ops/errors";
import { addCalendarDays } from "@/lib/ops/internal-schedule-types";
import { calendarDate, civilDate, mondayOf } from "@/lib/ops/dispatch-calendar";
import { dueLabel, dispatchPlanLabel } from "@/lib/ops/dispatch-board";
import { formatOperationsDate } from "@/lib/ops/local-time";
import type { WorkOrderListQuery } from "@/lib/ops/repository";
import type { WorkOrderListRow } from "@/lib/ops/view-models";
import { groupStuck, stuckFor, stuckReason, stuckSince, type StuckJob } from "@/lib/ops/tech-week";
import { getOpsRequestContext } from "@/lib/server/ops-request-context";
import { internalDispatchScope } from "@/lib/server/internal-dispatch-context";
import styles from "@/components/workspace/my-week.module.css";

export const metadata = { title: "My week" };
type Query = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const OPEN: NonNullable<WorkOrderListQuery["statuses"]> = ["approved", "issued", "accepted", "scheduled", "in_progress"];
const STUCK: NonNullable<WorkOrderListQuery["statuses"]> = ["awaiting_approval", "waiting_on_parts", "waiting_on_vendor"];
const weekday = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
const shortDay = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** A technician's own week: planned jobs by day, then jobs with no day yet — ready to plan, or stuck and why. Only their jobs. */
async function renderMyWeek(query: Query) {
  const { repository, session } = await getOpsRequestContext(["technician"]);
  const scope = await internalDispatchScope(repository, session);
  const organization = await repository.getOrganization(scope.organizationId);
  const zone = organization?.timeZone ?? "America/New_York";
  const now = new Date().toISOString(), today = civilDate(now, zone), thisWeek = mondayOf(today);
  let week = thisWeek;
  try { if (one(query.week)) week = mondayOf(calendarDate(one(query.week)!)); } catch { /* An invalid week keeps this week. */ }
  const mine: WorkOrderListQuery = { internalOnly: true, internalMembershipId: session.membershipId ?? "__none__", limit: 100 };
  const [planned, open, sent] = await Promise.all([
    repository.listWorkOrders(scope, { ...mine, statuses: OPEN, scheduleView: "week", scheduleFrom: week, scheduleTo: addCalendarDays(week, 6) }),
    repository.listWorkOrders(scope, { ...mine, statuses: [...OPEN, ...STUCK], excludeHeld: true }),
    // Problems they reported and sent on; they leave this list once a manager routes them.
    repository.listWorkOrders(scope, { foundByMembershipId: session.membershipId ?? "__none__", statuses: [...OPEN, ...STUCK], limit: 25 }),
  ]);
  // Only jobs that can stop on a blocker need their latest result read.
  const latest = new Map(await Promise.all(open.items.filter(job => job.hasOpenFollowUp).map(async job =>
    [job.id, (await repository.listWorkResults(scope.organizationId, job.id))[0]] as const)));
  const stuck: StuckJob[] = [], ready: WorkOrderListRow[] = [];
  for (const job of open.items) {
    const reason = stuckReason(job, latest.get(job.id));
    if (reason) stuck.push({ job, reason, since: stuckSince(job, latest.get(job.id)), note: latest.get(job.id)?.outcomeNotes?.trim() === job.problem.trim() ? undefined : latest.get(job.id)?.outcomeNotes });
    else if (!job.schedule?.day) ready.push(job);
  }
  for (const job of sent.items) if (job.assignmentKind === "choose_later") stuck.push({ job, reason: "manager", since: job.createdAt });
  const stuckIds = new Set(stuck.map(s => s.job.id));
  const groups = groupStuck(stuck);
  const days = Array.from({ length: 7 }, (_, i) => addCalendarDays(week, i));
  const byDay = new Map(days.map(day => [day, planned.items.filter(job => job.schedule?.day === day && !stuckIds.has(job.id))]));
  // Weekends only when something is planned on them.
  const shown = days.filter((day, i) => i < 5 || byDay.get(day)!.length);
  const card = (job: WorkOrderListRow, held?: StuckJob) => {
    const late = job.dueAt && Date.parse(job.dueAt) < Date.parse(now);
    return <li key={job.id}><Link className={styles.card} href={`/app/my-work/${encodeURIComponent(job.id)}`}>
      <span className={styles.store}>Store {job.storeNumber}</span>
      <span className={styles.problem}>{job.shortName ?? job.problem}</span>
      {held ? <span className={styles.stuckFor}>Stuck {stuckFor(held.since, now)}</span> : null}
      {held?.note ? <span className={styles.note}>“{held.note}”</span> : null}
      {held ? <span className={styles.meta}>{held.reason === "manager" ? "Waiting for a manager to pick it up" : `With ${job.accountableParty}`}</span> : null}
      {held && job.schedule ? <span className={styles.meta}>Planned for {dispatchPlanLabel(job.schedule, zone)}</span> : null}
      {!held && job.dueAt ? <span className={late ? styles.late : styles.meta}>{dueLabel({ dueAt: job.dueAt }, today, zone, now)}</span> : null}
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
    <section className={styles.noDay} aria-labelledby="no-day-title">
      <h2 id="no-day-title">No day yet</h2>
      <div className={styles.side}>
        <section aria-labelledby="ready-title">
          <h3 id="ready-title">Ready <span>{ready.length}</span></h3>
          {ready.length ? <ul>{ready.map(job => card(job))}</ul> : <p className={styles.empty}>Nothing waiting for a day.</p>}
        </section>
        <section aria-labelledby="stuck-title">
          <h3 id="stuck-title">Stuck <span>{stuck.length}</span></h3>
          {groups.length ? groups.map(group => <div key={group.reason} className={styles.group}>
            <h4 className={styles.groupTitle}>{group.label} <span>{group.jobs.length}</span></h4>
            <ul>{group.jobs.map(held => card(held.job, held))}</ul>
          </div>) : <p className={styles.empty}>Nothing is stuck.</p>}
        </section>
      </div>
    </section>
  </div>;
}

export default async function MyWeekPage({ searchParams }: { searchParams: Promise<Query> }) {
  try { return await renderMyWeek(await searchParams); } catch (error) {
    if (!(error instanceof OpsDomainError) || error.code !== "FORBIDDEN") throw error;
    return <section><h1>My week</h1><p>This page is for technicians.</p><Link href="/app/overview">Go to overview</Link></section>;
  }
}
