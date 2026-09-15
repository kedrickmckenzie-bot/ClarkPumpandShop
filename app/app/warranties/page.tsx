import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WarrantyQueueWorkspace } from "@/components/workspace/warranty-queue-workspace";
import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import { loadOperatorSession } from "../_data/operator-loader";
import { roleCanAccessListRoute } from "@/components/ops/role-policy";
import { warrantyQueueViews, type WarrantyQueueView } from "@/lib/ops/warranty-queue-query";
export const metadata:Metadata={title:"Warranty center"};
export default async function WarrantyCenterPage({searchParams}:{searchParams?:Promise<Record<string,string|string[]|undefined>>}){
 const q=await searchParams??{},first=(v:string|string[]|undefined)=>Array.isArray(v)?v[0]:v,session=await loadOperatorSession();
 if(!roleCanAccessListRoute(session.role,"warranties"))notFound();
 const raw=first(q.view),view:WarrantyQueueView=warrantyQueueViews.includes(raw as WarrantyQueueView)?raw as WarrantyQueueView:"all",requested=Number(first(q.page)??1),page=Number.isSafeInteger(requested)&&requested>0&&requested<=1_000_000?requested:1,search=first(q.q)?.trim().slice(0,160)??"",requestedCurrency=first(q.currency)?.toUpperCase()??"USD",currency=/^[A-Z]{3}$/.test(requestedCurrency)?requestedCurrency:"USD";
 const result=await (await getServerOpsRepository()).listWarrantyQueue(session,{view,search,currency,limit:25,offset:(page-1)*25});
 return <WarrantyQueueWorkspace result={result} view={view} page={page} search={search} currency={currency} scopeLabel={session.scopeLabel} canCreate={["executive","facilities"].includes(session.role)&&session.storeIds===undefined&&session.regionIds===undefined}/>;
}
