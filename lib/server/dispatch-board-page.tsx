import "server-only";
import Link from "next/link";
import { DispatchPlan } from "@/components/workspace/dispatch-plan";
import { DispatchBoard } from "@/components/workspace/dispatch-board";
import { dispatchJob } from "@/lib/ops/dispatch-board";
import { calendarDate, civilDate, mondayOf } from "@/lib/ops/dispatch-calendar";
import { addCalendarDays } from "@/lib/ops/internal-schedule-types";
import { OpsDomainError } from "@/lib/ops/errors";
import type { WorkOrderListQuery } from "@/lib/ops/repository";
import { getOpsRequestContext } from "./ops-request-context";
import { internalDispatchScope } from "./internal-dispatch-context";

export const dispatchStatuses = ["approved", "issued", "accepted", "scheduled", "in_progress", "waiting_on_vendor", "waiting_on_parts", "completed_pending_review", "resolved"];
export async function loadDispatchBoard(query: Record<string, string | string[] | undefined>) {
  const context = await getOpsRequestContext(["facilities", "regional", "executive"]);
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
  const view = ["plan", "assign", "week", "day", "list"].includes(first("view")) ? (first("view")==="assign"?"plan":first("view")) : "plan";
  const bucket = ["unassigned", "parts", "late", "reported"].includes(first("bucket")) ? first("bucket") as WorkOrderListQuery["dispatchBucket"] : undefined;
  const filters = { q: first("q").slice(0, 120), person: first("person"), region: first("region"), store: first("store") };
  const base: WorkOrderListQuery = { internalOnly: true, maintenanceTeamOnly: true, statuses: view === "plan" || view === "day" ? dispatchStatuses.filter(status=>status!=="resolved") : dispatchStatuses,
    search: filters.q, internalMembershipId: filters.person || undefined, regionId: filters.region || undefined,
    storeId: filters.store || undefined, dispatchAt: at };
  const selected = { ...base, dispatchBucket: bucket };
  const plannedQuery: WorkOrderListQuery = { ...selected, scheduleView: "week", scheduleFrom: week, scheduleTo: addCalendarDays(week, 6) };
  const [planned, queue, list, dayCounts, choices, stats] = await Promise.all([
    repository.listWorkOrders(scope, { ...plannedQuery, limit: 100, cursor: first("planCursor") || undefined }),
    repository.listWorkOrders(scope, { ...selected, dispatchQueue:true, dispatchReadiness:"ready", excludeHeld:true, dispatchPlanOrder:true, limit: 25, cursor: first("queueCursor") || undefined }),
    view === "list" ? repository.listWorkOrders(scope, { ...selected, limit: 25, cursor: first("cursor") || undefined }) : undefined,
    repository.getDispatchDayCounts(scope, plannedQuery),
    repository.getDispatchFilters(scope),
    Promise.all((["unassigned", "parts", "late", "reported"] as const).map(async name => {
      const page = await repository.listWorkOrders(scope, { ...base, dispatchBoardWeek: view === "list" ? undefined : week, dispatchBucket: name, limit: 1 });
      return [name, page.totalCount ?? 0] as const;
    })),
  ]);
  const commitments = await Promise.all(choices.people.map(async person => {
    const personQuery={...base,internalMembershipId:person.id};
    const [page,next,todayPage,statusUpdate,lastVisit]=await Promise.all([
      repository.listWorkOrders(scope,{...personQuery,scheduleView:"week",scheduleFrom:week,scheduleTo:addCalendarDays(week,6),limit:100,dispatchPlanOrder:true}),
      repository.listWorkOrders(scope,{...personQuery,statuses:dispatchStatuses.filter(status=>!["in_progress","resolved","completed_pending_review"].includes(status)),scheduleDayFrom:today,dispatchReadiness:"ready",excludeHeld:true,dispatchPlanOrder:true,limit:1}),
      view==="day"?repository.listWorkOrders(scope,{...personQuery,scheduleView:"today",scheduleFrom:day,dispatchPlanOrder:true,limit:25}):Promise.resolve(undefined),
      repository.getTechnicianStatus(scope.organizationId,person.id),
      repository.getLatestTechnicianVisit(scope.organizationId,person.id),
    ]);
    const visibleVisit=lastVisit&&(!scope.storeIds||scope.storeIds.includes(lastVisit.storeId))?lastVisit:undefined;
    const visibleStatus=statusUpdate&&(!scope.storeIds||scope.storeIds.includes(statusUpdate.storeId))?statusUpdate:undefined;
    const [current,visitStore,statusStore]=await Promise.all([
      visibleVisit?.status==="active"&&visibleVisit.workOrderId?repository.getWorkOrderDetail(scope,visibleVisit.workOrderId):undefined,
      visibleVisit?repository.getStore(scope.organizationId,visibleVisit.storeId):undefined,
      visibleStatus?repository.getStore(scope.organizationId,visibleStatus.storeId):undefined,
    ]);
    return {person,page,current:current??undefined,next:next.items[0],todayPage,statusUpdate:visibleStatus?{...visibleStatus,storeNumber:statusStore?.storeNumber}:undefined,lastVisit:visibleVisit?{status:visibleVisit.status,checkedInAt:visibleVisit.checkedInAt,checkedOutAt:visibleVisit.checkedOutAt,storeNumber:visitStore?.storeNumber}:undefined};
  }));
  const allRows = [...planned.items, ...queue.items, ...(list?.items ?? []), ...commitments.flatMap(item=>[...item.page.items,...(item.todayPage?.items??[]),...(item.current?[item.current]:[]),...(item.next?[item.next]:[])])];
  const stores = await Promise.all([...new Set(allRows.map(row => row.storeId))].map(id => repository.getStore(scope.organizationId, id)));
  const zones = new Map(stores.filter(store => store !== null).map(store => [store.id, store.timeZone ?? organizationZone]));
  const cleanPage = (page: typeof planned) => ({ ...page, items: page.items.map(row => dispatchJob(row, zones.get(row.storeId), stores.find(store=>store?.id===row.storeId)?.regionId)) });
  return { queueCursor:first("queueCursor"), asOf:at, commitments:commitments.map(item=>({...item.person,...cleanPage(item.page),current:item.current?cleanPage({items:[item.current]}).items[0]:undefined,next:item.next?cleanPage({items:[item.next]}).items[0]:undefined,todayPage:item.todayPage?cleanPage(item.todayPage):undefined,statusUpdate:item.statusUpdate,lastVisit:item.lastVisit})),session,organizationZone,today,week,day,view,bucket,filters,people:choices.people,regions:choices.regions,dayCounts,stats:Object.fromEntries(stats),planned:cleanPage(planned),queue:cleanPage(queue),list:list?cleanPage(list):undefined };
}
export async function renderDispatchBoard(query:Record<string,string|string[]|undefined>) {
  try {const props=await loadDispatchBoard(query);return props.view==="plan"||props.view==="day"?<DispatchPlan key={JSON.stringify([props.week,props.filters,query.queueCursor])} {...props}/>:<DispatchBoard {...props}/>;}
  catch(error){if(!(error instanceof OpsDomainError)||error.code!=="FORBIDDEN")throw error;return <section><h1>Dispatch</h1><p>You don&apos;t have access to Dispatch.</p><Link href="/app/overview">Overview</Link></section>;}
}
