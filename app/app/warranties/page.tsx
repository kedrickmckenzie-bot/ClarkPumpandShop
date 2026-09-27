import { WarrantyCenter, type WarrantySearch } from "@/components/workspace/warranty-center";
import {WarrantyQueueWorkspace} from "@/components/workspace/warranty-queue-workspace";
import {loadOperatorSession} from "../_data/operator-loader";
import {getServerOpsRepository} from "@/lib/server/ops-repository-provider";
import {roleCanAccessListRoute} from "@/components/ops/role-policy";
import {notFound} from "next/navigation";
export const metadata={title:"Warranty center"};
export default async function Page({searchParams}:{searchParams:Promise<WarrantySearch & {currency?:string;page?:string}>}) {const raw=await searchParams,q=Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,Array.isArray(v)?v[0]:v]));if(q.view==="exposure"&&!q.tab){const session=await loadOperatorSession();if(!roleCanAccessListRoute(session.role,"warranties"))notFound();const currency=/^[A-Z]{3}$/.test(q.currency??"")?q.currency!:"USD",page=Math.max(1,Math.min(100000,Math.floor(Number(q.page)||1))),search=q.q?.slice(0,160)??"",result=await (await getServerOpsRepository()).listWarrantyQueue(session,{view:"exposure",currency,search,limit:25,offset:(page-1)*25});return <WarrantyQueueWorkspace result={result} view="exposure" currency={currency} page={page} search={search} scopeLabel={session.scopeLabel} canCreate={false}/>;}return <WarrantyCenter searchParams={Promise.resolve(q)}/>;}
