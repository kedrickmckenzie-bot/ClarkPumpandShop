import Link from "next/link";
import { loadWorkPrices } from "@/app/app/_data/work-price-loader";
import { priceLabel } from "@/lib/ops/lifecycle-price-evidence";
import styles from "@/components/workspace/work-prices.module.css";
export default async function CostHistory({params,searchParams}: {params:Promise<{id:string}>;searchParams:Promise<{page?:string}>}) {
  const {id}=await params, query=await searchParams;
  const model=await loadWorkPrices(id,{page:Number(query.page??1)});
  return <div className={styles.page}>
    <Link href={`/app/work-orders/${id}#work-prices`}>← {model.work.number}</Link>
    <h1>Past costs</h1><p>{model.asset?.name ?? model.work.problem}</p>
    <p>{model.fromDate} to {model.toDate} · Recorded work cost</p>
    <div className={styles.numbers}>{model.spend.map(amount=><strong key={amount.currency}>{priceLabel(amount)}</strong>)}</div>
    <p>{model.costs.length} cost lines · {model.asset ? "Whole unit":"This job"}</p>
    {model.costs.length ? <div className={styles.tableScroll}><table><thead><tr><th>Work</th><th>Date</th><th>Cost</th></tr></thead><tbody>{model.costs.slice((model.page-1)*20,model.page*20).map(row=><tr key={row.id}><td><Link href={`/app/work-orders/${row.workOrderId}?view=cost`}>{model.workById.get(row.workOrderId)?.number}</Link><small>{row.description}</small></td><td>{row.serviceDate.slice(0,10)}</td><td>{priceLabel(row.amount)}</td></tr>)}</tbody></table></div>:<p>No costs recorded in this period.</p>}
    <nav className={styles.pager} aria-label="Cost pages">{model.page>1 ? <Link href={`?page=${model.page-1}`}>← Newer</Link>:null}<span>Page {model.page}</span>{model.page*20<model.costs.length?<Link href={`?page=${model.page+1}`}>Older →</Link>:null}</nav>
    <details><summary>About these costs</summary><p>Only saved cost lines are counted. A missing bill is not counted as zero. Prices and approved work stay separate. Each currency has its own total.</p></details>
  </div>;
}
