"use client";
import { cachedDateTimeFormat } from "@/lib/ops/intl-format-cache";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { roleCan } from "@/components/ops/role-policy";
import type { OperatorSession } from "@/components/ops/data-contract";
import { InternalAssignmentFields } from "./internal-assignment-fields";
import { InternalScheduleFields } from "./internal-schedule-fields";
import { canPlanJob, dispatchPlanLabel, dispatchStatus, dispatchTime, orderedStops, type DispatchJob } from "@/lib/ops/dispatch-board";
import { addCalendarDays } from "@/lib/ops/internal-schedule-types";
import type { WorkOrderListQuery } from "@/lib/ops/repository";
import styles from "./dispatch-board.module.css";

type JobPage = { items: DispatchJob[]; totalCount?: number; nextCursor?: string };
type Person = { id: string; name: string };
type Filters = { q: string; person: string; region: string; store: string };
type Props = { session: OperatorSession; organizationZone: string; today: string; week: string; day: string; view: string;
  bucket?: WorkOrderListQuery["dispatchBucket"]; filters: Filters; people: Person[]; regions: Person[];
  planned: JobPage; queue: JobPage; list?: JobPage; initialSaved?: string; stats: Record<string, number>;
  dayCounts: { membershipId?: string; name?: string; day?: string; count: number }[] };
type Detail = { job: DispatchJob; instructions?: string; nextAction: string; canReady: boolean; activeVisit: boolean;
  history: { at: string; name?: string; notes?: string; label: string }[] };
type SaveResponse = { error?: string; details?: { kind: string; warnings: string[] }; when?: string; week?: string };
const dateLabel = (date: string, weekday = false) => cachedDateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", ...(weekday ? { weekday: "short" } : {}) }).format(new Date(`${date}T12:00:00Z`));
const weekdayLabel = (date: string) => cachedDateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" }).format(new Date(`${date}T12:00:00Z`));

