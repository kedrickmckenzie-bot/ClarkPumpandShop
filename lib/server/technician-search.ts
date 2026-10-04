import "server-only";
import { getOpsRequestContext } from "./ops-request-context";
import { internalDispatchScope } from "./internal-dispatch-context";
export async function technicianSearch(query:string,request?:Request) {
  const {repository,session}=await getOpsRequestContext(["technician"],undefined,request),scope=await internalDispatchScope(repository,session),q=query.trim().slice(0,160);
  if(!q)return {groups:[]};
  const [stores,equipment,jobs]=await Promise.all([repository.searchStores(scope,q,{limit:25}),repository.searchAssets(scope,q,{limit:25}),repository.listWorkOrders(scope,{search:q,limit:25,activityOrder:true})]);
  return {groups:[
    {id:"stores",label:"Stores",nextCursor:stores.nextCursor,rows:stores.items.map(store=>({id:store.id,href:`/app/stores/${encodeURIComponent(store.id)}`,label:`Store ${store.storeNumber} · ${store.name}`,detail:store.formattedAddress}))},
    {id:"equipment",label:"Equipment",nextCursor:equipment.nextCursor,rows:equipment.items.map(asset=>({id:asset.id,href:`/app/equipment/${encodeURIComponent(asset.id)}`,label:asset.name,detail:`${asset.assetTag} · Store ${asset.storeNumber}`}))},
    {id:"work",label:"Work",nextCursor:jobs.nextCursor,rows:jobs.items.map(job=>({id:job.id,href:`/app/work-orders/${encodeURIComponent(job.id)}`,label:job.problem,detail:`Store ${job.storeNumber} · ${job.number}`}))},
  ]};
}
