import Link from "next/link";
import { notFound } from "next/navigation";
import { loadOperatorSession } from "@/app/app/_data/operator-loader";
import { getRequestOpsFixtureSnapshot } from "@/app/app/_data/request-data";
import { roleCan, roleCanAccessProgramRoute } from "@/components/ops/role-policy";
import { effectivePmStatus } from "@/lib/ops/pm-occurrence-state";
import { formatOperationsDateTime } from "@/lib/ops/local-time";
import styles from "@/components/ops/warranty-finance-workspace.module.css";

export default async function OccurrencePage({params,searchParams}: {params:Promise<{id:string}>;searchParams:Promise<{returnTo?:string}>}) {
  const {id}=await params, query=await searchParams, session=await loadOperatorSession();
  if(!roleCanAccessProgramRoute(session.role,"pm"))notFound();
  const fixture=await getRequestOpsFixtureSnapshot(session.organizationId);
  const occurrence=fixture.pmOccurrences.find(row=>row.organizationId===session.organizationId && row.id===id);
  const store=fixture.stores.find(row=>row.organizationId===session.organizationId && row.id===occurrence?.storeId);
  if(!occurrence || !store || session.storeIds!==undefined&&!session.storeIds.includes(store.id) || session.regionIds!==undefined&&!session.regionIds.includes(store.regionId??""))notFound();
  const plan=fixture.pmPlans.find(row=>row.organizationId===session.organizationId && row.id===occurrence.planId);
  const asset=fixture.assets.find(row=>row.organizationId===session.organizationId && row.id===occurrence.assetId);
  const work=fixture.workOrders.find(row=>row.organizationId===session.organizationId && row.storeId===store.id && row.id===occurrence.workOrderId);
  const status=effectivePmStatus(occurrence,fixture.asOf);
  const links=fixture.siteVisitWorkOrders.filter(row=>row.organizationId===session.organizationId && row.workOrderId===work?.id);
  const visits=fixture.visits.filter(row=>row.organizationId===session.organizationId && row.storeId===store.id && links.some(link=>link.visitId===row.id));
  const back=query.returnTo?.startsWith("/app/pm?") ? query.returnTo : "/app/pm";
  const date=(value:string)=>formatOperationsDateTime(value,store.timeZone);
  return <div className={styles.page}>
    <Link href={back}>← Back to PM</Link>
    <header className={styles.header}><div><h1>{plan?.name??"Planned maintenance"}</h1><p><Link href={`/app/stores/${store.id}`}>Store {store.storeNumber}</Link>{asset?<> · <Link href={`/app/equipment/${asset.id}`}>{asset.name}</Link></>:null}</p></div><strong>{status}</strong></header>
    <section className={styles.metrics} aria-label="Maintenance window"><div className={styles.metric}><span>Starts</span><strong>{date(occurrence.windowStartsAt)}</strong></div><div className={styles.metric}><span>Due</span><strong>{date(occurrence.dueAt)}</strong></div><div className={styles.metric}><span>Ends</span><strong>{date(occurrence.windowEndsAt)}</strong></div></section>
    <section className={styles.panel}><div className={styles.panelHeader}><h2>What is recorded</h2></div><div className={styles.body}><p>{occurrence.result??"No result recorded."}</p>{occurrence.completedAt?<p>Completed {date(occurrence.completedAt)}</p>:null}{occurrence.exceptionReason?<p>{occurrence.exceptionReason}</p>:null}{work?<p><Link href={`/app/work-orders/${work.id}`}>{work.number} →</Link></p>:<p>No work order linked.</p>}{visits.length?<ul>{visits.map(visit=><li key={visit.id}><Link href={`/app/visits/${visit.id}`}>Visit · {date(visit.checkedInAt)}</Link></li>)}</ul>:<p>No visit recorded.</p>}</div></section>
    <nav aria-label="PM record actions">{plan?<Link className={styles.secondaryButton} href={`/app/pm/plans/${plan.id}`}>View plan</Link>:null}{!work && ["due","missed","scheduled"].includes(status) && roleCan(session,"create_work_order")?<Link className={styles.button} href={`/app/work-orders/new?pmOccurrence=${occurrence.id}`}>Create work order</Link>:null}</nav>
  </div>;
}
