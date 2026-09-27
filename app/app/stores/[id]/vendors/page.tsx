import Link from "next/link";
import {storeWorkspaceContext} from "@/lib/server/store-workspace-context";
import {StoreWorkspaceNav} from "@/components/workspace/store-workspace-nav";
import {StoreVendorPreferenceForm} from "@/components/workspace/store-vendor-preference-form";
import {roleCan} from "@/components/ops/role-policy";
import styles from "@/components/workspace/compliance.module.css";
export default async function StoreVendors({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{q?:string;offset?:string;notice?:string}>}) {
  const {id}=await params,{session,repository,store}=await storeWorkspaceContext(id),q=await searchParams;
  const offset=Math.min(100000,Math.max(0,Math.floor(Number(q.offset)||0))),search=q.q?.slice(0,160)??"";
  const page=await repository.queryStoreVendors(session,id,{search,offset}),edit=["facilities","regional"].includes(session.role);
  const href=(start:number)=>`/app/stores/${encodeURIComponent(id)}/vendors?${new URLSearchParams({q:search,offset:String(start)})}`;
  return <div className={styles.page}><header><Link href="/app/stores">Stores</Link><h1>Store {store.storeNumber} · Vendors</h1><p>{store.name}</p><small>{store.address1}, {store.city}, {store.state} {store.postalCode}</small></header>
    <StoreWorkspaceNav id={id} active="vendors"/>
    {q.notice?<p className={styles.notice} role="status">{q.notice}</p>:null}
    <section className={styles.panel}><h2>Vendors for this store</h2><p>Preferred vendors appear first. Choosing a preferred vendor is optional.</p>
      <form className={styles.filters}><label>Find a vendor<input type="search" name="q" defaultValue={search} placeholder="Name or specialty"/></label><button>Search</button></form>
      <div className={styles.scroll}><table className={`${styles.table} ${styles.vendorTable}`}><thead><tr><th>Vendor / services</th><th>Contact</th><th>Coverage</th><th>Store preference</th><th>Actions</th></tr></thead><tbody>{page.items.map(v=><tr key={v.id}>
        <td data-label="Vendor"><Link href={`/app/vendors/${v.id}`}>{v.name}</Link><p>{v.specialties.map(s=>s.label).join(", ")}</p></td>
        <td data-label="Contact"><a href={`mailto:${v.email}`}>{v.email}</a>{v.phone?<p><a href={`tel:${v.phone}`}>{v.phone}</a></p>:null}</td>
        <td data-label="Coverage">{v.covered?v.coverage.map(c=>c==="organization"?"Companywide":c==="region"?"Region":"This store").join(", "):<span className={styles.danger}>No current approved coverage</span>}</td>
        <td data-label="Preference">{v.preferenceKeys.length?<><strong>Preferred at this store</strong><p>{v.preferenceKeys.includes("*")?"All services":v.preferenceKeys.map(key=>v.specialties.find(s=>s.key===key)?.label??key).join(", ")}</p></>:"No preference"}{edit?<StoreVendorPreferenceForm storeId={id} vendor={v}/>:null}</td>
        <td data-label="Actions">{v.covered&&roleCan(session,"create_work_order")?<Link href={`/app/work-orders/new?store=${encodeURIComponent(id)}&vendor=${encodeURIComponent(v.id)}`}>Create work order</Link>:null}</td>
      </tr>)}</tbody></table></div>
      {!page.items.length?<p>{search?"No vendors match this search.":"No vendors cover this store yet."} {edit?<Link href="/app/vendors">Manage vendor coverage</Link>:null}</p>:null}
      <nav className={styles.bar} aria-label="Store vendor pages">{offset>0?<Link href={href(Math.max(0,offset-25))}>Previous</Link>:<span/>}<span>{page.total} vendors</span>{offset+25<page.total?<Link href={href(offset+25)}>Next</Link>:null}</nav>
    </section>
  </div>;
}
