import Link from "next/link";
import { loadWorkPrices } from "@/app/app/_data/work-price-loader";
import { priceLabel } from "@/lib/ops/lifecycle-price-evidence";
import styles from "@/components/workspace/work-prices.module.css";

export default async function PriceHistory({params, searchParams}: {params:Promise<{id:string}>;searchParams:Promise<Record<string,string|undefined>>}) {
  const {id} = await params, query = await searchParams;
  const kind = query.kind === "repair" || query.kind === "replace" ? query.kind : undefined;
  const model = await loadWorkPrices(id,{peers:query.scope === "peers",unit:query.scope === "unit",kind,page:Number(query.page ?? 1)});
  const base = "/app/work-orders/" + id;
  const href = (page:number) => base + "/prices?" + new URLSearchParams({scope:query.scope === "peers" ? "peers":query.scope === "unit" ? "unit":"job",...(kind ? {kind}:{}),page:String(page)});
  const max = Math.max(1,...model.history.items.map(row => row.amount.amountMinor));
  const oneCurrency = new Set(model.history.items.map(row => row.amount.currency)).size === 1;
  return <div className={styles.page}>
    <Link href={base + "#work-prices"}>← {model.work.number}</Link>
    <h1>Price history</h1>
    <p>{query.scope === "peers" ? model.groupName : model.asset?.name ?? model.work.problem}</p>
    <Link href={base + "?view=service&path=bids#bid-requests"}>Vendor quotes →</Link>
    <form className={styles.form} method="get">
      <label>Price for<select name="kind" defaultValue={kind ?? ""}><option value="">Repair & replace</option><option value="repair">Repair</option><option value="replace">Replace</option></select></label>
      <label>Show<select name="scope" defaultValue={query.scope === "peers" ? "peers":query.scope === "unit" ? "unit":"job"}><option value="job">This job</option>{model.asset ? <option value="unit">This unit</option>:null}{model.asset?.replacementProfileId ? <option value="peers">Same group</option>:null}</select></label>
      <button>Show prices</button>
    </form>
    <p>{model.history.total} reported {model.history.total===1 ? "price":"prices"}</p>
    <details><summary>About these prices</summary><p>These are prices shared by vendors, saved by your team. They are not bills or approved work. Read what each price covers before you compare. Old prices stay here when a new one is saved. Only stores you can view are shown.</p></details>
    {model.history.items.length ? <ol className={styles.history}>
      {model.history.items.map(row => <li key={row.id} className={styles.panel}>
        <div className={styles.head}><strong>{priceLabel(row.amount)}</strong><time dateTime={row.recordedAt}>{new Date(row.recordedAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</time></div>
        {kind && oneCurrency ? <div className={styles.track} aria-hidden="true"><div style={{width:Math.max(1,row.amount.amountMinor/max*100)+"%"}}/></div>:null}
        <p>{row.kind === "repair" ? "Repair":"Replace"} · {row.scopeKind === "whole" ? "Whole unit + setup":row.scopeKind === "part" ? "One part":"This job"}</p>
        <p>{row.scope}</p>
        <p><Link href={"/app/vendors/" + row.vendorId}>{model.vendors.find(vendor => vendor.id === row.vendorId)?.name ?? "Vendor"}</Link> · <Link href={"/app/work-orders/" + row.workOrderId + "#work-prices"}>{model.workById.get(row.workOrderId)?.number ?? "Work order"}</Link> · <Link href={"/app/stores/" + row.storeId}>{model.stores.find(store=>store.id===row.storeId)?.storeNumber}</Link></p>
        <small>Saved by {row.recordedBy}</small>
        {model.canPlan && row.kind === "replace" && row.scopeKind === "whole" && row.profileId ? <p><Link href={"/app/work-orders/"+row.workOrderId+"/prices/"+row.id+"/plan"}>Update plans →</Link></p>:null}
      </li>)}
    </ol>:<p>No prices saved here yet.</p>}
    <nav className={styles.pager} aria-label="Price pages">{model.page>1 ? <Link href={href(model.page-1)}>← Newer</Link>:null}<span>Page {model.page}</span>{model.page*20<model.history.total ? <Link href={href(model.page+1)}>Older →</Link>:null}</nav>
  </div>;
}
