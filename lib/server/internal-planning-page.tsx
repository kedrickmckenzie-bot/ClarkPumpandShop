import "server-only";
import Link from "next/link";
import { OpsDomainError } from "@/lib/ops/errors";
import { InternalPlanningWorkspace } from "@/components/workspace/internal-planning-workspace";
import { getOpsRequestContext } from "./ops-request-context";
import { internalDispatchScope } from "./internal-dispatch-context";
import type { WorkOrderListQuery } from "@/lib/ops/repository";
import { calendarDate, civilDate, mondayOf } from "@/lib/ops/dispatch-calendar";
import { addCalendarDays } from "@/lib/ops/internal-schedule-types";

export async function renderInternalDispatch(query:Record<string,string|string[]|undefined>,technician:boolean) {
  let context;
  try {context=await getOpsRequestContext(technician?["technician"]:["facilities","regional","executive"]);}
  catch(error){if(!(error instanceof OpsDomainError)||error.code!=="FORBIDDEN")throw error;return <section><h1>{technician?"My work":"Dispatch"}</h1><p>Your current role cannot open this view.</p><Link href="/app/overview">Return to overview</Link></section>;}
  const first=(key:string)=>Array.isArray(query[key])?query[key][0]:query[key];
  const views=technician?["today","upcoming","mine","pool"]:["all","pool","person","awaiting_allocation"],requested=first("view")??views[0],view=views.includes(requested)?requested:views[0];
  const search=(first("q")??"").slice(0,120),scope=await internalDispatchScope(context.repository,context.session),org=await context.repository.getOrganization(scope.organizationId),zone=org!.timeZone,referenceAt=new Date().toISOString(),today=civilDate(referenceAt,zone);
  let week=mondayOf(today);try{if(first("week"))week=mondayOf(calendarDate(first("week")!));}catch{ /* Invalid calendar filters retain the current week and access scope. */ }
  const readiness=["ready","waiting","next_visit"].includes(first("readiness")??"")?first("readiness")!:"all",person=first("person"),region=first("region");
  const filter:WorkOrderListQuery={limit:25,internalOnly:true,search,storeId:first("store"),regionId:region,statuses:["approved","issued","accepted","scheduled","in_progress","waiting_on_vendor","waiting_on_parts"]};
  if(technician&&view!=="pool")filter.internalMembershipId=context.session.membershipId??"__none__";
  else if(view!=="all")filter.internalTarget=view as WorkOrderListQuery["internalTarget"];
  if(!technician&&person)filter.internalMembershipId=person;
  if(readiness==="next_visit")filter.heldOnly=true;
  if(readiness==="ready"){filter.dispatchReadiness="ready";filter.excludeHeld=true;}
  if(readiness==="waiting")filter.dispatchReadiness="waiting";
  if(technician&&view==="pool")filter.statuses=["approved","issued","accepted","scheduled"];
  const base=technician?"/app/my-work":"/app/dispatch",selected=new URLSearchParams({view,q:search,week,readiness,...(person?{person}:{}),...(region?{region}:{}),...(filter.storeId?{store:filter.storeId}:{})});
  const link=(key:string,cursor?:string)=>{if(!cursor)return;const q=new URLSearchParams(selected);q.set(key,cursor);return base+"?"+q;};
  const [page,heldPage,planned,replan,review,filters]=await Promise.all([
    context.repository.listWorkOrders(scope,{...filter,cursor:first("cursor"),...(!technician?{scheduleView:"backlog" as const}:{statuses:view==="mine"?[...filter.statuses!,"completed_pending_review","resolved"]:filter.statuses}),excludeHeld:technician||filter.excludeHeld}),
    technician&&["mine","pool"].includes(view)&&readiness!=="ready"?context.repository.listWorkOrders(scope,{...filter,cursor:first("heldCursor"),heldOnly:true}):undefined,
    !technician||["today","upcoming"].includes(view)?context.repository.listWorkOrders(scope,{...filter,cursor:first("planCursor"),scheduleView:technician?view as "today"|"upcoming":"week",scheduleFrom:technician?today:week,scheduleTo:addCalendarDays(week,6),...(technician?{scheduleAt:referenceAt}:{})}):undefined,
    !technician||view==="today"?context.repository.listWorkOrders(scope,{...filter,cursor:first("replanCursor"),scheduleView:"replan",scheduleFrom:today,scheduleAt:referenceAt,...(!technician?{scheduleExcludeWeek:week}:{})}):undefined,
    !technician&&readiness==="all"?context.repository.listWorkOrders(scope,{...filter,cursor:first("reviewCursor"),statuses:["completed_pending_review","resolved"]}):undefined,
    technician?{people:[],regions:[]}:context.repository.getDispatchFilters(scope)
  ]);
  return <InternalPlanningWorkspace session={context.session} technician={technician} view={view} search={search} week={week} zone={zone} referenceAt={referenceAt} readiness={readiness} person={person} region={region} storeId={filter.storeId} page={page} heldPage={heldPage} planned={planned} replan={replan} review={review} filters={filters} links={{review:link("reviewCursor",review?.nextCursor),backlog:link("cursor",page.nextCursor),held:link("heldCursor",heldPage?.nextCursor),planned:link("planCursor",planned?.nextCursor),replan:link("replanCursor",replan?.nextCursor)}}/>;
}
