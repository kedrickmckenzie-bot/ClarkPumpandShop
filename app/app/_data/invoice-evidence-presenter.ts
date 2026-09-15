import type { ListPageViewModel, OperatorSession } from "@/components/ops/data-contract";
import type { InvoiceEvidencePage, InvoiceEvidenceQuery } from "@/lib/ops/invoice-evidence-query";
import { formatOperationsDate } from "@/lib/ops/local-time";
import type { OperatorSearchParameters } from "./operator-presenter";
const first=(v:string|string[]|undefined)=>Array.isArray(v)?v[0]:v;
export function hasInvoiceEvidenceFilters(query:OperatorSearchParameters){return ["from","to","costMonth","store","region","category","path","asset","component"].some(k=>Boolean(first(query[k])));}
export function invoiceEvidenceParameters(query:OperatorSearchParameters):InvoiceEvidenceQuery {
  const v=Object.fromEntries(Object.entries(query).map(([k,v])=>[k,first(v)]));
  const page=Number(v.page), offset=Number.isSafeInteger(page)&&page>0&&page<=1_000_000?(page-1)*25:0;
  return {currency:/^[A-Z]{3}$/.test(v.currency??"")?v.currency!:"USD",from:v.from,to:v.to,costMonth:v.costMonth,store:v.store,region:v.region,category:v.category,path:v.path?.split("|"),asset:v.asset,component:v.component,search:v.q?.slice(0,160),limit:25,offset};
}
export function buildInvoiceEvidenceModel(result:InvoiceEvidencePage,session:OperatorSession,query:OperatorSearchParameters):ListPageViewModel {
  const values=Object.fromEntries(Object.entries(query).flatMap(([k,v])=>first(v)?[[k,first(v)!]]:[])),q=invoiceEvidenceParameters(query);
  const money=(n:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:q.currency}).format(n/100);
  const page=Math.floor((q.offset??0)/25)+1,pageCount=Math.max(1,Math.ceil(result.totalCount/25));
  const href=(changes:Record<string,string|undefined>)=>`/app/invoices?${new URLSearchParams(Object.entries({...values,...changes}).filter((p):p is [string,string]=>Boolean(p[1])))}`;
  return {state:{kind:"ready"},rowNavigation:"record",page:{title:"Linked invoice amount",eyebrow:"Invoice source records",description:"Confirmed matches behind the selected spending total.",scopeLabel:[session.scopeLabel,...(result.filterLabels??[]),q.category,q.path?.join(" › ")].filter(Boolean).join(" · "),periodLabel:[q.from?`From ${formatOperationsDate(q.from)}`:undefined,q.to?`Through ${formatOperationsDate(q.to)}`:undefined,q.costMonth,q.currency].filter(Boolean).join(" · "),secondaryAction:{label:"All invoices",href:"/app/invoices"}},
    resultSummary:`${result.totalCount} confirmed allocations · ${money(result.amountMinor)}`,
    search:{label:"Search invoice evidence",placeholder:"Invoice, work order, problem or store",value:q.search,action:"/app/invoices",preservedParameters:Object.entries(values).filter(([k])=>!["q","page"].includes(k)).map(([name,value])=>({name,value}))},
    table:{id:"invoice-evidence",caption:"Confirmed invoice allocations",columns:[{key:"invoice",label:"Invoice"},{key:"work",label:"Work order"},{key:"store",label:"Store"},{key:"date",label:"Invoice date"},{key:"amount",label:"Linked amount",align:"end"}],rows:result.rows.map(r=>({id:r.id,label:r.number,href:r.href,cells:[{key:"invoice",value:r.number},{key:"work",value:r.workNumber,secondary:r.problem,link:{href:`/app/work-orders/${r.workId}?view=cost`,label:"Open work cost"}},{key:"store",value:`Store ${r.storeNumber}`,secondary:r.storeName,link:{href:`/app/stores/${r.storeId}`,label:"Open store"}},{key:"date",value:formatOperationsDate(r.date)},{key:"amount",value:money(r.amountMinor)}]}))},
    pagination:pageCount>1||page>1?{summary:`${result.totalCount} allocations · 25 per page`,currentPage:page,totalPages:pageCount,pageLinks:[...new Set([1,page-1,page,page+1,pageCount])].filter(p=>p>=1&&p<=pageCount).sort((a,b)=>a-b).map(p=>({page:p,current:p===page,href:href({page:String(p)})})),previousHref:page>1?href({page:String(page-1)}):undefined,nextHref:result.nextOffset!==undefined?href({page:String(page+1)}):undefined}:undefined};
}
