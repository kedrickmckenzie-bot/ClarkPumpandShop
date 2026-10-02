import {OpsDomainError,type OpsCommandServices} from "./commands";
import {communicationAudit,insertRecord} from "./email-intake";
import {resolveAssetReplacementEstimate} from "./replacement-intelligence";
import type {OrganizationScope,OpsRepository} from "./repository";
import type {ActorContext,OpsFixture} from "./types";

export interface CapitalPlan {id:string;organizationId:string;assetId:string;storeId:string;version:number;targetMonth?:string;amountMinor?:number;currency:string;costBasis:string;sourceId?:string;priority:"flexible"|"soon"|"urgent";owner:string;reason:string;status:"considering"|"planned"|"approved"|"completed"|"cancelled";createdAt:string;}
export interface CapitalPrice {id:string;amountMinor:number;currency:string;basis:string;label:string;href?:string;}
export interface CapitalRow extends CapitalPlan {assetName:string;assetTag:string;storeNumber:string;storeName:string;category:string;legacyYear?:number;}
export interface CapitalQuery {start:string;months:number;currency:string;storeId?:string;regionId?:string;category?:string;search?:string;month?:string;offset?:number;}
export interface CapitalBucket {month:string;count:number;amountMinor:number;missing:number;}
export interface CapitalPage {items:CapitalRow[];total:number;buckets:CapitalBucket[];currencies:string[];}
export function validMonth(value:string) {return /^(20\d{2}|21\d{2}|2200)-(0[1-9]|1[0-2])$/.test(value);}
export function validTarget(value:string) {return validMonth(value)||/^(20\d{2}|21\d{2}|2200)$/.test(value);}
export function monthAfter(value:string,delta:number) {const [year,month]=value.split("-").map(Number);return new Date(Date.UTC(year,month-1+delta,1)).toISOString().slice(0,7);}
export function validateCapitalQuery(q:CapitalQuery) {if(!validMonth(q.start)||![3,6,12,24].includes(q.months)||!/^[A-Z]{3}$/.test(q.currency)||q.month&&!validTarget(q.month)&&!["undated","overdue"].includes(q.month))throw new OpsDomainError("VALIDATION","Choose a valid planning period.");}
export function capitalPlanFrom(row:Record<string,unknown>):CapitalPlan {
  return {id:String(row.id),organizationId:String(row.organization_id),assetId:String(row.asset_id),storeId:String(row.store_id),version:Number(row.version),targetMonth:row.target_month?String(row.target_month):undefined,amountMinor:row.amount_minor==null?undefined:Number(row.amount_minor),currency:String(row.currency),costBasis:String(row.cost_basis),sourceId:row.source_id?String(row.source_id):undefined,priority:String(row.priority) as CapitalPlan["priority"],owner:String(row.owner),reason:String(row.reason),status:String(row.status) as CapitalPlan["status"],createdAt:String(row.created_at)};
}
export function latestCapitalPlan(f:OpsFixture,org:string,assetId:string) {return (f.capitalPlans??[]).filter(p=>p.organizationId===org&&p.assetId===assetId).sort((a,b)=>b.version-a.version)[0]??null;}
export function capitalPricesFromFixture(f:OpsFixture,org:string,assetId:string):CapitalPrice[] {
  const workIds=new Set(f.workOrders.filter(w=>w.organizationId===org&&w.assetId===assetId).map(w=>w.id));
  const result:CapitalPrice[]=f.replacementEvents.filter(e=>e.organizationId===org&&e.assetId===assetId&&e.status==="approved").map(e=>({id:e.id,...e.approvedAmount,basis:"Approved amount",label:"Approved replacement",href:`/app/work-orders/${e.workOrderId}?view=service`}));
  for(const request of f.estimateRequests.filter(r=>r.organizationId===org&&workIds.has(r.workOrderId)&&r.decisionKind==="replacement_quote"&&r.status==="selected")) {
    const quote=f.estimateProposals.filter(p=>p.organizationId===org&&p.requestId===request.id&&p.vendorId===request.vendorId).sort((a,b)=>b.revision-a.revision)[0];
    if(quote)result.push({id:quote.id,...quote.amount,basis:"Selected quote",label:"Selected replacement quote",href:`/app/work-orders/${request.workOrderId}?view=service&path=bids`});
  }
  result.push(...(f.workPrices??[]).filter(p=>p.organizationId===org&&p.assetId===assetId&&p.kind==="replace"&&p.scopeKind==="whole").map(p=>({id:p.id,...p.amount,basis:"Reported price",label:"Reported whole-unit replacement",href:`/app/work-orders/${p.workOrderId}/prices`})));
  return result;
}
export async function capitalPriceChoices(r:OpsRepository,org:string,assetId:string):Promise<CapitalPrice[]> {
  const asset=await r.getAsset(org,assetId);if(!asset)return [];
  const [prices,profile,benchmark,override]=await Promise.all([r.getCapitalPrices(org,assetId),asset.replacementProfileId?r.getReplacementProfile(org,asset.replacementProfileId):null,asset.replacementProfileId?r.getPublishedReplacementBenchmark(org,asset.replacementProfileId):null,r.getActiveAssetReplacementOverride(org,assetId)]);
  const planning=resolveAssetReplacementEstimate({replacementProfiles:profile?[profile]:[],replacementBenchmarks:benchmark?[benchmark]:[],assetReplacementOverrides:override?[override]:[]},asset,new Date().toISOString()).amount;
  return [...prices,...(planning?[{id:"asset-estimate",...planning,basis:"Planning estimate",label:"Saved equipment estimate"}]:[])];
}
export async function saveCapitalPlan(svc:OpsCommandServices,input:{organizationId:string;assetId:string;version:number;targetMonth?:string;amountMinor?:number;currency:string;sourceId?:string;priority:CapitalPlan["priority"];owner:string;reason:string;status:CapitalPlan["status"];actor:ActorContext}) {
  const r=svc.repository,org=input.organizationId;
  if(input.actor.organizationId!==org)throw new OpsDomainError("FORBIDDEN","Organization access required.");
  const membership=input.actor.actorId?await r.getMembership(org,input.actor.actorId):null;
  if(!membership||membership.status!=="active"||!["facilities_admin","regional_manager", "field_manager"].includes(membership.role))throw new OpsDomainError("FORBIDDEN","An active planning role is required.");
  const asset=await r.getAsset(org,input.assetId);if(!asset||asset.status==="retired")throw new OpsDomainError("VALIDATION","Choose active equipment.");
  const before=await r.getCapitalPlan(org,asset.id);
  if(!Number.isSafeInteger(input.version)||input.version!==(before?.version??0))throw new OpsDomainError("CONFLICT","This plan changed. Refresh before saving.");
  if(input.targetMonth&&!validTarget(input.targetMonth))throw new OpsDomainError("VALIDATION","Choose a valid month or year.");
  if(!["flexible","soon","urgent"].includes(input.priority)||!["considering","planned","approved","completed","cancelled"].includes(input.status)||!input.owner.trim()||input.owner.length>200||input.reason.length>2000||!/^[A-Z]{3}$/.test(input.currency))throw new OpsDomainError("VALIDATION","Check the owner, priority and currency.");
  let amountMinor=input.amountMinor,currency=input.currency,costBasis="Planning estimate";
  if(input.sourceId==="keep-saved"&&before){amountMinor=before.amountMinor;currency=before.currency;costBasis=before.costBasis;}
  else if(input.sourceId) {const price=(await capitalPriceChoices(r,org,asset.id)).find(p=>p.id===input.sourceId);if(!price)throw new OpsDomainError("VALIDATION","The selected price is no longer available.");amountMinor=price.amountMinor;currency=price.currency;costBasis=price.basis;}
  if(amountMinor!==undefined&&(!Number.isSafeInteger(amountMinor)||amountMinor<0||amountMinor>2147483647))throw new OpsDomainError("VALIDATION","Enter a valid installed cost, or leave it blank.");
  const now=svc.clock?.now()??new Date().toISOString(),id=`capital-${crypto.randomUUID()}`;
  const after={...input,sourceId:input.sourceId==="keep-saved"?before?.sourceId:input.sourceId,owner:input.owner.trim(),reason:input.reason.trim(),id,storeId:asset.storeId,version:input.version+1,amountMinor,currency,costBasis,createdAt:now};
  try {await r.atomicWrite([
    insertRecord("ops_capital_plans",{id,organization_id:org,asset_id:asset.id,store_id:asset.storeId,version:after.version,target_month:input.targetMonth,amount_minor:amountMinor,currency,cost_basis:costBasis,source_id:input.sourceId==="keep-saved"?before?.sourceId:input.sourceId,priority:input.priority,owner:input.owner.trim(),reason:input.reason.trim(),status:input.status,created_at:now}),
    communicationAudit(org,asset.id,"asset.capital_plan_saved",input.actor,now,{before,after},"asset"),
  ]);}catch(error){if(((await r.getCapitalPlan(org,asset.id))?.version??0)>input.version)throw new OpsDomainError("CONFLICT","This plan changed. Refresh before saving.");throw error;}
  return after;
}
export function capitalFromFixture(f:OpsFixture,scope:OrganizationScope,q:CapitalQuery):CapitalPage {
  validateCapitalQuery(q);const end=monthAfter(q.start,q.months);
  const stores=f.stores.filter(s=>s.organizationId===scope.organizationId&&(scope.storeIds===undefined||scope.storeIds.includes(s.id))&&(scope.regionIds===undefined||scope.regionIds.includes(s.regionId??""))&&(!q.storeId||s.id===q.storeId)&&(!q.regionId||s.regionId===q.regionId));
  const all:CapitalRow[]=f.assets.filter(a=>a.organizationId===scope.organizationId&&a.status!=="retired"&&stores.some(s=>s.id===a.storeId)&&(!q.category||a.categoryKey===q.category)).flatMap(a=>{
    if(f.replacementEvents.some(e=>e.organizationId===scope.organizationId&&e.assetId===a.id&&e.status==="completed"))return [];
    const s=stores.find(s=>s.id===a.storeId)!,plan=latestCapitalPlan(f,scope.organizationId,a.id),legacy=f.lifecycleRecommendations.filter(l=>l.organizationId===scope.organizationId&&l.assetId===a.id).sort((x,y)=>y.version-x.version)[0];
    if(plan?!["considering","planned","approved"].includes(plan.status):!legacy||!["replace","defer"].includes(legacy.userDecision))return [];
    if(q.search&&![a.name,a.assetTag,s.storeNumber,s.name,s.address1,s.address2,s.city,s.state,s.postalCode,...s.aliases].join(" ").toLowerCase().includes(q.search.toLowerCase()))return [];
    const p:CapitalPlan=plan??{id:legacy!.id,organizationId:scope.organizationId,assetId:a.id,storeId:a.storeId,version:0,targetMonth:legacy?.plannedForYear?String(legacy.plannedForYear):undefined,amountMinor:a.replacementEstimate?.amountMinor,currency:a.replacementEstimate?.currency??"USD",costBasis:"Planning estimate",priority:"flexible",owner:"Facilities",reason:legacy!.userReason,status:"planned",createdAt:legacy!.decidedAt};
    return [{...p,assetName:a.name,assetTag:a.assetTag,storeNumber:s.storeNumber,storeName:s.name,category:a.categoryKey,legacyYear:plan?undefined:legacy?.plannedForYear}];
  });
  const currencies=[...new Set(all.map(r=>r.currency))].sort(),rows=all.filter(r=>r.currency===q.currency),groups=new Map<string,CapitalBucket>();
  for(const row of rows){const month=!row.targetMonth?"undated":row.targetMonth.length===4?row.targetMonth:row.targetMonth<q.start?"overdue":row.targetMonth;if(month!=="undated"&&month!=="overdue"&&month.length!==4&&month>=end)continue;const b=groups.get(month)??{month,count:0,amountMinor:0,missing:0};b.count++;if(row.amountMinor===undefined)b.missing++;else b.amountMinor+=row.amountMinor;groups.set(month,b);}
  const filtered=rows.filter(r=>q.month?q.month==="undated"?!r.targetMonth:q.month==="overdue"?Boolean(r.targetMonth&&r.targetMonth.length===7&&r.targetMonth<q.start):r.targetMonth===q.month:!r.targetMonth||r.targetMonth.length===4||r.targetMonth<end).sort((a,b)=>(a.targetMonth??"9999").localeCompare(b.targetMonth??"9999")||a.assetId.localeCompare(b.assetId));
  return {items:filtered.slice(q.offset??0,(q.offset??0)+25),total:filtered.length,buckets:[...groups.values()].sort((a,b)=>a.month.localeCompare(b.month)),currencies};
}
