import "server-only";
import Link from "next/link";
import { OpsDomainError } from "@/lib/ops/errors";
import { InternalPlanningWorkspace } from "@/components/workspace/internal-planning-workspace";
import { getOpsRequestContext } from "./ops-request-context";
import { internalDispatchScope } from "./internal-dispatch-context";
import type { WorkOrderListQuery } from "@/lib/ops/repository";
import { calendarDate, civilDate, mondayOf } from "@/lib/ops/dispatch-calendar";
import { addCalendarDays } from "@/lib/ops/internal-schedule-types";

type Query = Record<string, string | string[] | undefined>;

const openStatuses: NonNullable<WorkOrderListQuery["statuses"]> = ["approved", "issued", "accepted", "scheduled", "in_progress", "waiting_on_vendor", "waiting_on_parts"];

/** Manager Dispatch board (technician = false) and the technician's My work page. */
export async function renderInternalDispatch(query: Query, technician: boolean) {
  let context;
  try {
    context = await getOpsRequestContext(technician ? ["technician"] : ["facilities", "regional", "executive"]);
  } catch (error) {
    if (!(error instanceof OpsDomainError) || error.code !== "FORBIDDEN") throw error;
    return <section>
      <h1>{technician ? "My work" : "Dispatch"}</h1>
      <p>Your current role cannot open this page.</p>
      <Link href="/app/overview">Go to overview</Link>
    </section>;
  }
  const first = (key: string) => Array.isArray(query[key]) ? query[key][0] : query[key];
  const views = technician ? ["today", "upcoming", "mine", "pool"] : ["all", "pool", "person", "awaiting_allocation"];
  const requested = first("view") ?? views[0];
  const view = views.includes(requested) ? requested : views[0];
  const search = (first("q") ?? "").slice(0, 120);
  const scope = await internalDispatchScope(context.repository, context.session);
  const org = await context.repository.getOrganization(scope.organizationId);
  const zone = org!.timeZone;
  const referenceAt = new Date().toISOString();
  const today = civilDate(referenceAt, zone);
  let week = mondayOf(today);
  try {
    if (first("week")) week = mondayOf(calendarDate(first("week")!));
  } catch { /* An invalid week keeps the current week and access scope. */ }
  const readiness = ["ready", "waiting", "next_visit"].includes(first("readiness") ?? "") ? first("readiness")! : "all";
  const person = first("person");
  const region = first("region");

  const filter: WorkOrderListQuery = { limit: 25, internalOnly: true, search, storeId: first("store"), regionId: region, statuses: openStatuses };
  if (technician && view !== "pool") filter.internalMembershipId = context.session.membershipId ?? "__none__";
  else if (view !== "all") filter.internalTarget = view as WorkOrderListQuery["internalTarget"];
  if (!technician && person) filter.internalMembershipId = person;
  if (!technician) filter.maintenanceTeamOnly = true;
  if (readiness === "next_visit") filter.heldOnly = true;
  if (readiness === "ready") { filter.dispatchReadiness = "ready"; filter.excludeHeld = true; }
  if (readiness === "waiting") filter.dispatchReadiness = "waiting";
  if (technician && view === "pool") filter.statuses = ["approved", "issued", "accepted", "scheduled"];

  const base = technician ? "/app/my-work" : "/app/dispatch";
  const selected = new URLSearchParams({ view, q: search, week, readiness, ...(person ? { person } : {}), ...(region ? { region } : {}), ...(filter.storeId ? { store: filter.storeId } : {}) });
  const link = (key: string, cursor?: string) => {
    if (!cursor) return;
    const next = new URLSearchParams(selected);
    next.set(key, cursor);
    return `${base}?${next}`;
  };
  const list = (extra: WorkOrderListQuery) => context.repository.listWorkOrders(scope, { ...filter, ...extra });

  const [page, heldPage, planned, replan, review, unscheduled, filters] = await Promise.all([
    // Manager: work with no date yet. Technician: their jobs or jobs they can take.
    list({
      cursor: first("cursor"),
      ...(!technician ? { scheduleView: "backlog" as const } : { statuses: view === "mine" ? [...filter.statuses!, "completed_pending_review", "resolved"] : filter.statuses }),
      excludeHeld: technician || filter.excludeHeld,
    }),
    technician && ["mine", "pool"].includes(view) && readiness !== "ready" ? list({ cursor: first("heldCursor"), heldOnly: true }) : undefined,
    !technician || ["today", "upcoming"].includes(view)
      ? list({
        cursor: first("planCursor"),
        scheduleView: technician ? view as "today" | "upcoming" : "week",
        scheduleFrom: technician ? today : week,
        scheduleTo: addCalendarDays(week, 6),
        ...(technician ? { scheduleAt: referenceAt } : {}),
      })
      : undefined,
    !technician || view === "today"
      ? list({ cursor: first("replanCursor"), scheduleView: "replan", scheduleFrom: today, scheduleAt: referenceAt, ...(!technician ? { scheduleExcludeWeek: week } : {}) })
      : undefined,
    !technician && readiness === "all" ? list({ cursor: first("reviewCursor"), statuses: ["completed_pending_review", "resolved"] }) : undefined,
    // A technician's Today also lists their jobs without a date, most urgent first, so it is never empty by mistake.
    technician && view === "today" ? list({ cursor: first("unscheduledCursor"), scheduleView: "backlog", excludeHeld: true }) : undefined,
    technician ? { people: [], regions: [] } : context.repository.getDispatchFilters(scope),
  ]);

  const saved = first("saved") ? { number: first("saved")!.slice(0, 40), when: (first("savedWhen") ?? "").slice(0, 80) } : undefined;
  return <InternalPlanningWorkspace session={context.session} technician={technician} view={view} search={search} week={week} today={today}
    readiness={readiness} person={person} region={region} storeId={filter.storeId} saved={saved}
    page={page} heldPage={heldPage} planned={planned} replan={replan} review={review} unscheduled={unscheduled} filters={filters}
    links={{
      review: link("reviewCursor", review?.nextCursor),
      backlog: link("cursor", page.nextCursor),
      held: link("heldCursor", heldPage?.nextCursor),
      planned: link("planCursor", planned?.nextCursor),
      replan: link("replanCursor", replan?.nextCursor),
      unscheduled: link("unscheduledCursor", unscheduled?.nextCursor),
    }}/>;
}
