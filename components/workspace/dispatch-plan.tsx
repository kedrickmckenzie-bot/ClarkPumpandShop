"use client";
import Link from "next/link";
import { cachedDateTimeFormat } from "@/lib/ops/intl-format-cache";
import { useEffect, useRef, useState } from "react";
import { roleCan } from "@/components/ops/role-policy";
import {
  canPlanJob,
  orderedStops,
  dueLabel,
  type DispatchJob,
} from "@/lib/ops/dispatch-board";
import { addCalendarDays } from "@/lib/ops/internal-schedule-types";
import { civilDate, mondayOf } from "@/lib/ops/dispatch-calendar";
import type { loadDispatchBoard } from "@/lib/server/dispatch-board-page";
import { JobSheet, Sheet } from "./dispatch-board";
import styles from "./dispatch-plan.module.css";

type Board = Awaited<ReturnType<typeof loadDispatchBoard>>;
type Move = {
  job: DispatchJob;
  day?: string;
  person?: string;
  order?: number;
  restore?: boolean;
  plan?: DispatchJob["schedule"];
};
type Undo = { before: DispatchJob; after: DispatchJob }[];
const minutes = (job: DispatchJob) =>
  job.estimatedMinutes ?? job.schedule?.durationMinutes;
const duration = (job: DispatchJob) =>
  minutes(job) === undefined ? "time unknown" : `${minutes(job)! / 60} h`;
