import { LiveSearchForm } from "@/components/ops/live-search-form";
import {safeCapitalReturn} from "@/lib/ops/review-navigation";
import {roleCanAccessProgramRoute} from "@/components/ops/role-policy";
import Link from "next/link";
import {notFound} from "next/navigation";
import {loadOperatorSession} from "../../_data/operator-loader";
import {getServerOpsRepository} from "@/lib/server/ops-repository-provider";
import {capitalPriceChoices} from "@/lib/ops/capital-planning";
import {CapitalPlanForm} from "@/components/workspace/capital-plan-form";
import styles from "@/components/workspace/compliance.module.css";
export const metadata={title:"Plan a replacement"};
export default async function PlanReplacement({searchParams}:{searchParams:Promise<{asset?:string;q?:string;offset?:string;returnTo?:string}>}) {
 const q=await searchParams,session=await loadOperatorSession(),repo=await getServerOpsRepository(),editable=["facilities","regional"].includes(session.role);
 const returnTo=safeCapitalReturn(q.returnTo);
 if(!roleCanAccessProgramRoute(session.role,"lifecycle"))notFound();
 if(q.asset){const asset=await repo.getAsset(session.organizationId,q.asset);if(!asset)notFound();const store=await repo.getStore(session.organizationId,asset.storeId);if(!store||session.storeIds!==undefined&&!session.storeIds.includes(store.id)||session.regionIds!==undefined&&!session.regionIds.includes(store.regionId??""))notFound();
 const [savedPlan,prices]=await Promise.all([repo.getCapitalPlan(session.organizationId,asset.id),capitalPriceChoices(repo,session.organizationId,asset.id)]);
 const legacy=!savedPlan?(await repo.queryCapitalPlans({...session,storeIds:[asset.storeId]},{start:new Date().toISOString().slice(0,7),months:24,currency:asset.replacementEstimate?.currency??"USD",search:asset.assetTag})).items.find(p=>p.assetId===asset.id):undefined;
 const plan=savedPlan??legacy??null;
 return <div className={styles.page}><Link href={returnTo}>← Planned replacements</Link><header><h1>{plan?"Replacement plan":"Plan a replacement"}</h1><p>{asset.name} · Store {store.storeNumber} · {store.name}</p><Link href={`/app/equipment/${encodeURIComponent(asset.id)}`}>Equipment history</Link></header><section className={styles.panel}>{asset.status==="retired"?<p>This equipment has been retired.</p>:<CapitalPlanForm assetId={asset.id} plan={plan} prices={prices} owner={session.displayName} editable={editable} returnTo={returnTo}/>}</section></div>;
 }
 const offset=Math.min(100000,Math.max(0,Math.floor(Number(q.offset)||0))),page=await repo.searchAssets(session,q.q?.slice(0,160)??"",{limit:25,offset});
 const href=(n:number)=>`/app/lifecycle/plan?${new URLSearchParams({q:q.q??"",offset:String(n),returnTo})}`;
 return <div className={styles.page}><Link href={returnTo}>← Planned replacements</Link><header><h1>Plan a replacement</h1><p>Choose equipment. Proactive replacements are welcome.</p></header><section className={styles.panel}><LiveSearchForm className={styles.filters} method="get"><input type="hidden" name="returnTo" value={returnTo}/><label>Find equipment<input name="q" type="search" defaultValue={q.q} placeholder="Equipment, store number, name or address"/></label><button>Search</button></LiveSearchForm><div className={styles.scroll}><table className={`${styles.table} ${styles.vendorTable}`}><thead><tr><th>Equipment</th><th>Store</th><th>Action</th></tr></thead><tbody>{page.items.map(a=><tr key={a.id}><td data-label="Equipment">{a.name}<p>{a.assetTag}</p></td><td data-label="Store">{a.storeNumber} · {a.storeName}</td><td data-label="Action">{a.status==="retired"?"Retired":<Link href={`/app/lifecycle/plan?asset=${encodeURIComponent(a.id)}&returnTo=${encodeURIComponent(returnTo)}`}>Plan replacement</Link>}</td></tr>)}</tbody></table></div>{!page.items.length?<p>No equipment matches your search.</p>:null}<nav className={styles.bar}>{offset>0?<Link href={href(Math.max(0,offset-25))}>Previous</Link>:<span/>}{page.nextCursor||offset+25<(page.totalCount??0)?<Link href={href(offset+25)}>Next</Link>:null}</nav></section></div>;
}
