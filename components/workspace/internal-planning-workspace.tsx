import Link from "next/link";
import { InternalJobSection } from "./internal-job-list";
import { addCalendarDays } from "@/lib/ops/internal-schedule-types";
import { formatOperationsDate } from "@/lib/ops/local-time";
import { mondayOf } from "@/lib/ops/dispatch-calendar";
import type { WorkOrderListPage } from "@/lib/ops/view-models";
import type { OperatorSession } from "@/components/ops/data-contract";
import styles from "./internal-dispatch.module.css";

type Filters = { people: { id: string; name: string }[]; regions: { id: string; name: string }[] };

export function InternalPlanningWorkspace(props: {
  session: OperatorSession; technician: boolean; view: string; search: string; week: string; today: string; readiness: string;
  person?: string; region?: string; storeId?: string; saved?: { number: string; when: string };
  page: WorkOrderListPage; heldPage?: WorkOrderListPage; planned?: WorkOrderListPage; replan?: WorkOrderListPage;
  review?: WorkOrderListPage; unscheduled?: WorkOrderListPage; links: Record<string, string | undefined>; filters: Filters;
}) {
  const { session, technician, view, search, week, today, readiness, person, region, storeId, saved, page, heldPage, planned, replan, review, unscheduled, links, filters } = props;
  const base = technician ? "/app/my-work" : "/app/dispatch";
  const query = new URLSearchParams({ view, q: search, week, readiness, ...(person ? { person } : {}), ...(region ? { region } : {}), ...(storeId ? { store: storeId } : {}) });
  const href = (key: string, value: string) => {
    const next = new URLSearchParams(query);
    next.set(key, value);
    next.delete("saved");
    return `${base}?${next}`;
  };
  const returnTo = `${base}?${query}`;
  const tabs = technician
    ? [["today", "Today"], ["upcoming", "Coming up"], ["mine", "All my jobs"], ["pool", "Jobs to take"]]
    : [["all", "All team work"], ["pool", "Needs a technician"], ["person", "Assigned"], ["awaiting_allocation", "Manager to assign"]];
  const filtering = Boolean(search || readiness !== "all" || person || region);
  const thisWeek = mondayOf(today);
  const section = (title: string, list: WorkOrderListPage, extra: { hint?: string; empty?: React.ReactNode; next?: string; groupByDay?: boolean } = {}) =>
    <InternalJobSection title={title} hint={extra.hint} page={list} session={session} technician={technician} returnTo={returnTo}
      week={technician ? undefined : week} empty={extra.empty} nextHref={extra.next} groupByDay={extra.groupByDay}/>;

  return <div className={styles.workspace}>
    <header className={styles.header}>
      <div>
        <h1>{technician ? "My work" : "Dispatch"}</h1>
        <p>{technician ? "Your jobs, and team jobs you can take." : "Plan and assign work for your maintenance team."}</p>
      </div>
      {!technician ? <Link className={`${styles.btn} ${styles.btnSecondary}`} href="/app/work-orders?status=open">All open work orders</Link> : null}
    </header>

    {saved ? <p className={styles.notice} role="status">Saved. {saved.number}{saved.when ? ` is now set for ${saved.when}.` : " was updated."}</p> : null}

    <nav className={styles.tabs} aria-label="Internal work views">
      {tabs.map(([key, label]) => <Link key={key} href={href("view", key)} aria-current={view === key ? "page" : undefined}>{label}</Link>)}
    </nav>

    {!technician ? <div className={styles.weekBar} aria-label="Planning week">
      <Link className={`${styles.btn} ${styles.btnSecondary}`} href={href("week", addCalendarDays(week, -7))}>← Last week</Link>
      <strong>Week of {formatOperationsDate(week)}</strong>
      <Link className={`${styles.btn} ${styles.btnSecondary}`} href={href("week", addCalendarDays(week, 7))}>Next week →</Link>
      {week !== thisWeek ? <Link href={href("week", thisWeek)}>Back to this week</Link> : null}
    </div> : null}

    <details className={styles.filters} open={filtering}>
      <summary>{filtering ? "Search and filters (on)" : "Search and filters"}</summary>
      <form className={styles.search} method="get">
        <input type="hidden" name="view" value={view}/>
        {storeId ? <input type="hidden" name="store" value={storeId}/> : null}
        {!technician ? <input type="hidden" name="week" value={week}/> : null}
        <label>Search<input type="search" name="q" defaultValue={search} maxLength={120} placeholder="Problem, work order or store"/></label>
        <label>Show<select name="readiness" defaultValue={readiness}>
          <option value="all">Everything</option>
          <option value="ready">Ready to work</option>
          <option value="waiting">Waiting on something</option>
          <option value="next_visit">Next visit is fine</option>
        </select></label>
        {!technician ? <>
          <label>Technician<select name="person" defaultValue={person ?? ""}>
            <option value="">Everyone</option>
            {filters.people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></label>
          <label>Region<select name="region" defaultValue={region ?? ""}>
            <option value="">All regions</option>
            {filters.regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select></label>
        </> : null}
        <button type="submit">Apply</button>
        {filtering ? <Link className={`${styles.btn} ${styles.btnSecondary}`} href={technician ? `${base}?view=${view}` : `${base}?week=${week}`}>Clear</Link> : null}
      </form>
    </details>
    {storeId ? <p className={styles.muted}>Showing one store. <Link href={`/app/stores/${encodeURIComponent(storeId)}`}>Open store</Link> · <Link href={base}>Show all stores</Link></p> : null}

    {technician ? <>
      {planned ? section(view === "today" ? "Today" : "Coming up", planned, {
        groupByDay: view === "upcoming",
        empty: view === "today" ? (unscheduled?.items.length ? "Nothing is scheduled for today. Your other jobs are below." : "Nothing is scheduled for today.") : "Nothing is scheduled yet.",
        next: links.planned,
      }) : null}
      {replan?.totalCount ? section("Missed: pick a new date", replan, { hint: "The planned day passed and the work isn't done.", next: links.replan }) : null}
      {unscheduled ? section("My jobs without a date", unscheduled, {
        hint: "Most urgent first.",
        empty: <>No other jobs assigned to you. <Link href={href("view", "pool")}>See jobs to take →</Link></>,
        next: links.unscheduled,
      }) : null}
      {["mine", "pool"].includes(view) ? section(view === "pool" ? "Jobs you can take" : "My jobs", page, {
        empty: view === "pool" ? "No team jobs to take right now." : <>No jobs assigned to you. <Link href={href("view", "pool")}>See jobs to take →</Link></>,
        next: links.backlog,
      }) : null}
      {heldPage ? section("When you're nearby", heldPage, { hint: "Do these on a visit to that store. No special trip needed.", empty: "Nothing waiting for a nearby visit.", next: links.held }) : null}
      <p><Link className={`${styles.btn} ${styles.btnSecondary}`} href="/app/my-work/check-in">At a store for a job that isn&apos;t listed? Check in</Link></p>
    </> : <>
      {planned ? section("Scheduled this week", planned, { groupByDay: true, empty: "Nothing is scheduled this week.", next: links.planned }) : null}
      {replan?.totalCount ? section("Missed: pick a new date", replan, { hint: "The planned day passed and the work isn't done.", next: links.replan }) : null}
      {review?.totalCount ? section("Done: check the work", review, { hint: "A technician says these are finished.", next: links.review }) : null}
      {section("Not scheduled yet", page, { hint: "Most urgent first.", empty: search ? "No jobs match this search." : "Every team job has a date.", next: links.backlog })}
    </>}
  </div>;
}
