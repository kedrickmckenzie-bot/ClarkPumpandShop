"use client";
import Link from "next/link";
import { cachedDateTimeFormat } from "@/lib/ops/intl-format-cache";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { roleCan } from "@/components/ops/role-policy";
import {
  canPlanJob,
  dispatchStatus,
  orderedStops,
  dueLabel,
  type DispatchJob,
} from "@/lib/ops/dispatch-board";
import { addCalendarDays } from "@/lib/ops/internal-schedule-types";
import { civilDate, mondayOf } from "@/lib/ops/dispatch-calendar";
import type { loadDispatchBoard } from "@/lib/server/dispatch-board-page";
import { JobSheet, Sheet } from "./dispatch-board";
import { jobShortName } from "@/lib/ops/short-name";
import { DispatchMap, TECH_COLORS, type MapTech } from "./dispatch-map";
import styles from "./dispatch-plan.module.css";

type Board = Awaited<ReturnType<typeof loadDispatchBoard>>;
type Tech = Board["commitments"][number];
type Move = {
  job: DispatchJob;
  day?: string;
  person?: string;
  order?: number;
  restore?: boolean;
  plan?: DispatchJob["schedule"];
};
type Undo = { before: DispatchJob; after: DispatchJob }[];
type Scale = "day" | "week" | "map";
const minutes = (job: DispatchJob) =>
  job.estimatedMinutes ?? job.schedule?.durationMinutes;
const hours = (value: number) => `${Math.round((value / 60) * 10) / 10} h`;
const duration = (job: DispatchJob) =>
  minutes(job) === undefined ? "time unknown" : hours(minutes(job)!);
const dayLabel = (day: string, weekday: "short" | "long" = "short") =>
  cachedDateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday,
    month: "short",
    day: "numeric",
  }).format(new Date(`${day}T12:00:00Z`));
function totals(jobs: DispatchJob[]) {
  const known = jobs.reduce((sum, j) => sum + (minutes(j) ?? 0), 0);
  const unknown = jobs.filter((j) => minutes(j) === undefined).length;
  return `${jobs.length} ${jobs.length === 1 ? "job" : "jobs"}${known ? ` · ~${hours(known)}` : ""}${unknown ? ` · ${unknown} time unknown` : ""}`;
}
const overFull = (jobs: DispatchJob[]) =>
  jobs.reduce((n, j) => n + (minutes(j) ?? 0), 0) > 480;
/** Returns the list with `job` placed at `index`, removing it from any earlier spot. */
function placeAt(list: DispatchJob[], job: DispatchJob, index: number) {
  const rest = list.filter((j) => j.id !== job.id);
  rest.splice(Math.max(0, Math.min(index, rest.length)), 0, job);
  return rest;
}

/**
 * Stop-order numbers that make the board show `list` in this order. Jobs that cannot be
 * moved (started, waiting on parts) keep their number; movable jobs are numbered around them.
 */
