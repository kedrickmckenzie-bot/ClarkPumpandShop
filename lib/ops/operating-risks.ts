import {dashboardPageBounds} from "./dashboard-query";
import type {OpsFixture,PageRequest} from "./types";
import type {OrganizationScope} from "./repository";
import type {OpsSqlDriver} from "./sql-driver";
import {scopeWhere} from "./sql-scope";
export interface OperatingRiskQuery extends PageRequest {view?: "review" | "unresolved";}
export interface OperatingRisk {id:string;workOrderId?:string;storeId:string;storeNumber:string;state:string;reportedAt:string;problem:string;}
export interface OperatingRiskPage {items:OperatingRisk[];totalCount:number;}
export function operatingRisksFromFixture(f:OpsFixture,scope:OrganizationScope,page:OperatingRiskQuery={limit:3}):OperatingRiskPage{
 const {limit,offset}=dashboardPageBounds(page);
 const stores=f.stores.filter(s=>s.organizationId===scope.organizationId&&(scope.storeIds===undefined||scope.storeIds.includes(s.id))&&(scope.regionIds===undefined||scope.regionIds.includes(s.regionId??"")));
 const rows=f.requests.filter(r=>r.organizationId===scope.organizationId&&stores.some(s=>s.id===r.storeId)&&(page.view === "unresolved" ? r.status !== "closed" : ["submitted","under_review"].includes(r.status) && !r.linkedWorkOrderId && !r.convertedWorkOrderId)).flatMap(r=>{
 const work=f.workOrders.find(w=>w.organizationId===scope.organizationId && w.storeId===r.storeId && w.id===(r.linkedWorkOrderId??r.convertedWorkOrderId));
 if(page.view === "unresolved" && work && ["resolved","closed"].includes(work.status))return [];
 const a=f.requestImpactAssessments.filter(a=>a.organizationId===scope.organizationId&&a.requestId===r.id).sort((a,b)=>b.assessedAt.localeCompare(a.assessedAt)||b.id.localeCompare(a.id))[0];
 return a&&["unable_to_operate","partially_operational"].includes(a.storeOperatingState)?[{id:r.id,workOrderId:work?.id,storeId:r.storeId,storeNumber:stores.find(s=>s.id===r.storeId)!.storeNumber,state:a.storeOperatingState,reportedAt:a.assessedAt,problem:r.problem}]:[];
 }).sort((a,b)=>Number(b.state==="unable_to_operate")-Number(a.state==="unable_to_operate")||b.reportedAt.localeCompare(a.reportedAt)||a.id.localeCompare(b.id));
 return {items:rows.slice(offset,offset+limit),totalCount:rows.length};
}
export async function queryOperatingRisks(driver:OpsSqlDriver,scope:OrganizationScope,page:OperatingRiskQuery={limit:3}):Promise<OperatingRiskPage>{
 const {limit,offset}=dashboardPageBounds(page);
 const params:unknown[]=[];const where=scopeWhere(scope,"s",params);
 const result=await driver.query({sql:`WITH matching AS (SELECT r.id,r.problem,w.id AS work_order_id,s.id AS store_id,s.store_number,a.store_operating_state,a.assessed_at FROM ops_requests r JOIN ops_stores s ON s.organization_id=r.organization_id AND s.id=r.store_id LEFT JOIN ops_work_orders w ON w.organization_id=r.organization_id AND w.store_id=r.store_id AND w.id=COALESCE(r.linked_work_order_id,r.converted_work_order_id) JOIN ops_request_impact_assessments a ON a.organization_id=r.organization_id AND a.request_id=r.id AND a.id=(SELECT a2.id FROM ops_request_impact_assessments a2 WHERE a2.organization_id=r.organization_id AND a2.request_id=r.id ORDER BY a2.assessed_at DESC,a2.id DESC LIMIT 1) WHERE ${where} AND ${page.view === "unresolved" ? "r.status <> 'closed' AND (w.id IS NULL OR w.status NOT IN ('resolved','closed'))" : "r.status IN ('submitted','under_review') AND r.linked_work_order_id IS NULL AND r.converted_work_order_id IS NULL"} AND a.store_operating_state IN ('unable_to_operate','partially_operational')) , total AS (SELECT COUNT(*) AS total_count FROM matching), visible AS (SELECT * FROM matching ORDER BY CASE WHEN store_operating_state='unable_to_operate' THEN 0 ELSE 1 END,assessed_at DESC,id LIMIT ? OFFSET ?) SELECT visible.*,total.total_count FROM total LEFT JOIN visible ON 1=1 ORDER BY CASE WHEN store_operating_state='unable_to_operate' THEN 0 ELSE 1 END,assessed_at DESC,id`,params:[...params,limit,offset]});
 return {totalCount:Number(result.rows[0]?.total_count ?? 0),items:result.rows.filter(r=>r.id!=null).map(r=>({id:String(r.id),workOrderId:r.work_order_id == null ? undefined : String(r.work_order_id),storeId:String(r.store_id),storeNumber:String(r.store_number),problem:String(r.problem),state:String(r.store_operating_state),reportedAt:new Date(String(r.assessed_at)).toISOString()}))};
}
