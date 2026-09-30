import type { OpsFixture, Page, PageRequest } from "./types";
import type { OrganizationScope } from "./repository";
import type { OpsSqlDriver } from "./sql-driver";
import { scopeWhere } from "./sql-scope";
import { dashboardPageBounds } from "./dashboard-query";

export interface UpcomingAppointmentQuery extends PageRequest { now: string; storeId?: string; vendorId?: string; search?: string }
export interface UpcomingAppointmentRow { id: string; workOrderId: string; workOrderNumber: string; problem: string; storeId: string; storeNumber: string; storeName: string; timeZone: string; vendorName: string; startsAt: string }
export function upcomingAppointmentsFromFixture(f: OpsFixture, scope: OrganizationScope, q: UpcomingAppointmentQuery): Page<UpcomingAppointmentRow> {
 const {limit,offset}=dashboardPageBounds(q), search=q.search?.trim().toLowerCase();
 const items=(f.serviceAppointments??[]).filter(a=>a.organizationId===scope.organizationId && a.status==='confirmed' && a.startsAt>=q.now).flatMap(a=>{
  const w=f.workOrders.find(w=>w.organizationId===scope.organizationId && w.id===a.workOrderId),s=f.stores.find(s=>s.organizationId===scope.organizationId && s.id===w?.storeId);
  if(!w||!s||(scope.storeIds!==undefined&&!scope.storeIds.includes(s.id))||(scope.regionIds!==undefined&&!scope.regionIds.includes(s.regionId??''))||(q.storeId&&q.storeId!==s.id))return [];
  const assignment=f.assignments.find(t=>t.organizationId===scope.organizationId&&t.id===a.assignmentId&&t.workOrderId===w.id);
  if(q.vendorId&&assignment?.vendorId!==q.vendorId)return [];
  const v=f.vendors.find(v=>v.organizationId===scope.organizationId&&v.id===assignment?.vendorId);
  if(search&&![w.number,w.problem,s.storeNumber,s.name,s.address1,s.city,s.state,s.postalCode,v?.name,a.note].join(' ').toLowerCase().includes(search))return [];
  return [{id:a.id,workOrderId:w.id,workOrderNumber:w.number,problem:w.problem,storeId:s.id,storeNumber:s.storeNumber,storeName:s.name,timeZone:s.timeZone??"America/New_York",vendorName:v?.name??'Vendor not recorded',startsAt:a.startsAt}];
 }).sort((a,b)=>a.startsAt.localeCompare(b.startsAt)||a.id.localeCompare(b.id));
 return {items:items.slice(offset,offset+limit),totalCount:items.length};
}
export async function queryUpcomingAppointments(driver: OpsSqlDriver,scope: OrganizationScope,q: UpcomingAppointmentQuery): Promise<Page<UpcomingAppointmentRow>> {
 const {limit,offset}=dashboardPageBounds(q),params:unknown[]=[];
 let where=scopeWhere(scope,'s',params)+" AND a.status='confirmed' AND a.starts_at >= ?";params.push(q.now);
 if(q.storeId){where+=' AND s.id=?';params.push(q.storeId);}
 if(q.vendorId){where+=' AND t.vendor_id=?';params.push(q.vendorId);}
 if(q.search?.trim()){where+=" AND LOWER(w.number || ' ' || w.problem || ' ' || s.store_number || ' ' || s.name || ' ' || s.address_1 || ' ' || s.city || ' ' || s.state || ' ' || s.postal_code || ' ' || COALESCE(v.name,'') || ' ' || COALESCE(a.note,'')) LIKE ? ESCAPE '\\'";params.push('%'+q.search.trim().toLowerCase().replace(/[\\%_]/g,'\\$&')+'%');}
 const from=`FROM ops_service_appointments a JOIN ops_work_orders w ON w.organization_id=a.organization_id AND w.id=a.work_order_id JOIN ops_stores s ON s.organization_id=w.organization_id AND s.id=w.store_id LEFT JOIN ops_work_order_assignments t ON t.organization_id=a.organization_id AND t.id=a.assignment_id AND t.work_order_id=w.id LEFT JOIN ops_vendors v ON v.organization_id=t.organization_id AND v.id=t.vendor_id WHERE ${where}`;
 const [count,rows]=await Promise.all([driver.query({sql:`SELECT COUNT(*) AS total ${from}`,params}),driver.query({sql:`SELECT a.id,a.starts_at,w.id AS work_order_id,w.number,w.problem,s.id AS store_id,s.store_number,s.name AS store_name,s.time_zone,v.name AS vendor_name ${from} ORDER BY a.starts_at,a.id LIMIT ? OFFSET ?`,params:[...params,limit,offset]})]);
 return {totalCount:Number(count.rows[0]?.total??0),items:rows.rows.map(r=>({id:String(r.id),workOrderId:String(r.work_order_id),workOrderNumber:String(r.number),problem:String(r.problem),storeId:String(r.store_id),storeNumber:String(r.store_number),storeName:String(r.store_name),timeZone:String(r.time_zone??"America/New_York"),vendorName:r.vendor_name?String(r.vendor_name):'Vendor not recorded',startsAt:new Date(String(r.starts_at)).toISOString()}))};
}
