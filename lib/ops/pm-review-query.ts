import { invoiceLinkFacts } from "./invoice-linking";
import type { OrganizationScope } from "./repository";
import type { OpsFixture, PageRequest } from "./types";
import { dashboardPageBounds } from "./dashboard-query";
import { pmScheduleScope } from "./pm-schedule-query";
import { pmStoreAllowed } from "./pm-record-query";

export interface PmReviewQuery extends PageRequest {
  store?: string; region?: string; program?: string; review?: string;
  kind: "reviews" | "invoices" | "occurrences" | "visits";
  missing?: boolean;
}
export interface PmReviewRow {
  id:string; storeId:string; storeNumber:string; storeName:string; programId:string; programName:string;
  createdAt:string; periodLabel:string; invoiceCount:number; visitCount:number; occurrenceCount:number; missingCount:number; unavailableLinks:number;
  currency?:string; amountMinor?:number; missingAmountMinor?:number;
}
export interface PmReviewSourceRow {
  id:string; label:string; detail:string; date:string; status:string; currency?:string; amountMinor?:number;
  workId?:string; workNumber?:string;
}
export interface PmReviewPage { reviews:PmReviewRow[]; sources:PmReviewSourceRow[]; parent:PmReviewRow|null; totalCount:number; nextOffset?:number; }
export function validatePmReviewQuery(query:PmReviewQuery) {
  if(!["reviews","invoices","occurrences","visits"].includes(query.kind)||query.kind!=="reviews"&&!query.review)throw new RangeError("Choose a PM review first.");
}
const idList=(value:unknown)=>Array.isArray(value)?[...new Set(value.filter((v):v is string=>typeof v==="string"&&v.length>0))]:[];
export function pmReviewFromFixture(fixture:OpsFixture,scope:OrganizationScope,query:PmReviewQuery):PmReviewPage {
  validatePmReviewQuery(query);
  const stores=new Map(fixture.stores.filter(s=>pmStoreAllowed(pmScheduleScope(scope,query),s)).map(s=>[s.id,s]));
  const work=new Map(fixture.workOrders.filter(w=>w.organizationId===scope.organizationId&&stores.has(w.storeId)).map(w=>[w.id,w]));
  const reviews:PmReviewRow[]=[],sourceById=new Map<string,Record<"invoices"|"occurrences"|"visits",PmReviewSourceRow[]>>();
  for(const record of fixture.serviceDiscrepancies){
    if(record.organizationId!==scope.organizationId||["resolved","closed"].includes(record.status)||query.review&&record.id!==query.review)continue;
    const parent=work.get(record.workOrderId);if(!parent)continue;
    let facts:Record<string,unknown>;try{facts=JSON.parse(record.factsJson);}catch{continue;}
    if(!facts||facts.reconciliationKind!=="pm_billed_vs_observed"||facts.storeId!==parent.storeId)continue;
    const program=fixture.maintenancePrograms.find(p=>p.organizationId===scope.organizationId&&p.id===facts.programId);
    if(!program||query.program&&program.id!==query.program)continue;
    const programOccurrences=fixture.pmOccurrences.filter(o=>o.organizationId===scope.organizationId&&o.storeId===parent.storeId&&o.workOrderId&&work.get(o.workOrderId)?.storeId===o.storeId&&fixture.pmPlans.some(p=>p.organizationId===scope.organizationId&&p.id===o.planId&&p.programId===program.id&&(!p.storeId||p.storeId===o.storeId)));
    if(!programOccurrences.some(o=>o.workOrderId===parent.id))continue;
    const eligibleWork=new Set(programOccurrences.map(o=>o.workOrderId!));
    const refs=idList(facts.billedInvoiceIds);if(record.invoiceId&&!refs.includes(record.invoiceId))refs.push(record.invoiceId);
    const missingRefs=idList(facts.missingOccurrenceIds),visitRefs=idList(facts.observedVisitIds);
    let unavailableLinks=0;
    const invoices=refs.flatMap(id=>{
      const invoice=fixture.invoices.find(i=>i.organizationId===scope.organizationId&&i.id===id);if(!invoice){unavailableLinks++;return [];}
      const lineIds=new Set(fixture.invoiceLines.filter(l=>l.organizationId===scope.organizationId&&l.invoiceId===id).map(l=>l.id));
      const allocations=fixture.invoiceLineAllocations.filter(a=>a.organizationId===scope.organizationId&&lineIds.has(a.invoiceLineId));
      if(!allocations.length||allocations.some(a=>a.storeId!==parent.storeId||work.get(a.workOrderId)?.storeId!==parent.storeId)){unavailableLinks++;return [];}
      const linked=allocations.filter(a=>eligibleWork.has(a.workOrderId));if(!linked.length){unavailableLinks++;return [];}
      const supported=new Set(invoiceLinkFacts(fixture,invoice).supported.map(a=>a.id));
      return [{invoice,allocations:linked.map(a=>({...a,amount:{currency:invoice.total.currency,amountMinor:supported.has(a.id)?a.amount.amountMinor:0}}))}];
    });
    const linkedWork=new Set(invoices.flatMap(i=>i.allocations.map(a=>a.workOrderId)));
    const flagged=missingRefs.flatMap(id=>{const o=programOccurrences.find(o=>o.id===id);if(!o){unavailableLinks++;return [];}return [o];});
    const occurrences=programOccurrences.filter(o=>linkedWork.has(o.workOrderId!)||flagged.some(f=>f.id===o.id));
    const includedWork=new Set(occurrences.map(o=>o.workOrderId!));
    const visits=fixture.visits.filter(v=>v.organizationId===scope.organizationId&&v.storeId===parent.storeId&&(v.workOrderId&&includedWork.has(v.workOrderId)||fixture.siteVisitWorkOrders.some(l=>l.organizationId===scope.organizationId&&l.visitId===v.id&&includedWork.has(l.workOrderId))));
    for(const id of visitRefs)if(!visits.some(v=>v.id===id))unavailableLinks++;
    const visited=(id:string)=>visits.some(v=>v.workOrderId===id||fixture.siteVisitWorkOrders.some(l=>l.organizationId===scope.organizationId&&l.visitId===v.id&&l.workOrderId===id));
    const missing=occurrences.filter(o=>!visited(o.workOrderId!));
    const allocations=invoices.flatMap(i=>i.allocations),currencies=new Set(allocations.map(a=>a.amount.currency)),currency=currencies.size===1?[...currencies][0]:undefined;
    const store=stores.get(parent.storeId)!;
    const row:PmReviewRow={id:record.id,storeId:store.id,storeNumber:store.storeNumber,storeName:store.name,programId:program.id,programName:program.name,createdAt:new Date(record.createdAt).toISOString(),periodLabel:typeof facts.periodLabel==="string"?facts.periodLabel:"Recorded review period",
      invoiceCount:invoices.length,visitCount:visits.length,occurrenceCount:occurrences.length,missingCount:missing.length,unavailableLinks,currency,amountMinor:currency?allocations.reduce((n,a)=>n+a.amount.amountMinor,0):undefined,missingAmountMinor:currency?allocations.filter(a=>!visited(a.workOrderId)).reduce((n,a)=>n+a.amount.amountMinor,0):undefined};
    reviews.push(row);
    sourceById.set(record.id,{
      invoices:invoices.flatMap(({invoice,allocations})=>{const selected=query.missing?allocations.filter(a=>!visited(a.workOrderId)):allocations;if(!selected.length)return [];const currencies=new Set(selected.map(a=>a.amount.currency));return [{id:invoice.id,label:invoice.vendorInvoiceNumber,detail:"Linked invoice amount",date:invoice.invoiceDate,status:invoice.status,currency:currencies.size===1?[...currencies][0]:undefined,amountMinor:currencies.size===1?selected.reduce((n,a)=>n+a.amount.amountMinor,0):undefined}];}),
      occurrences:(query.missing?missing:occurrences).map(o=>({id:o.id,label:work.get(o.workOrderId!)!.number,detail:program.name,date:new Date(o.dueAt).toISOString(),status:visited(o.workOrderId!)?"Visit recorded":"No visit recorded",workId:o.workOrderId,workNumber:work.get(o.workOrderId!)!.number})),
      visits:visits.map(v=>({id:v.id,label:v.technicianName,detail:v.providerName??v.purpose,date:new Date(v.checkedInAt).toISOString(),status:v.status})),
    });
  }
  reviews.sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)||(a.id<b.id?-1:a.id>b.id?1:0));
  const {limit,offset}=dashboardPageBounds(query),parent=query.kind!=="reviews"&&query.review?reviews[0]??null:null;
  const sources=query.kind==="reviews"?[]:sourceById.get(query.review!)?.[query.kind]??[];
  sources.sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)||(a.id<b.id?-1:a.id>b.id?1:0));
  const totalCount=query.kind==="reviews"?reviews.length:sources.length;
  return {reviews:query.kind==="reviews"?reviews.slice(offset,offset+limit):[],sources:sources.slice(offset,offset+limit),parent,totalCount,nextOffset:offset+limit<totalCount?offset+limit:undefined};
}
