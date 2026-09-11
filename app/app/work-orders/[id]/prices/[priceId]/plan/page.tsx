import Link from "next/link";
import { notFound } from "next/navigation";
import { workPricePlan } from "@/lib/ops/work-price-planning";
import { getOpsRequestContext } from "@/lib/server/ops-request-context";
import { resolveAssetReplacementEstimate } from "@/lib/ops/replacement-intelligence";
import type { ReplacementBenchmark } from "@/lib/ops/types";
import { priceLabel } from "@/lib/ops/lifecycle-price-evidence";
import { WorkPricePlanForm } from "@/components/workspace/work-price-plan-form";
import styles from "@/components/workspace/work-prices.module.css";
import { OpsDomainError } from "@/lib/ops/commands";
import { getServerOpsReportingAsOf } from "@/lib/server/ops-repository-provider";

async function PricePlan({params}: {params:Promise<{id:string;priceId:string}>}) {
  const {id,priceId}=await params; const context=await getOpsRequestContext(["facilities"]);
  const plan=await workPricePlan({repository:context.repository},context.session.organizationId,priceId,context.actor);
  if(plan.work.id!==id)notFound();
  const asOf=getServerOpsReportingAsOf();
  const benchmark:ReplacementBenchmark={id:"preview",organizationId:context.session.organizationId,profileId:plan.profile.id,sourceType:"reported_price",totalAmount:plan.price.amount,effectiveAt:plan.price.recordedAt,status:"published",createdAt:asOf};
  const base={replacementProfiles:[plan.profile],assetReplacementOverrides:plan.rows.flatMap(row=>row.override?[row.override]:[])};
  const stores=await Promise.all([...new Set(plan.rows.map(row=>row.asset.storeId))].map(storeId=>context.repository.getStore(context.session.organizationId,storeId)));
  return <div className={styles.page}>
    <Link href={`/app/work-orders/${id}#work-prices`}>← {plan.work.number}</Link>
    <h1>Update plans</h1><p>{plan.profile.name}</p>
    <div className={styles.numbers}><div><span>New price · whole unit + setup</span><strong>{priceLabel(plan.price.amount)}</strong></div><div><span>Units to update</span><strong>{plan.rows.filter(row=>!row.override).length}</strong></div><div><span>Keep their own price</span><strong>{plan.rows.filter(row=>row.override).length}</strong></div></div>
    {plan.rows.some(row=>!row.override)?<WorkPricePlanForm workOrderId={id} priceId={priceId} signature={plan.signature}/>:<p>No plans need an update.</p>}
    <div className={styles.tableScroll}><table><thead><tr><th>Equipment</th><th>Now</th><th>After</th></tr></thead><tbody>{plan.rows.map(row=>{
      const before=resolveAssetReplacementEstimate({...base,replacementBenchmarks:plan.current?[plan.current]:[]},row.asset,asOf);
      const after=resolveAssetReplacementEstimate({...base,replacementBenchmarks:[benchmark]},row.asset,asOf);
      return <tr key={row.asset.id}><td><Link href={`/app/equipment/${row.asset.id}`}>{row.asset.name}</Link><small>{stores.find(store=>store?.id===row.asset.storeId)?.storeNumber} · {row.asset.assetTag}</small></td><td>{priceLabel(before.amount)}</td><td>{priceLabel(after.amount)}{row.override?<small>Keeps its own price</small>:null}</td></tr>;
    })}</tbody></table></div>
    <details><summary>How these prices work</summary><p>Only active units with the same size and setup are included. Units with their own price keep it. Each unit keeps its saved cost changes. These are planning prices, not orders or approved work. The vendor gave one total; the cost of parts and setup is not split out.</p><p>Saved {new Date(plan.price.recordedAt).toLocaleDateString("en-US")} by {plan.price.recordedBy}. <Link href={`/app/work-orders/${id}/prices`}>See source price</Link></p></details>
  </div>;
}

export default async function PlanPage(props:{params:Promise<{id:string;priceId:string}>}) {
  try { return await PricePlan(props); }
  catch(error) {
    if (!(error instanceof OpsDomainError)) throw error;
    const {id}=await props.params;
    return <div className={styles.page}><Link href={`/app/work-orders/${id}#work-prices`}>← Back to work</Link><h1>Update plans</h1><p role="alert">{error.message}</p><Link href={`/app/work-orders/${id}/prices`}>Price history →</Link></div>;
  }
}