/** A board owns only selected records; current grants and command checks stay server-side. */
export function DispatchBoard(props: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<{ job: DispatchJob; mode?: string; day?: string; person?: Person }>();
  const [cell, setCell] = useState<{ day: string; person?: Person }>();
  const [dragged, setDragged] = useState<string>();
  const [hover, setHover] = useState<string>();
  const [saved, setSaved] = useState(props.initialSaved);
  const opener = useRef<HTMLElement | null>(null);
  const pointerDrag = useRef<{job:DispatchJob;x:number;y:number;moved:boolean}|undefined>(undefined);
  const suppressDragClick = useRef(false);
  const { week, today, day, view, planned, queue, filters, bucket, organizationZone } = props;
  const manager = roleCan(props.session, "assign_internal_work");
  const days = Array.from({ length: 6 }, (_, index) => addCalendarDays(week, index));
  const people = [...props.people];
  for (const job of planned.items) if (job.internalMembershipId && !people.some(person => person.id === job.internalMembershipId))
    people.push({ id: job.internalMembershipId, name: job.internalAssigneeName ?? "Previous technician" });
  for (const count of props.dayCounts) if (count.membershipId && !people.some(person => person.id === count.membershipId)) people.push({id:count.membershipId,name:count.name ?? "Previous technician"});
  const visiblePeople = filters.person ? people.filter(person => person.id === filters.person) : people;
  const rows: Array<Person | undefined> = [...visiblePeople, ...(filters.person ? [] : [undefined])];
  const query = new URLSearchParams({ view, week, day, ...(bucket ? { bucket } : {}), ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)) });
  const href = (values: Record<string, string | undefined>) => {
    const next = new URLSearchParams(query);
    for (const [key, value] of Object.entries(values)) { if(value) next.set(key,value); else next.delete(key); }
    for (const key of ["cursor", "queueCursor", "planCursor", "saved", "savedWhen"]) next.delete(key);
    return `/app/dispatch?${next}`;
  };
  const moreHref = (key: string, cursor: string) => { const next = new URLSearchParams(query); next.set(key, cursor); return `/app/dispatch?${next}`; };
  const jobsFor = (person: Person | undefined, date: string) => orderedStops(planned.items.filter(job => job.schedule?.day === date && job.internalMembershipId === person?.id));
  const countFor = (person: Person | undefined, date: string) => props.dayCounts.find(count => count.membershipId === person?.id && count.day === date)?.count ?? 0;
  const openJob = (job: DispatchJob, mode?: string) => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelected({ job, mode });
  };
  const close = () => { setSelected(undefined); setCell(undefined); requestAnimationFrame(() => opener.current?.focus()); };
  const onSaved = (message: string, nextWeek?: string) => {
    setSaved(message);
    close();
    if (nextWeek && nextWeek !== week) router.replace(href({ week: nextWeek, day: nextWeek }), { scroll: false });
    router.refresh();
  };
  const dragDestination = (x:number,y:number) => {
    const target=document.elementFromPoint(x,y)?.closest<HTMLElement>('[data-dispatch-day]');
    if(!target?.dataset.dispatchDay)return;
    const person=props.people.find(item=>item.id===target.dataset.dispatchPerson);
    if(target.dataset.dispatchPerson&&!person)return;
    return {day:target.dataset.dispatchDay,person};
  };
  const chip = (job: DispatchJob, mobile = false) => {
    const status = dispatchStatus(job), urgent = ["urgent", "emergency"].includes(job.priority);
    return <button key={job.id} type="button" className={`${styles.chip} ${mobile ? styles.phoneCard : ""} ${urgent ? styles.urgent : ""}`}
      data-tone={status.tone} data-can-drag={manager && canPlanJob(job)} draggable={false}
      onPointerDown={event=>{suppressDragClick.current=false;if(mobile||innerWidth<=920||event.button!==0||!manager||!canPlanJob(job))return;pointerDrag.current={job,x:event.clientX,y:event.clientY,moved:false};event.currentTarget.setPointerCapture(event.pointerId);}}
      onPointerMove={event=>{const drag=pointerDrag.current;if(!drag||(!drag.moved&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<8))return;drag.moved=true;setDragged(drag.job.id);const destination=dragDestination(event.clientX,event.clientY);setHover(destination?`${destination.person?.name??"Not assigned"} · ${weekdayLabel(destination.day)}`:undefined);}}
      onPointerUp={event=>{const drag=pointerDrag.current;pointerDrag.current=undefined;setDragged(undefined);setHover(undefined);if(!drag?.moved)return;suppressDragClick.current=true;const destination=dragDestination(event.clientX,event.clientY);if(destination){opener.current=event.currentTarget;setSelected({job:drag.job,mode:"schedule",day:destination.day,person:destination.person??{id:"",name:"Needs a technician"}});}}}
      onPointerCancel={()=>{pointerDrag.current=undefined;setDragged(undefined);setHover(undefined);}}
      onClick={event=>{if(event.detail!==0&&suppressDragClick.current){suppressDragClick.current=false;return;}openJob(job);}} aria-label={`${job.number}, Store ${job.storeNumber}, ${job.problem}, ${status.label}`}>
      <span className={styles.chipTitle}><strong>{job.storeNumber}</strong> {job.problem}</span>
      <span className={styles.status} data-tone={status.tone}>{urgent ? "Urgent · " : ""}{status.label}</span>
      {mobile ? <span className={styles.phoneAction}>View job</span> : null}
    </button>;
  };
  const cellContent = (person: Person | undefined, date: string, mobile = false) => {
    const jobs = jobsFor(person, date), count = countFor(person, date);
    return <><span className={styles.dayCount}>{count} {count === 1 ? "job" : "jobs"}</span>
      {jobs.slice(0, mobile ? jobs.length : 3).map(job => chip(job, mobile))}
      {count > (mobile ? jobs.length : Math.min(jobs.length, 3)) ? <button type="button" className={styles.more} onClick={() => { opener.current = document.activeElement as HTMLElement; setCell({ day: date, person }); }}>+{count - (mobile ? jobs.length : Math.min(jobs.length, 3))} more</button> : null}
      {!count ? <span className={styles.quiet}>No jobs</span> : null}</>;
  };
  return <div className={styles.workspace}>
    <div className={styles.stickyControls}>
      <header className={styles.heading}><h1>Dispatch</h1><Link href="/app/work-orders?status=open">Open work orders</Link></header>
      <div className={styles.toolbar}>
        <nav className={styles.switcher} aria-label="Dispatch view">{["week", "day", "list"].map(item => <Link key={item} href={href({ view: item })} aria-current={view === item ? "page" : undefined}>{item[0].toUpperCase() + item.slice(1)}</Link>)}</nav>
        <nav className={styles.weekControls} aria-label="Planning week">
          <Link href={href({ week: addCalendarDays(week, -7), day: addCalendarDays(week, -7) })}>Previous</Link>
          <strong>Week of {dateLabel(week)}</strong>
          <Link href={href({ week: addCalendarDays(week, 7), day: addCalendarDays(week, 7) })}>Next</Link>
          <Link href={href({ week: undefined, day: undefined })}>Today</Link>
        </nav>
      </div>
      <nav className={styles.countStrip} aria-label="Filter team work">
        {([["unassigned", "Not assigned"], ["parts", "Waiting on parts"], ["late", "Late"], ["reported", "Reported done"]] as const).map(([key, label]) =>
          <Link key={key} href={href({ bucket: key })} aria-current={bucket === key ? "page" : undefined}><strong>{props.stats[key] ?? 0}</strong> {label}</Link>)}
        {bucket ? <Link href={href({ bucket: undefined })}>Clear</Link> : null}
      </nav>
      <details className={styles.filters} open={Boolean(filters.q || filters.person || filters.region || filters.store)}><summary>Search and filters</summary>
        <form method="get"><input type="hidden" name="view" value={view}/><input type="hidden" name="week" value={week}/>{bucket ? <input type="hidden" name="bucket" value={bucket}/> : null}
          <label>Search<input type="search" name="q" defaultValue={filters.q} maxLength={120} placeholder="Problem, store or work order"/></label>
          <label>Technician<select name="person" defaultValue={filters.person}><option value="">Everyone</option>{people.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
          <label>Region<select name="region" defaultValue={filters.region}><option value="">All regions</option>{props.regions.map(region => <option key={region.id} value={region.id}>{region.name}</option>)}</select></label>
          {filters.store ? <input type="hidden" name="store" value={filters.store}/> : null}<button type="submit">Search</button>
          {Object.values(filters).some(Boolean) ? <Link href={href({ q: undefined, person: undefined, region: undefined, store: undefined })}>Clear filters</Link> : null}
        </form>
      </details>
      {saved ? <p className={styles.saved} role="status">{saved}</p> : null}
      {dragged && hover ? <p className={styles.dragHint} role="status">{hover}</p> : null}
    </div>
    <nav className={`${styles.dayPicker} ${view === "day" ? styles.always : ""}`} aria-label="Choose a day">
      {days.map(date => <Link key={date} href={href({ day: date })} aria-current={day === date ? "date" : undefined}>{weekdayLabel(date)} <span>{date.slice(-2)}</span></Link>)}
      {day === addCalendarDays(week, 6) ? <span>Sunday {dateLabel(day)}</span> : null}
    </nav>
    {view === "list" ? <section className={styles.list} aria-label="Team jobs">
      <h2>Team jobs</h2>{!props.list?.items.length ? <p>No jobs match these filters. <Link href="/app/dispatch?view=list">Clear filters</Link></p> : null}
      {props.list?.items.map(job => <div key={job.id} className={styles.listRow}>{chip(job)}<span>{job.internalAssigneeName ?? "Needs a technician"}</span><span>{job.schedule ? dispatchPlanLabel(job.schedule, organizationZone) : null}</span><button onClick={() => openJob(job)} type="button">View job</button></div>)}
      {props.list ? <Pagination page={props.list} href={props.list.nextCursor ? moreHref("cursor", props.list.nextCursor) : undefined}/> : null}
    </section> : <div className={styles.boardLayout}>
      <section className={styles.boardScroll} aria-label={view === "week" ? "Week board" : "Day stops"}>
        {view === "week" ? <div className={styles.desktopBoard}>
          <div className={styles.boardGrid} role="table" aria-label="Technicians and days">
            <div role="row" className={styles.gridRow}><div role="columnheader" className={styles.techHeader}>Technician</div>{days.map(date => <div key={date} role="columnheader" className={date === today ? styles.today : ""}><button type="button" onClick={() => router.push(href({ view: "day", day: date }), { scroll: false })}>{weekdayLabel(date)}<small>{dateLabel(date)}</small></button></div>)}</div>
            {rows.map(person => <div role="row" className={styles.gridRow} key={person?.id ?? "pool"}>
              <div role="rowheader" className={styles.techHeader}>{person ? <Link href={`/app/dispatch/technicians/${encodeURIComponent(person.id)}`}>{person.name}</Link> : <strong>Not assigned</strong>}</div>
              {days.map(date => <div role="cell" key={date} data-dispatch-day={date} data-dispatch-person={person?.id??""} className={`${styles.cell} ${date === today ? styles.today : ""} ${date < today ? styles.past : ""} ${hover === `${person?.name ?? "Not assigned"} · ${weekdayLabel(date)}` ? styles.dropTarget : ""}`}>
                {cellContent(person, date)}
              </div>)}
            </div>)}
          </div>
        </div> : null}
        <div className={view === "week" ? styles.mobileBoard : styles.dayBoard}>
          {rows.map(person => <details key={person?.id ?? "pool"} open className={styles.techDay}>
            <summary>{person?.name ?? "Not assigned"}<span>{countFor(person, day)} {countFor(person,day)===1 ? "job" : "jobs"}</span></summary>
            {person ? <Link className={styles.techLink} href={`/app/dispatch/technicians/${encodeURIComponent(person.id)}`}>View technician</Link> : null}
            {view === "day" && jobsFor(person, day).some(job => !job.schedule?.startsAt) ? <p className={styles.quiet}>Timed jobs first; jobs without a time follow.</p> : null}
            {cellContent(person, day, true)}
          </details>)}
        </div>
        {planned.items.some(job => job.schedule?.day === addCalendarDays(week, 6)) ? <details className={styles.sunday}><summary>Sunday · {dateLabel(addCalendarDays(week, 6))}</summary>{planned.items.filter(job => job.schedule?.day === addCalendarDays(week, 6)).map(job => chip(job))}</details> : null}
        <Pagination page={planned} href={planned.nextCursor ? moreHref("planCursor", planned.nextCursor) : undefined}/>
      </section>
      <aside className={styles.queue} aria-label="Jobs needing a date or technician"><h2>Needs a day or technician <span>{queue.totalCount ?? 0}</span></h2><p className={styles.quiet}>Most urgent first</p>
        {!queue.items.length ? <p>No jobs need a day or technician. Every matching job is planned.</p> : null}
        {queue.items.map(job => <div key={job.id} className={styles.queueJob}>{chip(job)}{job.schedule ? <span className={styles.quiet}>{dispatchPlanLabel(job.schedule, organizationZone)}</span> : null}
          {manager && canPlanJob(job) ? <button type="button" className={styles.outline} onClick={() => openJob(job, "schedule")}>Schedule</button> : null}</div>)}
        <Pagination page={queue} href={queue.nextCursor ? moreHref("queueCursor", queue.nextCursor) : undefined}/>
      </aside>
    </div>}
    {selected ? <JobSheet key={`${selected.job.id}:${selected.job.version}`} selection={selected} manager={manager} organizationZone={organizationZone} week={week} onClose={close} onSaved={onSaved}/> : null}
    {cell ? <DaySheet day={cell.day} person={cell.person} filters={filters} bucket={bucket} organizationZone={organizationZone} onClose={close} onOpen={job => { setCell(undefined); openJob(job); }}/> : null}
  </div>;
}

