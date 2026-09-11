import Link from "next/link";
import { loadWorkPrices } from "@/app/app/_data/work-price-loader";
import { priceLabel } from "@/lib/ops/lifecycle-price-evidence";
import { WorkPriceForm } from "./work-price-form";
import styles from "./work-prices.module.css";
export async function WorkPricePanel({ workOrderId }: { workOrderId: string }) {
  const model = await loadWorkPrices(workOrderId);
  const base = "/app/work-orders/" + workOrderId;
  return <section className={styles.panel} id="work-prices" aria-label="Prices and past costs">
    <header className={styles.head}><h2>Prices & past costs</h2><Link href={base + "/prices"}>Price history ({model.history.total}) →</Link></header>
    <div className={styles.numbers}><div><span>Repair estimate</span><strong>{priceLabel(model.work.repairEstimate)}</strong></div>
      <div><span>{model.asset ? "This unit" : "This job"} · 12 months</span><Link href={base + "/cost-history"}>{model.hasCosts ? model.spend.map(row => <strong key={row.currency}>{priceLabel(row)}</strong>) : <strong>No costs yet</strong>}</Link><small>Through {model.toDate}</small></div>
    </div>
    {model.hasCosts && model.work.repairEstimate ? <p className={styles.flag}>{model.spend.map(priceLabel).join(" · ")} spent · 12 months. Worth a look.</p> : null}
    {model.asset ? <Link href={"/app/lifecycle?" + new URLSearchParams({asset:model.asset.id,decision:model.asset.id,work:workOrderId,view:"review",...(model.work.componentId ? {component:model.work.componentId} : {})})}>Costs, repair & replacement →</Link> : null}
    {model.canRecord ? <details><summary>Add a price</summary><WorkPriceForm key={model.work.version ?? 0} workOrderId={workOrderId} version={model.work.version ?? 0} scope={model.work.problem} vendors={model.vendors} currency={model.work.repairEstimate?.currency ?? "USD"}/></details> : null}
    {model.history.items.slice(0,2).map(row => <p key={row.id}>{row.kind === "repair" ? "Repair" : "Replace"} · <strong>{priceLabel(row.amount)}</strong> · {new Date(row.recordedAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
      {model.canPlan && row.kind === "replace" && row.scopeKind === "whole" && row.profileId ? <> · <Link href={base + "/prices/" + row.id + "/plan"}>Update plans →</Link></> : null}</p>)}
  </section>;
}
