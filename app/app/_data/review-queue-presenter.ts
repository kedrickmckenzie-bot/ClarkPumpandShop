import type { ListPageViewModel, OperatorSession, PaginationViewModel } from "@/components/ops/data-contract";
import type { OpsRepository } from "@/lib/ops/repository";
import type { AttentionQuery } from "@/lib/ops/attention-query";
import { attentionScope, validateAttentionQuery } from "@/lib/ops/attention-query";
import { reviewItemHref, safeReviewQueue } from "@/lib/ops/review-navigation";
import { formatOperationsDate, formatOperationsDateTime } from "@/lib/ops/local-time";
import { attentionAccess, presentAttentionRow } from "./attention-presenter";
import { compactStoreLabel } from "@/lib/product/store-label";
import { workWarrantyMarkers } from "@/lib/ops/work-warranty-review";

type Query = Record<string,string | string[] | undefined>;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const PAGE_SIZE=25;
export function reviewQuery(params: Query, asOf: string): AttentionQuery {
  const type=first(params.type),priority=first(params.priority),rawLane=first(params.lane),lane=rawLane==="all"?undefined:rawLane,q=first(params.q)?.trim();
  const query: AttentionQuery={asOf,q,store:first(params.store),type:(type === "exception" ? "service-record" : type === "vendor-reminder" ? "vendor-task" : type) as AttentionQuery["type"],priority:priority as AttentionQuery["priority"],lane:lane as AttentionQuery["lane"]};
  validateAttentionQuery(query); return query;
}
function pageNumber(raw?: string) { const n=Number(raw ?? 1); if (!Number.isSafeInteger(n) || n<1) throw new RangeError("Choose a valid page."); return n; }
export function reviewHref(query: AttentionQuery, page=1) {
  const params=new URLSearchParams();
  for (const key of ["q","type","priority","lane","store"] as const) if(query[key]) params.set(key,query[key]);
  // Opening the queue with no lane shows "Needs my action"; "All open" is therefore always explicit.
  if(!query.lane) params.set("lane","all");
  if(page>1) params.set("page",String(page));
  return `/app/action-center${params.size ? `?${params}` : ""}`;
}
function pagination(total: number,page: number,href:(page:number)=>string): PaginationViewModel | undefined {
  const pages=Math.max(1,Math.ceil(total/PAGE_SIZE));
  if(pages===1 && page===1) return undefined;
  return {summary:`Page ${page} of ${pages}`,currentPage:page,totalPages:pages,pageLinks:[],previousHref:page>1 ? href(page-1) : undefined,nextHref:page<pages ? href(page+1) : undefined};
}
export async function buildReviewQueue(repository: OpsRepository,session: OperatorSession,requested: Query,asOf:string,itemIds?:string[]): Promise<ListPageViewModel> {
  let params=requested;
  if(!first(requested.lane) && !itemIds) {
    // First view: the person's own actions, unless they have none — then everything open.
    const mine=await repository.listAttention({organizationId:session.organizationId,storeIds:session.storeIds,regionIds:session.regionIds},attentionAccess(session),{asOf,store:first(requested.store),lane:"mine",limit:1});
    params={...requested,lane:mine.totalCount ? "mine" : "all"};
  }
  const query=reviewQuery(params,asOf), page=itemIds ? 1 : pageNumber(first(params.page)),queue=reviewHref(query,pageNumber(first(params.page)));
  const scope={organizationId:session.organizationId,storeIds:session.storeIds,regionIds:session.regionIds},access=attentionAccess(session);
  const store=query.store?(await repository.searchStores(attentionScope(scope,query),"",{limit:1})).items[0]:undefined;
  const scopeLabel=query.store?store?compactStoreLabel(`Store ${store.storeNumber} · ${store.name}`,session.organizationName):"Store not available in this scope":session.scopeLabel;
  const result=await repository.listAttention(scope,access,{...query,limit:itemIds ? PAGE_SIZE : PAGE_SIZE*2,offset:(page-1)*PAGE_SIZE,itemIds});
  const base: AttentionQuery={asOf,store:query.store};
  const metricQueries=[{...base,lane:"mine" as const},{...base,lane:"waiting" as const},base];
  const totals=itemIds ? [] : await Promise.all(metricQueries.map(metric=>repository.listAttention(scope,access,{...metric,limit:1})));
  const actions=result.items.map(row=>presentAttentionRow({...row,storeLabel:row.storeLabel?compactStoreLabel(row.storeLabel,session.organizationName):undefined},asOf));
  const warranty=await workWarrantyMarkers(repository,scope,result.items.slice(0,PAGE_SIZE).flatMap(r=>r.workOrderId?[r.workOrderId]:[]),asOf.slice(0,10));
  actions.slice(0,PAGE_SIZE).forEach((action,index)=>{if(warranty.get(result.items[index].workOrderId??""))action.reasonLabel=`Warranty? · ${action.reasonLabel??""}`;});
  const labels=["Needs your action","Waiting on others","All open items"];
  const filter=(key:"lane"|"type"|"priority",label:string,options:Array<[string,string]>)=>({id:`attention-${key}`,label,options:options.map(([value,title])=>({value:value||"all",label:title,selected:(query[key]??"")===value,href:reviewHref({...query,[key]:value||undefined})}))});
  return {state:{kind:"ready"},page:{title:"Review queue",description:query.lane === "history" ? "Completed and canceled tasks." : "Open an item and take the next step.",scopeLabel,updatedLabel:`Updated ${formatOperationsDate(asOf)}`},
    metrics:totals.map((total,index)=>({id:["attention-mine","attention-waiting","attention-open"][index],label:labels[index],value:String(total.totalCount),supportingText:["Decisions and follow-ups for you","Vendors or others need to act","Everything open in your store scope"][index],tone:index===0 && total.totalCount ? "warning" as const : "neutral" as const,link:{href:reviewHref(metricQueries[index]),label:`Show ${labels[index].toLowerCase()}`}})),
    filters:[filter("lane","Responsibility",[["","All open"],["mine","Needs my action"],["team","Team is handling"],["waiting","Waiting on others"],["upcoming","Upcoming"],["history","Task history"]]),filter("type","Type",[["","All types"],["service-record","Records to check"],["follow-up","Follow-ups"],["vendor-task","Vendor tasks"]]),filter("priority","Priority",[["","All priorities"],["urgent","Do now"],["standard","Other items"]])],
    clearFiltersHref:query.q || query.type || query.lane || query.priority ? `/app/action-center${query.store ? `?${new URLSearchParams({store:query.store})}` : ""}` : undefined,
    appliedFilters:(["q","lane","type","priority","store"] as const).flatMap(key=>query[key]?[{id:key,label:key === "store" ? scopeLabel : key === "lane" ? ({mine:"Needs my action",team:"Team is handling",waiting:"Waiting on others",upcoming:"Upcoming",history:"Task history"} as Record<string,string>)[query.lane!] ?? query.lane! : `${key === "q"?"Search":key === "type"?"Type":"Priority"}: ${query[key]}`,removeHref:reviewHref({...query,[key]:undefined})}]:[]),
    table:{id:"action-center",caption:"Review queue",columns:[],rows:actions.slice(0,PAGE_SIZE).map((action,index)=>({id:action.id,label:action.title,href:reviewItemHref(action.link.href,queue,action.id,actions.slice(index+1,index+26).map(row=>row.id)),sourceLink:(action.sourceCount??1)>1?{href:`/app/action-center/sources?${new URLSearchParams({item:action.id,queue})}`,label:`Related tasks and records (${action.sourceCount})`}:undefined,cells:[{key:"item",value:action.title,secondary:action.description},{key:"store",value:action.storeLabel??"Companywide"},{key:"record",value:action.recordLabel??action.categoryLabel,secondary:action.reasonLabel},{key:"owner",value:action.ownerLabel},{key:"due",value:action.dueLabel},{key:"priority",value:action.priorityLabel??"Review",tone:action.tone},{key:"type",value:action.categoryLabel},{key:"action",value:action.link.label}]}))},
    resultSummary:query.lane === "history" ? `${result.totalCount} history items` : `Showing ${result.totalCount} of ${totals[2]?.totalCount ?? result.totalCount} open items`,
    search:{label:"Search review queue",placeholder:"Store, work order, owner or keyword",value:query.q,action:"/app/action-center",preservedParameters:(["type","priority","lane","store"] as const).flatMap(name=>query[name] ? [{name,value:query[name]}] : [])},pagination:pagination(result.totalCount,page,n=>reviewHref(query,n))};
}
export async function buildReviewSources(repository:OpsRepository,session:OperatorSession,params:Query,asOf:string) {
  const queue=safeReviewQueue(first(params.queue)),query=reviewQuery(Object.fromEntries(new URL(queue,"https://ops.invalid").searchParams),asOf),item=first(params.item),page=pageNumber(first(params.page));
  if(!item) throw new RangeError("Choose a review item.");
  const result=await repository.listAttentionSources({organizationId:session.organizationId,storeIds:session.storeIds,regionIds:session.regionIds},attentionAccess(session),query,item,{limit:PAGE_SIZE,offset:(page-1)*PAGE_SIZE});
  if(!result) return null;
  const href=(n:number)=>`/app/action-center/sources?${new URLSearchParams({item,queue,...(n>1?{page:String(n)}:{})})}`;
  return {title:presentAttentionRow(result.item,asOf).title,recordContext:[result.item.workNumber??result.item.requestReference,result.item.storeLabel?compactStoreLabel(result.item.storeLabel,session.organizationName):result.item.vendorName].filter(Boolean).join(" · "),scopeLabel:session.scopeLabel,queue,totalCount:result.totalCount,rows:result.items.map(row=>({...row,href:reviewItemHref(row.href,queue,item,[]),dueLabel:row.dueAt?formatOperationsDateTime(row.dueAt):row.noDeadline??"No deadline recorded"})),pagination:pagination(result.totalCount,page,href)};
}