function Pagination({ page, href }: { page: JobPage; href?: string }) {
  const total = page.totalCount ?? page.items.length;
  return total > page.items.length || href ? <p className={styles.partial}>Showing {page.items.length} of {total}{href ? <> · <Link href={href}>Show more</Link></> : null}</p> : null;
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    function onKeyDown(event:KeyboardEvent) {
      if(event.key==="Escape"){event.preventDefault();onClose();}
      if(event.key!=="Tab")return;
      const items=[...panel.current!.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([type="hidden"]):not([disabled]),select:not([disabled]),textarea:not([disabled]),summary')].filter(item=>item.getClientRects().length);
      const first=items[0],last=items.at(-1);
      if(event.shiftKey && (document.activeElement===first || document.activeElement===panel.current)){event.preventDefault();last?.focus();}
      else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}
    }
    const element=panel.current;
    element?.addEventListener("keydown",onKeyDown);
    return ()=>{document.body.style.overflow=previous;element?.removeEventListener("keydown",onKeyDown);};
  }, [onClose]);
  return <div className={styles.backdrop}><button type="button" className={styles.sheetBackdrop} onClick={onClose} tabIndex={-1} aria-label="Close job details"/>
    <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={panel}><header className={styles.sheetHeader}><strong>{title}</strong><button type="button" onClick={onClose}>Close</button></header>{children}</div>
  </div>;
}

