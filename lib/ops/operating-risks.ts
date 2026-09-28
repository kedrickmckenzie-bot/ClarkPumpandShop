import type {OpsFixture} from "./types";
import type {OrganizationScope} from "./repository";
import type {OpsSqlDriver} from "./sql-driver";
import {scopeWhere} from "./sql-scope";
export interface OperatingRisk {id:string;storeId:string;storeNumber:string;state:string;reportedAt:string;}
export function operatingRisksFromFixture(f:OpsFixture,scope:OrganizationScope):OperatingRisk[]{
 const stores=f.stores.filter(s=>s.organizationId===scope.organizationId&&(scope.storeIds===undefined||scope.storeIds.includes(s.id))&&(scope.regionIds===undefined||scope.regionIds.includes(s.regionId??"")));
 return f.requests.filter(r=>r.organizationId===scope.organizationId&&stores.some(s=>s.id===r.storeId)&&["submitted","under_review"].includes(r.status)).flatMap(r=>{
 const a=f.requestImpactAssessments.filter(a=>a.organizationId===scope.organizationId&&a.requestId===r.id).sort((a,b)=>b.assessedAt.localeCompare(a.assessedAt)||b.id.localeCompare(a.id))[0];
 return a&&["unable_to_operate","partially_operational"].includes(a.storeOperatingState)?[{id:r.id,storeId:r.storeId,storeNumber:stores.find(s=>s.id===r.storeId)!.storeNumber,state:a.storeOperatingState,reportedAt:a.assessedAt}]:[];
 }).sort((a,b)=>Number(b.state==="unable_to_operate")-Number(a.state==="unable_to_operate")||b.reportedAt.localeCompare(a.reportedAt)||a.id.localeCompare(b.id)).slice(0,5);
}
export async function queryOperatingRisks(driver:OpsSqlDriver,scope:OrganizationScope):Promise<OperatingRisk[]>{
 const params:unknown[]=[];const where=scopeWhere(scope,"s",params);
 const result=await driver.query({sql:`SELECT r.id,s.id AS store_id,s.store_number,a.store_operating_state,a.assessed_at FROM ops_requests r JOIN ops_stores s ON s.organization_id=r.organization_id AND s.id=r.store_id JOIN ops_request_impact_assessments a ON a.organization_id=r.organization_id AND a.request_id=r.id AND a.id=(SELECT a2.id FROM ops_request_impact_assessments a2 WHERE a2.organization_id=r.organization_id AND a2.request_id=r.id ORDER BY a2.assessed_at DESC,a2.id DESC LIMIT 1) WHERE ${where} AND r.status IN ('submitted','under_review') AND a.store_operating_state IN ('unable_to_operate','partially_operational') ORDER BY CASE WHEN a.store_operating_state='unable_to_operate' THEN 0 ELSE 1 END,a.assessed_at DESC,r.id LIMIT 5`,params});
 return result.rows.map(r=>({id:String(r.id),storeId:String(r.store_id),storeNumber:String(r.store_number),state:String(r.store_operating_state),reportedAt:new Date(String(r.assessed_at)).toISOString()}));
}
