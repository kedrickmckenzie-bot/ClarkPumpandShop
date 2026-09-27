import type { OpsFixture, WorkOrder } from "./types";

export interface VendorServiceReport {
  period:string;
  arrivals:{onTime:number;observed:number;due:number};
  followUps:{work:number;total:number};
  callbacks:{work:number;verified:number};
  cohorts:Array<{key:string;label:string;count:number;withCost:number;medianMinor:number|null;currency:string;href:string}>;
  excludedCostWork:number;
  evidence:Array<{id:string;number:string;problem:string;detail:string;href:string}>;
  evidenceTitle:string; evidenceTotal:number; previous?:string; next?:string;
}
const median = (values:number[]) => { const sorted = [...values].sort((a,b)=>a-b); return sorted.length % 2 ? sorted[Math.floor(sorted.length/2)] : (sorted[sorted.length/2-1]+sorted[sorted.length/2])/2; };

/** Scoped source records; missing arrival evidence is never a late-arrival judgment. */
export function buildVendorServiceReport(fixture:OpsFixture,org:string,vendorId:string,scopedWork:WorkOrder[],query:{report?:string;reportPage?:string}={}):VendorServiceReport {
  const start = new Date(Date.parse(fixture.asOf)-365*86400000).toISOString();
  const work = scopedWork.filter(row=>row.organizationId===org && row.createdAt>=start && row.createdAt<=fixture.asOf && row.status!=="cancelled");
  const ids = new Set(work.map(row=>row.id));
  const assignments = fixture.assignments.filter(row=>row.organizationId===org && ids.has(row.workOrderId));
  const vendorAssignments = assignments.filter(row=>row.vendorId===vendorId);
  const assignedIds = new Set(vendorAssignments.map(row=>row.workOrderId));
  const assignmentIds = new Set(vendorAssignments.map(row=>row.id));
  const assigned = work.filter(row=>assignedIds.has(row.id));
  const visits = fixture.visits.filter(row=>row.organizationId===org && row.vendorId===vendorId && row.checkedInAt<=fixture.asOf);
  const visitIds = new Set(visits.map(row=>row.id));
  const outcomes = fixture.siteVisitWorkOrders.filter(row=>row.organizationId===org && assignedIds.has(row.workOrderId) && visitIds.has(row.visitId));
  const latestAppointments = new Map<string,NonNullable<OpsFixture["serviceAppointments"]>[number]>();
  for (const row of (fixture.serviceAppointments ?? []).filter(row=>row.organizationId===org && assignmentIds.has(row.assignmentId) && row.createdAt<=fixture.asOf).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id))) latestAppointments.set(row.assignmentId,row);
  const due = [...latestAppointments.values()].filter(row=>row.status==="confirmed" && row.startsAt<=fixture.asOf);
  const arrivals = due.map(appointment=>{
    const arrival = visits.filter(visit=>visit.storeId===assigned.find(work=>work.id===appointment.workOrderId)?.storeId && visit.checkedInAt>=appointment.createdAt && visit.checkedInAt>=new Date(Date.parse(appointment.startsAt)-86400000).toISOString() && (visit.workOrderId===appointment.workOrderId || outcomes.some(outcome=>outcome.visitId===visit.id && outcome.workOrderId===appointment.workOrderId))).sort((a,b)=>a.checkedInAt.localeCompare(b.checkedInAt))[0];
    return {appointment,arrival,onTime:arrival ? arrival.checkedInAt<=appointment.startsAt : false};
  });
  const followUpIds = new Set(outcomes.flatMap(row=>row.followUpId ? [row.followUpId] : []));
  const followUpWork = new Set(fixture.followUps.filter(row=>row.organizationId===org && followUpIds.has(row.id)).map(row=>row.workOrderId));
  const outcomeIds = new Set(outcomes.map(row=>row.id));
  const verified = fixture.workOrderVerifications.filter(row=>row.organizationId===org && outcomeIds.has(row.siteVisitWorkOrderId) && row.decidedAt<=fixture.asOf && row.decision!=="inconclusive");
  const callbacks = new Set(verified.filter(row=>row.decision==="rejected" && outcomes.some(outcome=>outcome.workOrderId===row.workOrderId && visits.some(visit=>visit.id===outcome.visitId && visit.checkedInAt>row.decidedAt))).map(row=>row.workOrderId));
  const pmIds = new Set(fixture.pmOccurrences.filter(row=>row.organizationId===org).flatMap(row=>row.workOrderId ? [row.workOrderId] : []));
  const groups = new Map<string,{label:string;work:WorkOrder[];values:number[];currency:string}>();
  const costKeyByWork = new Map<string,string>();
  let excludedCostWork = 0;
  for (const row of assigned) {
    const asset = fixture.assets.find(asset=>asset.organizationId===org && asset.id===row.assetId);
    const component = fixture.components.find(part=>part.organizationId===org && part.id===row.componentId);
    // Whole-work totals cannot be attributed fairly when multiple providers contributed.
    const providers = assignments.filter(assignment=>assignment.workOrderId===row.id);
    const lines = fixture.costLines.filter(line=>line.organizationId===org && line.workOrderId===row.id);
    const currencies = [...new Set(lines.map(line=>line.amount.currency))];
    if (!asset?.model || !asset.manufacturer || !row.categoryKey || providers.some(provider=>provider.vendorId!==vendorId) || currencies.length>1 || !["resolved","closed"].includes(row.status)) {excludedCostWork++;continue;}
    const currency = currencies[0] ?? "USD";
    const label = `${row.categoryKey.replaceAll("_"," ")} · ${asset.manufacturer} ${asset.model} · ${component?.name ?? "Equipment / unspecified part"} · ${pmIds.has(row.id)||row.priority==="planned" ? "Planned" : "Reactive"} · ${row.priority}`;
    const key = JSON.stringify([label.toLowerCase(),currency]);
    const group = groups.get(key) ?? {label,work:[],values:[],currency};
    group.work.push(row); if(lines.length) group.values.push(lines.reduce((sum,line)=>sum+line.amount.amountMinor,0)); groups.set(key,group);costKeyByWork.set(row.id,key);
  }
  const base = `/app/vendors/${encodeURIComponent(vendorId)}`;
  const href = (report:string,page=1)=>`${base}?${new URLSearchParams({report,reportPage:String(page)})}#service-report-evidence`;
  const selection = query.report ?? "arrivals";
  const selected = selection==="arrivals" ? new Set(due.map(row=>row.workOrderId)) : selection==="followups" ? followUpWork : selection==="callbacks" ? callbacks : new Set([...costKeyByWork].filter(([,key])=>`cost:${key}`===selection).map(([id])=>id));
  const rows = assigned.filter(row=>selected.has(row.id)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id));
  const page = Math.max(1,Math.min(Math.max(1,Math.ceil(rows.length/20)),Math.floor(Number(query.reportPage)||1)));
  return {
    period:`Work opened ${start.slice(0,10)}–${fixture.asOf.slice(0,10)}`,
    arrivals:{onTime:arrivals.filter(row=>row.onTime).length,observed:arrivals.filter(row=>row.arrival).length,due:due.length},
    followUps:{work:followUpWork.size,total:assigned.length},callbacks:{work:callbacks.size,verified:new Set(verified.map(row=>row.workOrderId)).size},
    cohorts:[...groups].sort((a,b)=>b[1].work.length-a[1].work.length || a[0].localeCompare(b[0])).map(([key,group])=>({key,label:group.label,count:group.work.length,withCost:group.values.length,medianMinor:group.values.length>=5 ? median(group.values) : null,currency:group.currency,href:href(`cost:${key}`)})),
    excludedCostWork,evidenceTitle:selection==="arrivals" ? "Arrival commitments" : selection==="followups" ? "Work requiring follow-up" : selection==="callbacks" ? "Confirmed callbacks" : "Comparable work costs",evidenceTotal:rows.length,
    evidence:rows.slice((page-1)*20,page*20).map(row=>({id:row.id,number:row.number,problem:row.problem,href:`/app/work-orders/${row.id}?view=${selection.startsWith("cost:") ? "cost" : "visits"}`,detail:selection==="arrivals" ? arrivals.filter(item=>item.appointment.workOrderId===row.id).map(item=>`${item.appointment.startsAt.slice(0,16).replace("T"," ")} UTC · ${!item.arrival ? "Arrival not recorded" : item.onTime ? "Arrived by promised time" : "Arrived after promised time"}`).join("; ") : selection==="callbacks" ? "Rejected completion followed by another recorded vendor visit" : selection==="followups" ? "A visit outcome created a follow-up" : (()=>{const lines=fixture.costLines.filter(line=>line.organizationId===org&&line.workOrderId===row.id);return lines.length ? new Intl.NumberFormat("en-US",{style:"currency",currency:lines[0].amount.currency}).format(lines.reduce((sum,line)=>sum+line.amount.amountMinor,0)/100)+" recorded work cost" : "Cost not recorded";})()})),
    previous:page>1 ? href(selection,page-1) : undefined,next:page*20<rows.length ? href(selection,page+1) : undefined,
  };
}