function JobSheet({ selection, manager, organizationZone, week, onClose, onSaved }: { selection: { job: DispatchJob; mode?: string; day?: string; person?: Person }; manager: boolean; organizationZone: string; week: string; onClose: () => void; onSaved: (note: string, week?: string) => void }) {
  const router = useRouter();
  const [detail, setDetail] = useState<Detail>();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [mode, setMode] = useState(selection.mode);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/ops/internal-dispatch/jobs/${encodeURIComponent(selection.job.id)}`, { signal: controller.signal }).then(async response => {
      const data = await response.json() as Detail & { error?: string }; if (!response.ok) throw new Error(data.error ?? "Could not open this job. Try again."); return data;
    }).then(setDetail).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Could not open this job. Try again."); });
    return () => controller.abort();
  }, [selection.job.id, retry]);
  const job = detail?.job ?? selection.job, status = dispatchStatus(job);
  const stale = Boolean(detail && job.version !== selection.job.version);
  const canPlan = manager && !stale && canPlanJob(job) && !detail?.activeVisit;
  return <Sheet title={`Store ${job.storeNumber} · ${job.number}`} onClose={onClose}>
    <div className={styles.sheetBody}><h2>{job.problem}</h2><p><Link href={`/app/stores/${encodeURIComponent(job.storeId)}`}>Store {job.storeNumber} · {job.storeName}</Link></p>
      <span className={styles.status} data-tone={status.tone}>{status.label}</span>
      <dl className={styles.facts}><div><dt>Technician</dt><dd>{job.internalAssigneeName ?? "Needs a technician"}</dd></div>{job.schedule ? <div><dt>When</dt><dd>{dispatchPlanLabel(job.schedule, organizationZone)}</dd></div> : null}
        {job.dueAt ? <div><dt>Next step due</dt><dd>{dispatchTime(job.dueAt, job.storeZone ?? organizationZone, organizationZone)}</dd></div> : null}
        {job.targetCompletionAt ? <div><dt>Finish by</dt><dd>{dispatchTime(job.targetCompletionAt, job.storeZone ?? organizationZone, organizationZone)}</dd></div> : null}
        <div><dt>Manager</dt><dd>{job.internalAccountableParty}</dd></div></dl>
      {detail?.instructions ? <p>{detail.instructions}</p> : null}
      {error ? <div role="alert"><p>{error}</p><button type="button" onClick={() => { setError(""); setRetry(retry + 1); }}>Try again</button></div> : !detail ? <div className={styles.skeleton} role="status">Loading…</div> : <>
        {stale ? <p role="alert">This job changed since the board loaded. <button type="button" onClick={() => {onClose();router.refresh();}}>Refresh board</button></p> : null}
        {mode && !stale ? <LiveJobForm key={mode} job={job} mode={mode} organizationZone={organizationZone} day={selection.day ?? job.schedule?.day ?? week} person={selection.person} onCancel={() => setMode(undefined)} onSaved={onSaved}/> : <div className={styles.actions}>
          {manager && !stale && detail.canReady ? <button className={styles.primary} type="button" onClick={() => setMode("ready")}>Mark ready</button> : null}
          {canPlan ? <button type="button" className={detail.canReady ? styles.outline : styles.primary} onClick={() => setMode("schedule")}>{job.schedule ? "Change date" : "Schedule"}</button> : null}
          {canPlan && !job.hasOpenFollowUp && !job.visitHoldPosture ? <button type="button" onClick={() => setMode("assign")}>{job.internalAssigneeName ? "Reassign" : "Assign"}</button> : null}
          <Link href={`/app/work-orders/${encodeURIComponent(job.id)}?view=${job.status === "completed_pending_review" ? "overview" : "service"}`}>{job.status === "completed_pending_review" ? "Check the work" : "Open full job"}</Link>
        </div>}
        <section className={styles.history}><h3>Recent updates</h3>{detail.history.length ? <ol>{detail.history.map((item, index) => <li key={`${item.at}:${index}`}><strong>{item.label}</strong>{item.name ? <span>{item.name}</span> : null}<time>{dispatchTime(item.at, job.storeZone ?? organizationZone, organizationZone)}</time>{item.notes ? <p>{item.notes}</p> : null}</li>)}</ol> : <p>No results recorded yet. <Link href={`/app/work-orders/${encodeURIComponent(job.id)}?view=activity`}>Open full history</Link></p>}</section>
      </>}
    </div>
  </Sheet>;
}

function LiveJobForm({ job, mode, organizationZone, day, person, onCancel, onSaved }: { job: DispatchJob; mode: string; organizationZone: string; day: string; person?: Person; onCancel: () => void; onSaved: (note: string, week?: string) => void }) {
  const [pending, setPending] = useState(false), [error, setError] = useState(""), [warnings, setWarnings] = useState<string[]>([]);
  const key = useRef<string | undefined>(undefined), formRef = useRef<HTMLFormElement>(null);
  const [reassigning, setReassigning] = useState(mode === "assign" || Boolean(person && person.id !== job.internalMembershipId));
  const localStart = job.schedule?.startsAt ? cachedDateTimeFormat("sv-SE", {timeZone: job.storeZone ?? organizationZone, year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(job.schedule.startsAt)).replace(" ","T") : undefined;
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending) return;
    const data = new FormData(event.currentTarget), submitter = (event.nativeEvent as SubmitEvent).submitter;
    if (submitter instanceof HTMLButtonElement && submitter.name) data.set(submitter.name, submitter.value);
    key.current ??= crypto.randomUUID();
    data.set("submissionKey", key.current); data.set("expectedVersion", String(job.version ?? 0)); data.set("expectedAssignmentId", job.assignmentId ?? "");
    data.set("expectedScheduleId", job.schedule?.id ?? "");
    const endpoint = mode === "ready" ? "internal-result" : mode === "assign" ? "internal-dispatch" : "internal-schedule";
    data.set("action", mode === "ready" ? "ready" : mode === "assign" ? "assign" : "schedule");
    setPending(true); setError("");
    try {
      const response = await fetch(`/api/ops/work-orders/${encodeURIComponent(job.id)}/${endpoint}`, { method: "POST", headers: { Accept: "application/json" }, body: data });
      const result = await response.json() as SaveResponse;
      if (!response.ok) {
        if (result.details?.kind === "schedule_warning") { setWarnings(result.details.warnings); return; }
        throw new Error(result.error ?? "Could not save. Your entries are still here. Try again.");
      }
      onSaved(`Saved. ${job.number}${result.when ? ` is set for ${result.when}.` : mode === "ready" ? " is ready to work." : " was updated."}`, result.week);
      onCancel();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not confirm the save. Refresh before trying again."); }
    finally { setPending(false); }
  }
  return <form ref={formRef} className={styles.jobForm} onSubmit={save} aria-busy={pending} onChange={() => setWarnings([])}>
    <h3>{mode === "ready" ? "Mark ready" : mode === "assign" ? "Choose a technician" : "Schedule"}</h3>
    {error ? <p role="alert">{error}</p> : null}
    <fieldset disabled={pending}>
      {mode === "ready" ? <label>What is ready now?<textarea name="notes" required maxLength={3000} rows={2}/></label> : <>
        <InternalAssignmentFields storeId={job.storeId} defaultManager={job.internalAccountableId && job.internalAccountableId !== "facilities-coordination" ? {id:job.internalAccountableId,name:job.internalAccountableParty} : undefined} defaultTarget={person ? person.id ? "person" : "pool" : job.internalTarget ?? "pool"}
          onSelectionChange={selection=>setReassigning(selection.target!==(job.internalTarget??"pool") || (selection.target==="person" && selection.personId!==job.internalMembershipId) || (selection.target==="awaiting_allocation" && selection.managerId!==job.internalAccountableId))}
          defaultPerson={person?.id ? person : job.internalMembershipId ? { id: job.internalMembershipId, name: job.internalAssigneeName ?? "Technician" } : undefined}/>
        {mode === "schedule" ? <>
          <InternalScheduleFields plan={person ? undefined : job.schedule ? {...job.schedule, localStart} : undefined} manager storeZone={job.storeZone ?? organizationZone} planningZone={organizationZone} date={day} today={day} waiting={Boolean(job.hasOpenFollowUp || job.visitHoldPosture)} showSubmit={false}/>
          {reassigning ? <label>Why change who handles this?<textarea name="reason" required rows={2} maxLength={1000}/></label> : null}
        </> : <label>Why change who handles this?<textarea name="reason" required rows={2} maxLength={1000}/></label>}
      </>}
      {warnings.length ? <section className={styles.warning} role="alert"><h4>Check this date</h4>{warnings.map(warning => <p key={warning}>{warning}</p>)}<div className={styles.actions}><button className={styles.primary} type="submit" name="keepConflicts" value="yes">Keep this date</button><button type="button" onClick={() => { setWarnings([]); formRef.current?.querySelector<HTMLInputElement>('input[type="date"],input[type="datetime-local"]')?.focus(); }}>Pick another</button></div></section>
        : <div className={styles.actions}><button type="submit" className={styles.primary}>{mode === "ready" ? "Mark ready" : mode === "assign" ? "Save technician" : "Save date"}</button><button type="button" onClick={onCancel}>Cancel</button></div>}
    </fieldset>
  </form>;
}

function DaySheet({ day, person, filters, bucket, organizationZone, onClose, onOpen }: { day: string; person?: Person; filters: Filters; bucket?: string; organizationZone: string; onClose: () => void; onOpen: (job: DispatchJob) => void }) {
  const [page, setPage] = useState<JobPage>(), [error, setError] = useState(""), [pending, setPending] = useState(false);
  const load = useCallback(async (cursor?: string) => {
    setPending(true); setError("");
    const query = new URLSearchParams({ day, ...filters, ...(person ? { person: person.id } : { unassigned: "yes", person: "" }), ...(bucket ? { bucket } : {}), ...(cursor ? { cursor } : {}) });
    try { const response = await fetch(`/api/ops/internal-dispatch/jobs?${query}`); const result = await response.json() as JobPage & { error?: string }; if (!response.ok) throw new Error(result.error ?? "Could not load jobs. Try again."); setPage(previous => cursor && previous ? { ...result, items: [...previous.items, ...result.items] } : result); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load jobs. Try again."); }
    finally { setPending(false); }
  }, [day, person, filters, bucket]);
  useEffect(() => {
    const controller=new AbortController();
    const query=new URLSearchParams({day,...filters,...(person?{person:person.id}:{unassigned:"yes",person:""}),...(bucket?{bucket}:{})});
    fetch(`/api/ops/internal-dispatch/jobs?${query}`,{signal:controller.signal}).then(async response=>{const result=await response.json() as JobPage & {error?:string};if(!response.ok)throw new Error(result.error??"Could not load jobs. Try again.");return result;}).then(setPage).catch(reason=>{if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:"Could not load jobs. Try again.");});
    return ()=>controller.abort();
  }, [day,person,filters,bucket]);
  return <Sheet title={`${person?.name ?? "Not assigned"} · ${dateLabel(day, true)}`} onClose={onClose}><div className={styles.sheetBody}>
    {error ? <p role="alert">{error} <button type="button" onClick={() => void load()}>Try again</button></p> : null}
    {!page ? <div className={styles.skeleton} role="status">Loading…</div> : <>{orderedStops(page.items).map(job => <button type="button" className={styles.dayJob} key={job.id} onClick={() => onOpen(job)}><strong>Store {job.storeNumber} · {job.problem}</strong><span>{dispatchStatus(job).label} · {dispatchPlanLabel(job.schedule, organizationZone)}</span></button>)}
      <p>Showing {page.items.length} of {page.totalCount ?? page.items.length}</p>{page.nextCursor ? <button type="button" disabled={pending} onClick={() => void load(page.nextCursor)}>Show more</button> : null}
      {!page.items.length ? <p>No jobs match this day. Close to choose another day.</p> : null}</>}
  </div></Sheet>;
}