export function stopOrders(
  list: DispatchJob[],
  movable: (job: DispatchJob) => boolean,
) {
  const unset = 1000000;
  let floor = -1;
  return list.map((job, i) => {
    if (!movable(job)) {
      const fixed = job.schedule?.stopOrder ?? unset;
      floor = Math.max(floor, fixed);
      return fixed;
    }
    const nextFixed = list.slice(i + 1).find((j) => !movable(j));
    floor += nextFixed ? 1 : 10;
    return floor;
  });
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
    [scale, setScale] = useState<Scale>(
      initial.view === "day" ? "day" : initial.view === "map" ? "map" : "week",
    ),
    [focusDay, setFocusDay] = useState(initial.day ?? initial.today);
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
    [showQueue, setShowQueue] = useState(false),
    [railOpen, setRailOpen] = useState(true),
    [dropTarget, setDropTarget] = useState<string>(),
    [heldPick, setHeldPick] = useState<{ jobs: DispatchJob[]; jobId: string; techId: string; position: number }>();
  const busy = useRef(false),
    drag = useRef<DispatchJob | undefined>(undefined),
    generation = useRef(0);
  const manager = roleCan(initial.session, "assign_internal_work");
  const router = useRouter();
  const shortStore = (job: DispatchJob) =>
    `${job.storeNumber} · ${job.storeName.replace(`${data.session.organizationName} - `, "")}`;
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
  async function refresh(nextWeek = week) {
    const revision = ++generation.current;
    const response = await fetch(
      `/api/ops/internal-dispatch/board?${new URLSearchParams({ week: nextWeek, view: "plan", queueCursor: initial.queueCursor, ...Object.fromEntries(Object.entries(initial.filters).filter(([, v]) => v)) })}`,
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
  const refreshSafely = (nextWeek = week) =>
    refresh(nextWeek).catch(() => {
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
    // Only a change of day can land after a deadline; reordering a day never asks.
    const late = moves.filter(
      (m) =>
        m.day &&
        m.day !== m.job.schedule?.day &&
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
  /** Puts `job` at position `index` in a tech's day and saves every stop whose position changed. */
  function placeJob(
    job: DispatchJob,
    techId: string,
    day: string,
    index: number,
  ) {
    if (!canPlanJob(job)) return;
    const list = placeAt(jobsFor(techId, day), job, index);
    const order = stopOrders(list, canPlanJob);
    void move(
      list
        .map((j, i) => ({ job: j, day, person: techId, order: order[i] }))
        .filter(
          (m) =>
            canPlanJob(m.job) &&
            (m.job.id === job.id || m.job.schedule?.stopOrder !== m.order),
        ),
    );
  }
  const dropProps = (techId: string, day: string, index: number) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!manager || !drag.current || pending) return;
      e.preventDefault();
      e.stopPropagation();
      const key = `${techId}|${day}|${index}`;
      if (dropTarget !== key) setDropTarget(key);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const job = drag.current;
      drag.current = undefined;
      setDropTarget(undefined);
      if (job) placeJob(job, techId, day, index);
    },
  });
  const dragProps = (job: DispatchJob) => ({
    draggable: manager && !pending && canPlanJob(job),
    onDragStart: () => {
      drag.current = job;
    },
    onDragEnd: () => {
      drag.current = undefined;
      setDropTarget(undefined);
    },
  });
  // Weekdays always; Saturday and Sunday only when someone has work planned then.
  const allDays = Array.from({ length: 7 }, (_, i) => addCalendarDays(week, i));
  const days = allDays.filter(
    (day, i) =>
      i < 5 || data.commitments.some((tech) => jobsFor(tech.id, day).length),
  );
  const choose = (jobs: DispatchJob[], day = focusDay) => {
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
  const clock = (at: string) =>
    cachedDateTimeFormat("en-US", {
      timeZone: data.organizationZone,
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(at));
  /** Live status from real check-ins and the tech's own "What's next?" update. */
  const status = (tech: Tech): { text: string; tone: string } => {
    const visit = tech.lastVisit,
      update = tech.statusUpdate;
    if (visit?.status === "active") {
      const elapsed = Math.floor(
        (Date.parse(data.asOf) - Date.parse(visit.checkedInAt)) / 60000,
      );
      const estimate = tech.current ? minutes(tech.current) : undefined;
      return {
        text: `Working at ${visit.storeNumber ?? tech.current?.storeNumber ?? "a store"} · since ${clock(visit.checkedInAt)}${estimate !== undefined && elapsed > estimate ? " · running over" : ""}`,
        tone: "working",
      };
    }
    if (
      update &&
      (!visit?.checkedOutAt || update.recordedAt >= visit.checkedOutAt) &&
      civilDate(update.recordedAt, data.organizationZone) >= data.today
    )
      return {
        heading: {
          text: `On the way to ${update.storeNumber ?? "a job"}`,
          tone: "moving",
        },
        parts: { text: "Getting parts", tone: "paused" },
        break: { text: "On a break", tone: "paused" },
        done: { text: "Done for the day", tone: "off" },
      }[update.status];
    return visit?.checkedOutAt &&
      civilDate(visit.checkedOutAt, data.organizationZone) >= data.today
      ? {
          text: `Finished ${visit.storeNumber ?? ""} at ${clock(visit.checkedOutAt)}`,
          tone: "idle",
        }
      : { text: "Not started", tone: "idle" };
  };
  /** One job on the board: number, few-word name, store, then time and state. */
  const card = (
    job: DispatchJob,
    index: number,
    list: DispatchJob[],
    techId: string,
    day: string,
  ) => {
    const state = dispatchStatus(job);
    const movable = manager && canPlanJob(job);
    const name = jobShortName(job);
    const late =
      job.dueAt &&
      civilDate(job.dueAt, job.storeZone ?? data.organizationZone) < day;
    return (
      <li
        key={job.id}
        className={`${styles.card} ${dropTarget === `${techId}|${day}|${index}` ? styles.dropBefore : ""}`}
        data-tone={state.tone}
        {...dragProps(job)}
        {...dropProps(techId, day, index)}
      >
        <span className={styles.number} aria-hidden="true">
          {index + 1}
        </span>
        <button
          className={styles.job}
          title={job.problem}
          onClick={() => setDetail(job)}
        >
          <strong>{name}</strong>
          <span>{shortStore(job)}</span>
          <small>
            {["urgent", "emergency"].includes(job.priority) ? (
              <em className={styles.urgentTag}>Urgent</em>
            ) : null}
            {job.schedule?.startsAt ? (
              <b>
                {cachedDateTimeFormat("en-US", {
                  timeZone: job.storeZone ?? data.organizationZone,
                  hour: "numeric",
                  minute: "2-digit",
                }).format(new Date(job.schedule.startsAt))}
              </b>
            ) : null}
            {duration(job)}
            {late ? <em className={styles.lateTag}>Late</em> : null}
          </small>
          {state.tone !== "normal" ? (
            <span className={styles.state}>{state.label}</span>
          ) : null}
        </button>
        {movable ? (
          <span className={styles.order}>
            <button
              aria-label={`Move ${name} earlier`}
              title="Earlier"
              disabled={pending || index === 0}
              onClick={() => placeJob(job, techId, day, index - 1)}
            >
              ↑
            </button>
            <button
              aria-label={`Move ${name} later`}
              title="Later"
              disabled={pending || index === list.length - 1}
              onClick={() => placeJob(job, techId, day, index + 1)}
            >
              ↓
            </button>
          </span>
        ) : null}
      </li>
    );
  };
  /** A tech's ordered jobs for one day, with a drop zone after the last job. */
  const stopList = (techId: string, day: string, quietEmpty = false) => {
    const jobs = jobsFor(techId, day);
    return (
      <>
        <ol className={styles.stops}>
          {jobs.map((job, i) => card(job, i, jobs, techId, day))}
        </ol>
        <div
          className={`${styles.dropEnd} ${dropTarget === `${techId}|${day}|${jobs.length}` ? styles.dropActive : ""}`}
          {...dropProps(techId, day, jobs.length)}
        >
          {jobs.length ? (
            <small className={overFull(jobs) ? styles.warning : styles.total}>
              {totals(jobs)}
              {overFull(jobs) ? " · over 8 h" : ""}
            </small>
          ) : quietEmpty ? null : (
            <small className={styles.empty}>Nothing planned</small>
          )}
        </div>
      </>
    );
  };
  const queue = (
    <aside className={styles.queue} aria-label="Jobs that need a tech">
      <h2>
        Needs a tech{" "}
        <span>{data.queue.totalCount ?? data.queue.items.length}</span>
        <button className={styles.railHide} onClick={() => setRailOpen(false)}>
          Hide
        </button>
      </h2>
      {manager && data.queue.items.length ? (
        <p className={styles.hint}>
          Drag onto a tech, or tick and press Give to.
        </p>
      ) : null}
      {!data.queue.items.length ? (
        <p className={styles.hint}>Every ready job has a tech.</p>
      ) : (
        groups.map((region) => (
          <section key={region}>
            <h3>
              {data.regions.find((r) => r.id === region)?.name ?? "No area"}
            </h3>
            <ul>
              {data.queue.items
                .filter((j) => (j.storeRegionId ?? "unclassified") === region)
                .map((job) => {
                  const pickable =
                    manager &&
                    canPlanJob(job) &&
                    !job.hasOpenFollowUp &&
                    !job.visitHoldPosture;
                  return (
                    <li
                      className={styles.incoming}
                      key={job.id}
                      {...(pickable ? dragProps(job) : {})}
                    >
                      {pickable ? (
                        <input
                          type="checkbox"
                          aria-label={`Choose ${jobShortName(job)}`}
                          checked={selected.includes(job.id)}
                          onChange={() => toggle(job)}
                        />
                      ) : null}
                      <button
                        className={styles.job}
                        onClick={() => setDetail(job)}
                      >
                        <strong>
                          {jobShortName(job)}
                          {["urgent", "emergency"].includes(job.priority) ? (
                            <em className={styles.urgentTag}> Urgent</em>
                          ) : null}
                        </strong>
                        <span>{shortStore(job)}</span>
                        <span className={styles.problem}>{job.problem}</span>
                        <small>
                          {duration(job)}
                          {job.dueAt
                            ? ` · ${dueLabel(job, data.today, data.organizationZone)}`
                            : ""}
                        </small>
                      </button>
                    </li>
                  );
                })}
            </ul>
          </section>
        ))
      )}
      {data.queue.nextCursor ? (
        <Link
          className={styles.more}
          href={`/app/dispatch?${new URLSearchParams({ view: "plan", week, queueCursor: data.queue.nextCursor, ...data.filters })}`}
        >
          More jobs
        </Link>
      ) : null}
      {selected.length ? (
        <div className={styles.bulk}>
          <b>{selected.length} chosen</b>
          <button
            className={styles.primary}
            onClick={() =>
              choose(
                all().filter((j) => selected.includes(j.id)),
                focusDay,
              )
            }
          >
            Give to…
          </button>
        </div>
      ) : null}
    </aside>
  );
  const goTo = (day: string) => {
    setFocusDay(day);
    const nextWeek = mondayOf(day);
    if (nextWeek !== week) {
      setWeek(nextWeek);
      void refreshSafely(nextWeek);
    }
  };
  const daily = scale !== "week";
  const stepDays = daily ? 1 : 7;
  const visibleTechs = data.commitments;
  // One colour per tech, in board order, so colours stay put while the map is open.
  const mapTechs = useMemo<MapTech[]>(
    () =>
      data.commitments.map((tech, i) => ({
        id: tech.id,
        name: tech.name,
        color: TECH_COLORS[i % TECH_COLORS.length],
        stops: orderedStops(
          tech.items.filter((j) => j.schedule?.day === focusDay),
        ),
        currentStoreId:
          tech.lastVisit?.status === "active"
            ? tech.current?.storeId
            : undefined,
      })),
    [data.commitments, focusDay],
  );
  /** Takes the chosen job off "next visit", then places it on the tech's day like any other move. */
  async function addHeld() {
    if (!heldPick?.techId) return;
    const pick = heldPick;
    setHeldPick(undefined);
    setError(false);
    setMessage("Saving…");
    try {
      const response = await fetch(`/api/ops/internal-dispatch/held/${encodeURIComponent(pick.jobId)}`, { method: "POST" });
      const result = (await response.json()) as { job?: DispatchJob; error?: string };
      if (!response.ok || !result.job) throw Error(result.error ?? "Could not add this job. Nothing changed.");
      if (!canPlanJob(result.job)) {
        setMessage("Taken off the next-visit list. It's now in Needs a tech.");
        await refreshSafely();
        return;
      }
      const list = jobsFor(pick.techId, focusDay);
      placeJob(result.job, pick.techId, focusDay, pick.position < 0 ? list.length : pick.position);
    } catch (e) {
      setError(true);
      setMessage(e instanceof Error ? e.message : "Could not add this job. Nothing changed.");
    }
  }
  const quickMove = (moves: Move[]) => {
    setDetail(undefined);
    void move(moves);
  };
  return (
    <section className={styles.workspace}>
      <header className={styles.header}>
        <div>
          <h1>Dispatch</h1>
          <p>
            {manager
              ? "Drag a job to move it. Use ↑ ↓ on a job to change the order."
              : "Who does what, and in what order"}
          </p>
        </div>
        <Link href="/app/dispatch?view=list">Search all jobs</Link>
      </header>
      <div className={styles.toolbar}>
        <div className={styles.scale} role="group" aria-label="Board view">
          {(["day", "week", "map"] as const).map((value) => (
            <button
              key={value}
              aria-pressed={scale === value}
              onClick={() => setScale(value)}
            >
              {value === "day" ? "Day" : value === "week" ? "Week" : "Map"}
            </button>
          ))}
        </div>
        <div className={styles.dateNav}>
          <button
            aria-label={daily ? "Previous day" : "Previous week"}
            onClick={() => goTo(addCalendarDays(focusDay, -stepDays))}
          >
            ‹
          </button>
          <button
            onClick={() => goTo(data.today)}
            aria-current={
              (daily ? focusDay === data.today : week === mondayOf(data.today))
                ? "date"
                : undefined
            }
          >
            {daily ? "Today" : "This week"}
          </button>
          <button
            aria-label={daily ? "Next day" : "Next week"}
            onClick={() => goTo(addCalendarDays(focusDay, stepDays))}
          >
            ›
          </button>
          <strong>
            {daily
              ? dayLabel(focusDay, "long")
              : `${dayLabel(week)} – ${dayLabel(addCalendarDays(week, 6))}`}
          </strong>
        </div>
        {data.regions.length > 1 ? (
          <label className={styles.area}>
            <span>Area</span>
            <select
              value={data.filters.region}
              onChange={(e) =>
                router.push(
                  `/app/dispatch?${new URLSearchParams({
                    view: scale === "week" ? "plan" : scale,
                    week,
                    day: focusDay,
                    ...(e.target.value ? { region: e.target.value } : {}),
                  })}`,
                )
              }
            >
              <option value="">All areas</option>
              {data.regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
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
      {scale === "map" ? (
        <DispatchMap
          techs={mapTechs}
          queue={data.queue.items}
          held={data.held}
          onOpen={setDetail}
          onPickHeld={(jobs) => {
            setHeldPick({ jobs, jobId: jobs[0].id, techId: "", position: -1 });
          }}
          shortStore={shortStore}
        />
      ) : (
        <>
          <button
            className={styles.mobileToggle}
            onClick={() => setShowQueue(!showQueue)}
          >
            Needs a tech ({data.queue.totalCount ?? 0}) ·{" "}
            {showQueue ? "Hide" : "Show"}
          </button>
          {!railOpen ? (
            <button
              className={styles.railShow}
              onClick={() => setRailOpen(true)}
            >
              Needs a tech ({data.queue.totalCount ?? 0}) · Show
            </button>
          ) : null}
          <div
            className={`${styles.layout} ${railOpen ? "" : styles.layoutWide}`}
          >
            <div
              className={`${showQueue ? styles.queueVisible : styles.queueDesktop} ${railOpen ? "" : styles.railClosed}`}
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
              {scale === "day" ? (
                <div
                  className={styles.dayBoard}
                  style={
                    { "--techs": visibleTechs.length } as React.CSSProperties
                  }
                >
                  {visibleTechs.map((tech) => {
                    const now = status(tech);
                    return (
                      <section
                        key={tech.id}
                        className={`${styles.column} ${tech.id === mobilePerson ? styles.mobileActive : ""}`}
                        aria-label={tech.name}
                      >
                        <header>
                          <Link href={`/app/dispatch/technicians/${tech.id}`}>
                            {tech.name}
                          </Link>
                          <small>
                            {data.regions.find(
                              (r) => r.id === tech.homeRegionId,
                            )?.name ?? "No home area"}
                          </small>
                          {focusDay === data.today ? (
                            <span className={styles.live} data-tone={now.tone}>
                              {now.text}
                            </span>
                          ) : null}
                        </header>
                        {stopList(tech.id, focusDay)}
                      </section>
                    );
                  })}
                </div>
              ) : (
                <div className={styles.board}>
                  <div
                    className={styles.boardHeader}
                    style={
                      { "--plan-days": days.length } as React.CSSProperties
                    }
                  >
                    <b>Technician</b>
                    {days.map((day) => (
                      <button
                        key={day}
                        className={
                          day === data.today ? styles.todayHead : undefined
                        }
                        onClick={() => {
                          setFocusDay(day);
                          setScale("day");
                        }}
                        title="Open this day"
                      >
                        {dayLabel(day)}
                      </button>
                    ))}
                  </div>
                  {data.commitments.map((tech) => {
                    const now = status(tech);
                    return (
                      <div
                        className={`${styles.techRow} ${tech.id === mobilePerson ? styles.mobileActive : ""}`}
                        style={
                          { "--plan-days": days.length } as React.CSSProperties
                        }
                        key={tech.id}
                      >
                        <div className={styles.person}>
                          <Link href={`/app/dispatch/technicians/${tech.id}`}>
                            {tech.name}
                          </Link>
                          <small>
                            {data.regions.find(
                              (r) => r.id === tech.homeRegionId,
                            )?.name ?? "No home area"}
                          </small>
                          <span className={styles.live} data-tone={now.tone}>
                            {now.text}
                          </span>
                        </div>
                        {days.map((day) => (
                          <section className={styles.day} key={day}>
                            <h3>{dayLabel(day)}</h3>
                            {stopList(tech.id, day, true)}
                          </section>
                        ))}
                        {tech.nextCursor ? (
                          <Link href={`/app/dispatch/technicians/${tech.id}`}>
                            More jobs
                          </Link>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
      {heldPick ? (
        <Sheet title="Add a next-visit job" onClose={() => setHeldPick(undefined)}>
          <div className={styles.chooser}>
            <p className={styles.hint}>
              {shortStore(heldPick.jobs[0])} · set aside for the next visit. Adding it puts it on the tech&apos;s {dayLabel(focusDay, "long")} and takes it off the next-visit list. The due date stays the same.
            </p>
            {heldPick.jobs.length > 1 ? <h3>Which job?</h3> : null}
            {heldPick.jobs.map((job) => (
              <label className={styles.choice} key={job.id}>
                {heldPick.jobs.length > 1 ? (
                  <input type="radio" name="held-job" aria-label={jobShortName(job)} checked={heldPick.jobId === job.id} onChange={() => setHeldPick({ ...heldPick, jobId: job.id })} />
                ) : null}
                <span>
                  <strong>{jobShortName(job)}</strong>
                  <small>{job.problem}</small>
                  <small>{duration(job)}{job.dueAt ? ` · ${dueLabel(job, data.today, data.organizationZone)}` : ""}</small>
                </span>
              </label>
            ))}
            <h3>Give it to</h3>
            {data.commitments.map((tech) => (
              <label className={styles.choice} key={tech.id}>
                <input type="radio" name="held-tech" aria-label={tech.name} checked={heldPick.techId === tech.id} onChange={() => setHeldPick({ ...heldPick, techId: tech.id, position: -1 })} />
                <span>
                  <strong>{tech.name}</strong>
                  <small>{totals(jobsFor(tech.id, focusDay))} on {dayLabel(focusDay)}</small>
                </span>
              </label>
            ))}
            {heldPick.techId ? (
              <label>
                Where in the day
                <select value={heldPick.position} onChange={(e) => setHeldPick({ ...heldPick, position: Number(e.target.value) })}>
                  <option value={-1}>At the end</option>
                  {jobsFor(heldPick.techId, focusDay).map((job, i) => (
                    <option key={job.id} value={i}>{i === 0 ? "First, before " : "Before "}stop {i + 1} · {jobShortName(job)}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <button className={styles.primary} disabled={!heldPick.techId || pending} onClick={() => void addHeld()}>
              {heldPick.techId ? `Add to ${data.commitments.find((t) => t.id === heldPick.techId)?.name}'s day` : "Choose a tech"}
            </button>
          </div>
        </Sheet>
      ) : null}
      {confirmation ? (
        <Sheet
          title="Check this move"
          onClose={() => setConfirmation(undefined)}
        >
          <div className={styles.chooser}>
            {confirmation.late ? (
              <p>
                {confirmation.late === 1
                  ? "This job will be planned after its due date."
                  : `${confirmation.late} jobs will be planned after their due dates.`}{" "}
                The due dates stay the same.
              </p>
            ) : null}
            {confirmation.appointment ? (
              <p>The appointment moves to the new day at the same time.</p>
            ) : null}
            <button
              className={styles.primary}
              onClick={() =>
                void move(confirmation.moves, confirmation.undo, true)
              }
            >
              Move anyway
            </button>
            <button onClick={() => setConfirmation(undefined)}>Cancel</button>
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
                        ?.name ?? "No home area"}
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
                    <small>{status(t).text}</small>
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
              Give to{" "}
              {data.commitments.find((t) => t.id === person)?.name ?? "tech"} ·{" "}
              {dayLabel(assignDay)}
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
          quickMoves={
            <QuickMoves
              job={detail}
              from={detail.schedule?.day ?? focusDay}
              onMove={quickMove}
            />
          }
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

/** One-tap moves shown in the job panel. */
function QuickMoves({
  job,
  from,
  onMove,
}: {
  job: DispatchJob;
  from: string;
  onMove: (moves: Move[]) => void;
}) {
  return (
    <>
      <button onClick={() => onMove([{ job, day: addCalendarDays(from, 1) }])}>
        Push to next day
      </button>
      <button onClick={() => onMove([{ job, day: addCalendarDays(from, 7) }])}>
        Push a week
      </button>
      {job.schedule ? (
        <button onClick={() => onMove([{ job }])}>Take off the plan</button>
      ) : null}
    </>
  );
}
