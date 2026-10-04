import "server-only";
import Link from "next/link";
import { DispatchBoard } from "@/components/workspace/dispatch-board";
import { dispatchJob } from "@/lib/ops/dispatch-board";
import { calendarDate, civilDate, mondayOf } from "@/lib/ops/dispatch-calendar";
import { addCalendarDays } from "@/lib/ops/internal-schedule-types";
import { OpsDomainError } from "@/lib/ops/errors";
import type { WorkOrderListQuery } from "@/lib/ops/repository";
import { getOpsRequestContext } from "./ops-request-context";
import { internalDispatchScope } from "./internal-dispatch-context";

export const dispatchStatuses = ["approved", "issued", "accepted", "scheduled", "in_progress", "waiting_on_vendor", "waiting_on_parts", "completed_pending_review", "resolved"];
export async function renderDispatchBoard(query: Record<string, string | string[] | undefined>) {
  let context;
  try { context = await getOpsRequestContext(["facilities", "regional", "executive"]); }
  catch (error) {
    if (!(error instanceof OpsDomainError) || error.code !== "FORBIDDEN") throw error;
    return <section><h1>Dispatch</h1><p>You don&apos;t have access to Dispatch.</p><Link href="/app/overview">← Overview</Link></section>;
  }
  const first = (key: string) => (Array.isArray(query[key]) ? query[key][0] : query[key]) ?? "";
  const { repository, session } = context;
  const scope = await internalDispatchScope(repository, session);
  const organization = await repository.getOrganization(scope.organizationId);
  const organizationZone = organization!.timeZone;
  const at = new Date().toISOString();
  const today = civilDate(at, organizationZone);
  let week = mondayOf(today), day = today;
  try { if (first("week")) week = mondayOf(calendarDate(first("week"))); } catch { /* Keep a safe default. */ }
  try { if (first("day")) day = calendarDate(first("day")); } catch { /* Keep a safe default. */ }
  if (day < week || day > addCalendarDays(week, 6)) day = week;
  const view = ["week", "day", "list"].includes(first("view")) ? first("view") : "week";
  const bucket = ["unassigned", "parts", "late", "reported"].includes(first("bucket")) ? first("bucket") as WorkOrderListQuery["dispatchBucket"] : undefined;
  const filters = { q: first("q").slice(0, 120), person: first("person"), region: first("region"), store: first("store") };
  const base: WorkOrderListQuery = { internalOnly: true, maintenanceTeamOnly: true, statuses: dispatchStatuses,
    search: filters.q, internalMembershipId: filters.person || undefined, regionId: filters.region || undefined,
    storeId: filters.store || undefined, dispatchAt: at };
  const selected = { ...base, dispatchBucket: bucket };
  const plannedQuery: WorkOrderListQuery = { ...selected, scheduleView: "week", scheduleFrom: week, scheduleTo: addCalendarDays(week, 6) };
  const [planned, queue, list, dayCounts, choices, stats] = await Promise.all([
    repository.listWorkOrders(scope, { ...plannedQuery, limit: 100, cursor: first("planCursor") || undefined }),
    repository.listWorkOrders(scope, { ...selected, dispatchQueue: true, limit: 25, cursor: first("queueCursor") || undefined }),
    view === "list" ? repository.listWorkOrders(scope, { ...selected, limit: 25, cursor: first("cursor") || undefined }) : undefined,
    repository.getDispatchDayCounts(scope, plannedQuery),
    repository.getDispatchFilters(scope),
    Promise.all((["unassigned", "parts", "late", "reported"] as const).map(async name => {
      const page = await repository.listWorkOrders(scope, { ...base, dispatchBoardWeek: view === "list" ? undefined : week, dispatchBucket: name, limit: 1 });
      return [name, page.totalCount ?? 0] as const;
    })),
  ]);
  const allRows = [...planned.items, ...queue.items, ...(list?.items ?? [])];
  const stores = await Promise.all([...new Set(allRows.map(row => row.storeId))].map(id => repository.getStore(scope.organizationId, id)));
  const zones = new Map(stores.filter(store => store !== null).map(store => [store.id, store.timeZone ?? organizationZone]));
  const cleanPage = (page: typeof planned) => ({ ...page, items: page.items.map(row => dispatchJob(row, zones.get(row.storeId))) });
  return <DispatchBoard session={session} organizationZone={organizationZone} today={today} week={week} day={day} view={view}
    bucket={bucket} filters={filters} people={choices.people} regions={choices.regions} dayCounts={dayCounts}
    stats={Object.fromEntries(stats)} planned={cleanPage(planned)} queue={cleanPage(queue)} list={list ? cleanPage(list) : undefined}
    initialSaved={first("saved") ? `Saved. ${first("saved").slice(0, 40)}${first("savedWhen") ? ` is set for ${first("savedWhen").slice(0, 80)}.` : " was updated."}` : undefined}/>;
}