const dayLabel = (day: string) =>
  cachedDateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${day}T12:00:00Z`));
function totals(jobs: DispatchJob[]) {
  return `${jobs.length} stops · ~${jobs.reduce((sum, j) => sum + (minutes(j) ?? 0), 0) / 60} h${jobs.some((j) => minutes(j) === undefined) ? ` · ${jobs.filter((j) => minutes(j) === undefined).length} time unknown` : ""}`;
}

export function DispatchPlan(initial: Board) {
  const [confirmation, setConfirmation] = useState<{
    moves: Move[];
    undo: boolean;
    late: number;
    appointment: boolean;
  }>();
  const [data, setData] = useState(initial),
    [week, setWeek] = useState(initial.week),
    [view, setView] = useState(initial.view);
  const [chosenJobs, setChosenJobs] = useState<DispatchJob[]>([]);
  const [selected, setSelected] = useState<string[]>([]),
    [chooser, setChooser] = useState(false),
    [assignDay, setAssignDay] = useState(initial.today),
    [person, setPerson] = useState("");
  const [mobilePerson, setMobilePerson] = useState(
      initial.commitments[0]?.id ?? "",
    ),
    [detail, setDetail] = useState<DispatchJob>(),
    [message, setMessage] = useState("");
  const [pending, setPending] = useState(false),
    [receipt, setReceipt] = useState<Undo>(),
    [error, setError] = useState(false),
    [showQueue, setShowQueue] = useState(false);
  const busy = useRef(false),
    drag = useRef<DispatchJob | undefined>(undefined),
    generation = useRef(0);
  const manager = roleCan(initial.session, "assign_internal_work");
  const all = () => [
    ...new Map(
      [
        ...chosenJobs,
        ...data.queue.items,
        ...data.commitments.flatMap((t) => [
          ...t.items,
          ...(t.current ? [t.current] : []),
          ...(t.next ? [t.next] : []),
        ]),
      ].map((j) => [j.id, j]),
    ).values(),
  ];
  async function refresh(nextWeek = week, nextView = view) {
    const revision = ++generation.current;
    const response = await fetch(
      `/api/ops/internal-dispatch/board?${new URLSearchParams({ week: nextWeek, view: nextView, queueCursor: initial.queueCursor, ...Object.fromEntries(Object.entries(initial.filters).filter(([, v]) => v)) })}`,
      { cache: "no-store" },
    );
    const result = (await response.json()) as Board & { error?: string };
    if (!response.ok)
      throw Error(result.error ?? "Could not refresh Dispatch.");
    if (revision === generation.current && !busy.current) setData(result);
  }
  useEffect(() => {
    const timer = setInterval(() => {
      if (!busy.current)
        void refresh().catch(() => {
          setError(true);
          setMessage("Could not refresh. Showing the last saved view.");
        });
    }, 30000);
    return () => clearInterval(timer);
  });
  const refreshSafely = (nextWeek = week, nextView = view) =>
    refresh(nextWeek, nextView).catch(() => {
      setError(true);
      setMessage("Could not refresh. Showing the last saved view.");
    });
  const update = (jobs: DispatchJob[]) =>
    setData((old) => ({
      ...old,
      queue: {
        ...old.queue,
        items: old.queue.items.filter((j) => !jobs.some((n) => n.id === j.id)),
      },
      commitments: old.commitments.map((t) => ({
        ...t,
        items: [
          ...t.items.filter((j) => !jobs.some((n) => n.id === j.id)),
          ...jobs.filter(
            (j) =>
              j.internalMembershipId === t.id &&
              j.schedule &&
              j.schedule.day! >= week &&
              j.schedule.day! <= addCalendarDays(week, 6),
          ),
        ],
      })),
    }));
  async function move(moves: Move[], undo = false, confirmed = false) {
    if (busy.current || !moves.length) return;
    const late = moves.filter(
      (m) =>
        m.day &&
        (m.job.targetCompletionAt ?? m.job.dueAt) &&
        m.day >
          cachedDateTimeFormat("en-CA", {
            timeZone: m.job.storeZone ?? data.organizationZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(
            new Date(
              [m.job.targetCompletionAt, m.job.dueAt]
                .filter((value): value is string => Boolean(value))
                .sort()[0],
            ),
          ),
    );
    const appointment =
      !undo &&
      moves.some(
        (m) =>
          m.day &&
          m.job.schedule?.precision === "appointment" &&
          m.day !== m.job.schedule.day,
      );
    if (!confirmed && (late.length || appointment)) {
      setConfirmation({ moves, undo, late: late.length, appointment });
      return;
    }
    setConfirmation(undefined);
    const snapshot = data;
    busy.current = true;
    generation.current++;
    setPending(true);
    setError(false);
    setMessage("Saving…");
    update(
      moves.map((m) => ({
        ...m.job,
        internalMembershipId: m.person ?? m.job.internalMembershipId,
        schedule: m.day
          ? {
              ...m.job.schedule,
              id: m.job.schedule?.id ?? "pending",
              precision: "day",
              planningZone: data.organizationZone,
              week: mondayOf(m.day),
              day: m.day,
              tentative: false,
              stopOrder: m.order ?? m.job.schedule?.stopOrder,
            }
          : undefined,
      })),
    );
    try {
      const response = await fetch("/api/ops/internal-dispatch/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobs: moves.map((m) => ({
            workOrderId: m.job.id,
            expectedVersion: m.job.version ?? 0,
            expectedAssignmentId: m.job.assignmentId,
            expectedScheduleId: m.job.schedule?.id ?? null,
            key: crypto.randomUUID(),
            precision:
              m.plan?.precision ??
              (m.day
                ? m.job.schedule?.precision === "appointment"
                  ? "appointment"
                  : "day"
                : "removed"),
            date: m.plan?.day ?? m.plan?.week ?? m.day,
            localStart:
              (m.plan ?? m.job.schedule)?.precision === "appointment"
                ? `${m.day ?? m.plan?.day}T${(m.plan ?? m.job.schedule)?.localStart?.slice(11, 16) ?? cachedDateTimeFormat("en-GB", { timeZone: m.job.storeZone ?? data.organizationZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date((m.plan ?? m.job.schedule)!.startsAt!))}`
                : undefined,
            disambiguation: (m.plan ?? m.job.schedule)?.disambiguation,
            tentative: m.plan?.tentative ?? false,
            target: m.person ? "person" : m.job.internalTarget,
            membershipId: m.person ?? m.job.internalMembershipId,
            managerId:
              m.job.internalTarget === "awaiting_allocation"
                ? m.job.internalAccountableId
                : undefined,
            durationMinutes: minutes(m.job),
            stopOrder: m.order ?? m.job.schedule?.stopOrder,
            keepConflicts: late.length > 0,
            restoreUnscheduled: m.restore,
            reviewReason: undo ? "Undo last Plan change" : undefined,
          })),
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        results: {
          version: number;
          schedule?: NonNullable<DispatchJob["schedule"]> & {
            assignmentId: string;
          };
          assignment?: { id: string };
        }[];
      };
      if (!response.ok)
        throw Error(
          result.error ??
            "The plan was not saved. Your previous plan is restored.",
        );
      const after = moves.map((m, i) => ({
        ...m.job,
        version: result.results[i].version,
        assignmentId:
          result.results[i].schedule?.assignmentId ??
          result.results[i].assignment?.id,
        internalMembershipId: m.person ?? m.job.internalMembershipId,
        schedule: m.day || m.plan ? result.results[i].schedule : undefined,
      }));
      if (!undo)
        setReceipt(moves.map((m, i) => ({ before: m.job, after: after[i] })));
      else setReceipt(undefined);
      setMessage(undo ? "Saved · Previous plan restored" : "Saved");
      setSelected([]);
      setChooser(false);
      busy.current = false;
      await refresh().catch(() =>
        setMessage("Saved · Refresh to see the latest team view."),
      );
    } catch (e) {
      setData(snapshot);
      setError(true);
      setMessage(
        e instanceof Error
          ? e.message
          : "Could not save. Previous plan restored.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  async function undo() {
    if (!receipt) return;
    await move(
      receipt.map(({ before, after }) => ({
        job: {
          ...after,
          internalTarget: before.internalTarget,
          internalMembershipId: before.internalMembershipId,
        },
        day: before.schedule?.day,
        person: before.internalMembershipId,
        order: before.schedule?.stopOrder,
        restore: !before.schedule,
        plan: before.schedule,
      })),
      true,
    );
  }
  const jobsFor = (id: string, day: string) =>
    orderedStops(
      data.commitments
        .find((t) => t.id === id)
        ?.items.filter((j) => j.schedule?.day === day) ?? [],
    );
  const days = Array.from({ length: 7 }, (_, i) => addCalendarDays(week, i));
  const choose = (jobs: DispatchJob[], day = data.today) => {
    setChosenJobs(jobs);
    setSelected(jobs.map((j) => j.id));
    setAssignDay(day);
    setPerson("");
    setChooser(true);
  };
  const groups = [
    ...new Set(data.queue.items.map((j) => j.storeRegionId ?? "unclassified")),
  ];
  const toggle = (job: DispatchJob) =>
    setSelected((old) =>
      old.includes(job.id)
        ? old.filter((id) => id !== job.id)
        : [
            ...old.filter(
              (id) =>
                data.queue.items.find((j) => j.id === id)?.storeRegionId ===
                job.storeRegionId,
            ),
            job.id,
          ],
    );
  const status = (tech: Board["commitments"][number]) => {
    const visit = tech.lastVisit,
      update = tech.statusUpdate;
    if (visit?.status === "active")
      return `Working${tech.current ? ` at ${visit.storeNumber ?? tech.current.storeNumber}` : " onsite"} · since ${cachedDateTimeFormat("en-US", { timeZone: data.organizationZone, hour: "numeric", minute: "2-digit" }).format(new Date(visit.checkedInAt))}`;
    if (
      update &&
      (!visit?.checkedOutAt || update.recordedAt >= visit.checkedOutAt) &&
      civilDate(update.recordedAt, data.organizationZone) >= data.today
    )
      return {
        heading: `On the way to ${update.storeNumber ?? "a job"}`,
        parts: "Getting parts",
        break: "On a break",
        done: "Done for the day",
      }[update.status];
    return visit?.checkedOutAt
      ? `Last: finished ${visit.storeNumber ?? ""} at ${cachedDateTimeFormat("en-US", { timeZone: data.organizationZone, hour: "numeric", minute: "2-digit" }).format(new Date(visit.checkedOutAt))}`
      : "No activity recorded today";
  };
  const stop = (job: DispatchJob, index: number, siblings: DispatchJob[]) => (
    <div
      key={job.id}
      className={styles.stop}
      draggable={manager && !pending && canPlanJob(job)}
      onDragStart={() => {
        drag.current = job;
      }}
      onDragEnd={() => {
        drag.current = undefined;
      }}
    >
      <button className={styles.job} onClick={() => setDetail(job)}>
        <strong>
          {job.storeNumber} ·{" "}
          {job.storeName.replace(`${data.session.organizationName} - `, "")}
        </strong>
        <span>{job.problem}</span>
        <small>{duration(job)}</small>
      </button>
      {job.schedule?.startsAt ? (
        <small>
          Appointment{" "}
          {cachedDateTimeFormat("en-US", {
            timeZone: job.storeZone ?? data.organizationZone,
            hour: "numeric",
            minute: "2-digit",
          }).format(new Date(job.schedule.startsAt))}
        </small>
      ) : null}
      {job.technicianNotes ? <small>{job.technicianNotes}</small> : null}
      {manager && canPlanJob(job) ? (
        <details className={styles.moves}>
          <summary>Move</summary>
          <div>
            <button
              disabled={pending}
              onClick={() =>
                void move([
                  {
                    job,
                    day: addCalendarDays(job.schedule?.day ?? data.today, 1),
                  },
                ])
              }
            >
              Tomorrow
            </button>
            <button
              disabled={pending}
              onClick={() =>
                void move([
                  {
                    job,
                    day: addCalendarDays(job.schedule?.day ?? data.today, 7),
                  },
                ])
              }
            >
              Next week
            </button>
            <button
              disabled={pending}
              onClick={() => choose([job], job.schedule?.day)}
            >
              Give to…
            </button>
            <button disabled={pending} onClick={() => void move([{ job }])}>
              Unschedule
            </button>
            {index > 0 && siblings.every(canPlanJob) ? (
              <button
                disabled={pending}
                onClick={() =>
                  void move(
                    siblings.map((j, i) => ({
                      job: j,
                      day: j.schedule?.day,
                      order:
                        i === index ? index - 1 : i === index - 1 ? index : i,
                    })),
                  )
                }
              >
                Move up ↑
              </button>
            ) : null}
            {index < siblings.length - 1 && siblings.every(canPlanJob) ? (
              <button
                disabled={pending}
                onClick={() =>
                  void move(
                    siblings.map((j, i) => ({
                      job: j,
                      day: j.schedule?.day,
                      order:
                        i === index ? index + 1 : i === index + 1 ? index : i,
                    })),
                  )
                }
              >
                Move down ↓
              </button>
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
  const queue = (
    <aside className={styles.queue}>
      <h2>
        Needs a tech{" "}
        <small>{data.queue.totalCount ?? data.queue.items.length}</small>
      </h2>
      {!data.queue.items.length ? (
        <p>All ready work has a technician.</p>
      ) : (
        groups.map((region) => (
          <section key={region}>
            <h3>
              {data.regions.find((r) => r.id === region)?.name ?? "No region"}
            </h3>
            {[
              ...new Set(
                data.queue.items
                  .filter((j) => (j.storeRegionId ?? "unclassified") === region)
                  .map((j) => j.storeId),
              ),
            ].map((store) => (
              <div key={store}>
                {data.queue.items
                  .filter((j) => j.storeId === store)
                  .map((job) => (
                    <div className={styles.incoming} key={job.id}>
                      {manager &&
                      canPlanJob(job) &&
                      !job.hasOpenFollowUp &&
                      !job.visitHoldPosture ? (
                        <label>
                          <input
                            type="checkbox"
                            checked={selected.includes(job.id)}
                            onChange={() => toggle(job)}
                          />
                          <span>
                            {job.storeNumber} ·{" "}
                            {job.storeName.replace(
                              `${data.session.organizationName} - `,
                              "",
                            )}
                          </span>
                        </label>
                      ) : (
                        <strong>
                          {job.storeNumber} · {job.storeName}
                        </strong>
                      )}
                      <button
                        className={styles.job}
                        onClick={() => setDetail(job)}
                      >
                        {job.problem}
                      </button>
                      <small>
                        {duration(job)} ·{" "}
                        {dueLabel(job, data.today, data.organizationZone)}
                      </small>
                      {job.technicianNotes ? (
                        <p>{job.technicianNotes}</p>
                      ) : null}
                    </div>
                  ))}
              </div>
            ))}
          </section>
        ))
      )}
      {selected.length ? (
        <div className={styles.bulk}>
          <b>{selected.length} selected</b>
          <button
            className={styles.primary}
            onClick={() =>
              choose(
                all().filter((j) => selected.includes(j.id)),
                assignDay,
              )
            }
          >
            Give to…
          </button>
        </div>
      ) : null}
      {data.queue.nextCursor ? (
        <Link
          href={`/app/dispatch?${new URLSearchParams({ view: "plan", week, queueCursor: data.queue.nextCursor, ...data.filters })}`}
        >
          More jobs
        </Link>
      ) : null}
    </aside>
  );
  return (
    <section className={styles.workspace}>
      <header className={styles.header}>
        <div>
          <h1>Dispatch</h1>
          <p>{view === "day" ? "Live updates from the team" : "Plan by day"}</p>
        </div>
        <Link href="/app/dispatch?view=list">Search all jobs</Link>
      </header>
      <nav className={styles.tabs}>
        <button
          aria-current={view === "plan" ? "page" : undefined}
          onClick={() => {
            setView("plan");
            void refreshSafely(week, "plan");
          }}
        >
          Plan
        </button>
        <button
          aria-current={view === "day" ? "page" : undefined}
          onClick={() => {
            setView("day");
            void refreshSafely(week, "day");
          }}
        >
          Today
        </button>
      </nav>
      {message ? (
        <div
          role={error ? "alert" : "status"}
          className={error ? styles.error : styles.saved}
        >
          {message}
          {receipt && !error ? (
            <button disabled={pending} onClick={() => void undo()}>
              Undo
            </button>
          ) : null}
          {error ? (
            <button
              onClick={() =>
                void refresh()
                  .then(() => {
                    setError(false);
                    setMessage("View refreshed");
                  })
                  .catch(() =>
                    setMessage("Still unable to refresh. Try again shortly."),
                  )
              }
            >
              Refresh
            </button>
          ) : null}
        </div>
      ) : null}
      {!data.people.length ? (
        <p role="status">No technicians are available in your store scope.</p>
      ) : null}
      {view === "day" ? (
        <>
          <p className={styles.muted}>Refreshes every 30 seconds</p>
          <div className={styles.today}>
            {data.commitments.map((tech) => {
              const elapsed =
                  tech.lastVisit?.status === "active"
                    ? Math.floor(
                        (Date.parse(data.asOf) -
                          Date.parse(tech.lastVisit.checkedInAt)) /
                          60000,
                      )
                    : undefined,
                estimate = tech.current ? minutes(tech.current) : undefined,
                late =
                  elapsed !== undefined &&
                  estimate !== undefined &&
                  elapsed > estimate;
              return (
                <article key={tech.id}>
                  <Link href={`/app/dispatch/technicians/${tech.id}`}>
                    {tech.name}
                  </Link>
                  <div>
                    <strong>{status(tech)}</strong>
                    {elapsed !== undefined ? (
                      <p>
                        {Math.round(elapsed / 6) / 10} h onsite
                        {estimate !== undefined
                          ? ` · planned ${estimate / 60} h`
                          : " · time unknown"}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <small>Next stop</small>
                    {tech.next ? (
                      <button
                        className={styles.job}
                        onClick={() => setDetail(tech.next)}
                      >
                        {tech.next.storeNumber} · {tech.next.problem}
                      </button>
                    ) : (
                      <p>No dated stops</p>
                    )}
                    {late && tech.next ? (
                      <span className={styles.warning}>May start late</span>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <div className={styles.toolbar}>
            <div>
              <button
                onClick={() => {
                  const next = mondayOf(data.today);
                  setWeek(next);
                  void refreshSafely(next);
                }}
              >
                This week
              </button>
              <button
                onClick={() => {
                  const next = addCalendarDays(mondayOf(data.today), 7);
                  setWeek(next);
                  void refreshSafely(next);
                }}
              >
                Next week
              </button>
            </div>
            <span>
              {dayLabel(week)} – {dayLabel(addCalendarDays(week, 6))}
            </span>
          </div>
          <button
            className={styles.mobileToggle}
            onClick={() => setShowQueue(!showQueue)}
          >
            Needs a tech · {data.queue.totalCount ?? 0}{" "}
            {showQueue ? "Hide" : "View"}
          </button>
          <div className={styles.layout}>
            <div
              className={showQueue ? styles.queueVisible : styles.queueDesktop}
            >
              {queue}
            </div>
            <div className={styles.plan}>
              <label className={styles.mobileSelect}>
                Technician
                <select
                  value={mobilePerson}
                  onChange={(e) => setMobilePerson(e.target.value)}
                >
                  {data.commitments.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className={styles.board}>
                <div className={styles.boardHeader}>
                  <b>Technician</b>
                  {days.map((day) => (
                    <b key={day}>{dayLabel(day)}</b>
                  ))}
                </div>
                {data.commitments.map((tech) => (
                  <div
                    className={`${styles.techRow} ${tech.id === mobilePerson ? styles.mobileActive : ""}`}
                    key={tech.id}
                  >
                    <div className={styles.person}>
                      <Link href={`/app/dispatch/technicians/${tech.id}`}>
                        {tech.name}
                      </Link>
                      <small>
                        {data.regions.find((r) => r.id === tech.homeRegionId)
                          ?.name ?? "No home region"}
                      </small>
                    </div>
                    {days.map((day) => {
                      const jobs = jobsFor(tech.id, day);
                      return (
                        <section
                          className={styles.day}
                          key={day}
                          onDragOver={(e) => {
                            if (manager && drag.current && !pending)
                              e.preventDefault();
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (drag.current)
                              void move([
                                { job: drag.current, day, person: tech.id },
                              ]);
                            drag.current = undefined;
                          }}
                        >
                          <h3>{dayLabel(day)}</h3>
                          {jobs.map((job, i) => stop(job, i, jobs))}
                          <small
                            className={
                              jobs.reduce((n, j) => n + (minutes(j) ?? 0), 0) >
                              480
                                ? styles.warning
                                : styles.total
                            }
                          >
                            {jobs.length ? totals(jobs) : "No stops"}
                          </small>
                        </section>
                      );
                    })}
                    {tech.nextCursor ? (
                      <Link href={`/app/dispatch/technicians/${tech.id}`}>
                        More jobs
                      </Link>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
      {confirmation ? (
        <Sheet
          title="Check this move"
          onClose={() => setConfirmation(undefined)}
        >
          <div className={styles.chooser}>
            {confirmation.late ? (
              <p>
                {confirmation.late} job(s) will be after their deadline. The
                original deadlines will stay unchanged.
              </p>
            ) : null}
            {confirmation.appointment ? (
              <p>
                The appointment will move to the selected day at its existing
                local time.
              </p>
            ) : null}
            <button
              className={styles.primary}
              onClick={() =>
                void move(confirmation.moves, confirmation.undo, true)
              }
            >
              Keep these dates
            </button>
            <button onClick={() => setConfirmation(undefined)}>
              Cancel move
            </button>
          </div>
        </Sheet>
      ) : null}
      {chooser && !confirmation ? (
        <Sheet
          title={`Give ${selected.length} job${selected.length === 1 ? "" : "s"} to…`}
          onClose={() => setChooser(false)}
        >
          <div className={styles.chooser}>
            <label>
              Day
              <input
                type="date"
                value={assignDay}
                onInput={(e) => setAssignDay(e.currentTarget.value)}
                onChange={(e) => setAssignDay(e.target.value)}
              />
            </label>
            <p>Technicians listed alphabetically.</p>
            {[...data.commitments]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((t) => (
                <label className={styles.choice} key={t.id}>
                  <input
                    type="radio"
                    name="technician"
                    checked={person === t.id}
                    onChange={() => setPerson(t.id)}
                  />
                  <span>
                    <strong>{t.name}</strong>
                    <small
                      className={
                        selected.some(
                          (id) =>
                            all().find((j) => j.id === id)?.storeRegionId ===
                            t.homeRegionId,
                        )
                          ? styles.match
                          : ""
                      }
                    >
                      {data.regions.find((r) => r.id === t.homeRegionId)
                        ?.name ?? "No home region"}
                    </small>
                    <small>
                      {t.skills.length
                        ? t.skills.map((skill) => (
                            <span
                              key={skill}
                              className={
                                chosenJobs.some((j) =>
                                  `${j.categoryKey ?? ""} ${j.problem}`
                                    .toLowerCase()
                                    .includes(skill.toLowerCase()),
                                )
                                  ? styles.match
                                  : undefined
                              }
                            >
                              {skill.replaceAll("_", " ")}{" "}
                            </span>
                          ))
                        : "Skills not entered"}
                    </small>
                    <small>{status(t)}</small>
                  </span>
                  <small>{totals(jobsFor(t.id, assignDay))}</small>
                </label>
              ))}
            <button
              className={styles.primary}
              disabled={!person || !assignDay || pending}
              onClick={() =>
                void move(
                  all()
                    .filter((j) => selected.includes(j.id))
                    .map((job, i) => ({
                      job,
                      day: assignDay,
                      person,
                      order: jobsFor(person, assignDay).length + i,
                    })),
                )
              }
            >
              Give jobs · {dayLabel(assignDay)}
            </button>
          </div>
        </Sheet>
      ) : null}
      {detail ? (
        <JobSheet
          selection={{ job: detail }}
          manager={manager}
          organizationZone={data.organizationZone}
          week={week}
          onClose={() => setDetail(undefined)}
          onSaved={(note, _nextWeek, saved) => {
            setMessage(note);
            setReceipt(undefined);
            if (saved)
              void fetch(
                `/api/ops/internal-dispatch/jobs/${encodeURIComponent(saved.previous.id)}`,
                { cache: "no-store" },
              )
                .then(async (response) => {
                  if (!response.ok) throw Error();
                  const result = (await response.json()) as {
                    job: DispatchJob;
                  };
                  if (result.job.version !== saved.version) throw Error();
                  setReceipt([{ before: saved.previous, after: result.job }]);
                })
                .catch(() => {
                  setError(true);
                  setMessage(
                    "Saved. Reload the job before making another change.",
                  );
                });
            void refreshSafely();
          }}
        />
      ) : null}
    </section>
  );
}
