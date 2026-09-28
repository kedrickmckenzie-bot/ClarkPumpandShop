import {CapitalQuickEdit} from "@/components/workspace/capital-quick-edit";
import {roleCanAccessProgramRoute} from "@/components/ops/role-policy";
import Link from "next/link";
import {notFound} from "next/navigation";
import {loadOperatorSession} from "../_data/operator-loader";
import {getServerOpsRepository} from "@/lib/server/ops-repository-provider";
import {LifecycleRecordStack} from "@/components/workspace/lifecycle-record-stack";
import {loadLifecycleRecordStack} from "../_data/lifecycle-workspace-loader";
import {monthAfter,validMonth} from "@/lib/ops/capital-planning";
import styles from "@/components/workspace/compliance.module.css";
export const metadata={title:"Repair or replace"};
type Query=Record<string,string|string[]|undefined>;
export default async function LifecyclePage({searchParams}:{searchParams:Promise<Query>}) {
 const raw=await searchParams,q=Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,Array.isArray(v)?v[0]:v]));
 if(q.decision){const record=await loadLifecycleRecordStack(q.decision,raw);if(!record)notFound();const session=await loadOperatorSession(),repo=await getServerOpsRepository(),plans=await repo.listCapitalPlanHistory(session.organizationId,q.decision);return <LifecycleRecordStack {...record} plans={plans}/>;}
 const session=await loadOperatorSession(),repo=await getServerOpsRepository();
 if(!roleCanAccessProgramRoute(session.role,"lifecycle"))notFound();
 const view=q.view==="capital"?"capital":q.view==="history"?"history":"review",edit=["facilities","regional"].includes(session.role);
 const start=validMonth(q.start??"")?q.start!:new Date().toISOString().slice(0,7),months=[3,6,12,24].includes(Number(q.months))?Number(q.months):12,currency=/^[A-Z]{3}$/.test(q.currency??"")?q.currency!:"USD",offset=Math.min(100000,Math.max(0,Math.floor(Number(q.offset)||0)));
 const common={storeId:q.store,regionId:q.region,category:q.category,search:q.q?.slice(0,160),offset};
 const month=q.month&&(validMonth(q.month)||["undated","overdue"].includes(q.month))?q.month:undefined;
 const [filters,capital,queue]=await Promise.all([repo.getCapitalFilters(session),view==="capital"?repo.queryCapitalPlans(session,{...common,start,months,currency,month}):null,view!=="capital"?repo.queryLifecycleQueue(session,{...common,view}):null]);
 const href=(changes:Record<string,string>)=>{const params=new URLSearchParams();for(const [k,v] of Object.entries({...q,view,start,months:String(months),currency,offset:"0",...changes}))if(v)params.set(k,v);return `/app/lifecycle?${params}${changes.month?"#replacement-plans":""}`;};
 const money=(amount:number,unit=currency)=>new Intl.NumberFormat("en-US",{style:"currency",currency:unit,maximumFractionDigits:0}).format(amount/100);
 const dateLabel=(m:string)=>new Date(`${m}-01T12:00:00Z`).toLocaleDateString("en-US",{month:"short",year:"numeric",timeZone:"UTC"});
 const inWindow=capital?.buckets.filter(b=>validMonth(b.month))??[],total=capital?.total??queue?.total??0;
 return <div className={styles.page}>
 <header className={styles.header}><div><h1>Repair or replace</h1><p>Decide what to repair. Plan what to replace.</p></div>{edit?<Link className={styles.action} href={`/app/lifecycle/plan?returnTo=${encodeURIComponent(href({view:"capital",month:""}))}`}>Plan a replacement</Link>:null}</header>
 <nav className={styles.filters} aria-label="Replacement views">{[["review","Needs a decision"],["capital","Planned replacements"],["history","Decision history"]].map(([key,label])=><Link key={key} href={href({view:key,month:""})} aria-current={view===key?"page":undefined}>{label}</Link>)}</nav>
 <form className={`${styles.panel} ${styles.filters}`}><input type="hidden" name="view" value={view}/>
 <label>Search<input type="search" name="q" defaultValue={q.q} placeholder="Equipment, store number, name or address"/></label>
 <label>Store<select name="store" defaultValue={q.store??""}><option value="">All accessible stores</option>{filters.stores.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
 <label>Region<select name="region" defaultValue={q.region??""}><option value="">All regions</option>{filters.regions.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
 <label>Category<select name="category" defaultValue={q.category??""}><option value="">All categories</option>{filters.categories.map(c=><option key={c} value={c}>{c.replaceAll("_"," ")}</option>)}</select></label>
 {capital?<><label>Starting month<input type="month" name="start" defaultValue={start} required/></label><label>Look ahead<select name="months" defaultValue={months}>{[3,6,12,24].map(n=><option key={n} value={n}>{n} months</option>)}</select></label><label>Currency<select name="currency" defaultValue={currency}>{[...new Set([currency,...capital.currencies])].sort().map(c=><option key={c}>{c}</option>)}</select></label></>:null}<button>Apply</button><Link href={`/app/lifecycle?view=${view}`}>Clear</Link></form>
 {capital?<section className={styles.panel}><div className={styles.bar}><div><h2>Capital forecast · {currency}</h2><p><strong>{money(inWindow.reduce((n,b)=>n+b.amountMinor,0))}</strong> in known planned cost · {dateLabel(start)}–{dateLabel(monthAfter(start,months-1))}</p><small>{inWindow.reduce((n,b)=>n+b.missing,0)} replacements need a cost. Planning does not approve work.</small></div><Link href={href({month:""})}>Show all plans</Link></div>
 <div className={`${styles.scroll} ${styles.forecast}`}><table className={styles.table}><thead><tr><th>Target month</th><th>Plans</th><th>Known cost</th><th>Cost needed</th></tr></thead><tbody>{Array.from({length:months},(_,i)=>monthAfter(start,i)).map(m=>{const b=capital.buckets.find(b=>b.month===m);return <tr key={m}><td><Link href={href({month:m})}>{dateLabel(m)}</Link></td><td>{b?.count??0}</td><td>{money(b?.amountMinor??0)}</td><td>{b?.missing??0}</td></tr>;})}</tbody></table></div>
 <nav className={styles.filters}>{["overdue","undated"].map(m=>{const b=capital.buckets.find(b=>b.month===m);return <Link key={m} href={href({month:m})}>{m==="undated"?"Month needed":"Before planning window"}: {b?.count??0}</Link>;})}</nav></section>:null}
 <section className={styles.panel} id="replacement-plans"><h2>{capital?(month?(month==="undated"?"Month needed":month==="overdue"?"Before planning window":dateLabel(month)):"Replacement plans"):view==="history"?"Latest decisions":"Equipment awaiting a decision"}</h2>
 <div className={styles.scroll}><table className={`${styles.table} ${styles.vendorTable}`}><thead><tr><th>Equipment / store</th><th>{capital?"Target / owner":"Current issue"}</th><th>{capital?"Planned cost":"Repair estimate"}</th><th>{capital?"Priority / reason":"Decision"}</th><th>Actions</th></tr></thead><tbody>
 {capital?.items.map(r=><tr key={r.assetId}><td data-label="Equipment / store"><Link href={href({decision:r.assetId})}>{r.assetName}</Link><p>{r.storeNumber} · {r.storeName}</p><small>{r.assetTag}</small></td><td data-label="Target / owner">{r.targetMonth?dateLabel(r.targetMonth):`Month needed${r.legacyYear?` · ${r.legacyYear}`:""}`}<p>{r.owner}</p></td><td data-label="Planned cost">{r.amountMinor===undefined?"Cost needed":money(r.amountMinor)}<p>{r.costBasis}</p></td><td data-label="Priority / reason">{r.status} · {r.priority}<p>{r.reason||"No note"}</p></td><td data-label="Actions"><Link href={`/app/lifecycle/plan?asset=${encodeURIComponent(r.assetId)}&returnTo=${encodeURIComponent(href({}))}`}>{edit?"Full plan":"View plan"}</Link>{edit?<CapitalQuickEdit plan={r} returnTo={href({})}/>:null}</td></tr>)}
 {queue?.items.map(r=><tr key={r.id}><td data-label="Equipment / store"><Link href={href({decision:r.id})}>{r.name}</Link><p>{r.storeNumber} · {r.storeName}</p><small>{r.tag}</small></td><td data-label="Current issue">{r.problem}</td><td data-label="Repair estimate">{r.repairMinor===undefined?"Not entered":money(r.repairMinor,r.currency)}</td><td data-label="Decision">{view==="review"?"Needs a decision":r.decision??"Needs a decision"}{view==="history"&&r.decidedAt?<p>{r.decidedAt.slice(0,10)}</p>:null}</td><td data-label="Actions"><Link href={href({decision:r.id})}>Review equipment</Link></td></tr>)}
 </tbody></table></div>{!total?<p>{capital?"No replacement plans match this view. You can plan a replacement for any active equipment.":view==="history"?"No decisions recorded in this scope.":"No unresolved repair decisions in this scope."}</p>:null}
 <nav className={styles.bar} aria-label="Replacement pages">{offset>0?<Link href={href({offset:String(Math.max(0,offset-25))})}>Previous</Link>:<span/>}<span>{total} records</span>{offset+25<total?<Link href={href({offset:String(offset+25)})}>Next</Link>:null}</nav>
 </section></div>;
}
