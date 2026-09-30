import { vendorFacingScope } from "@/lib/ops/public-visibility";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadOperatorSession } from "@/app/app/_data/operator-loader";
import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import { sentWorkSnapshot, canShareSentWork } from "@/lib/ops/sent-work-orders";
import { roleCan } from "@/components/ops/role-policy";
import { CopySentWorkLink } from "@/components/workspace/copy-sent-work-link";
import { formatOperationsDateTime } from "@/lib/ops/local-time";
import styles from "@/components/workspace/sent-work-orders.module.css";
export const metadata={title:"Sent work order"};
export default async function SentWorkOrderPage({params}:{params:Promise<{id:string;issuanceId:string}>}) {
  const {id,issuanceId}=await params;
  const session=await loadOperatorSession();
  const repository=await getServerOpsRepository();
  if(!await repository.getWorkOrderDetail(session,id))notFound();
  const [work,rows,active]=await Promise.all([repository.getWorkOrder(session.organizationId,id),repository.listIssuancesForWorkOrder(session.organizationId,id),repository.getActiveAssignment(session.organizationId,id)]);
  const issuance=rows.find(row=>row.id===issuanceId);
  if(!work || !issuance)notFound();
  const snapshot=sentWorkSnapshot(issuance);
  const back=`/app/work-orders/${encodeURIComponent(id)}?view=service`;
  if(!snapshot)return <section className={styles.panel}><Link href={back}>← Back to work order</Link><h1>Saved version unavailable</h1><p>This saved version could not be read. Current work-order details have not been substituted.</p></section>;
  const assignment=await repository.getAssignment(session.organizationId,issuance.assignmentId);
  const latest=[...rows].sort((a,b)=>b.revision-a.revision)[0];
  const date=(value:string)=>formatOperationsDateTime(value,snapshot.store.timeZone);
  return <article className={`${styles.panel} ${styles.document}`}>
    <Link href={back}>← Back to work order</Link>
    <header><p>Saved sent version · Read only</p><h1>{snapshot.workOrderNumber} · Version {issuance.revision}</h1><p>{snapshot.organizationName} · {date(issuance.issuedAt)}</p></header>
    <dl className={styles.metadata}>
      <div><dt>Vendor</dt><dd>{snapshot.vendor.name}</dd></div>
      <div><dt>Store</dt><dd>Store {snapshot.store.storeNumber} · {snapshot.store.name}</dd></div>
      <div><dt>Address</dt><dd>{snapshot.store.formattedAddress}</dd></div>
      <div><dt>Priority</dt><dd>{snapshot.priority}</dd></div>
      {snapshot.asset?<div><dt>Equipment</dt><dd>{snapshot.asset.name} · {snapshot.asset.assetTag}</dd></div>:null}
      {snapshot.categoryKey?<div><dt>Service type</dt><dd>{snapshot.categoryKey}</dd></div>:null}
      {snapshot.requestedTiming?<div><dt>Requested timing</dt><dd>{date(snapshot.requestedTiming)}</dd></div>:null}
    </dl>
    <section><h2>What’s wrong?</h2><p>{snapshot.problem}</p></section>
    <section><h2>Requested work</h2><p>{vendorFacingScope(snapshot.authorizedScope)}</p></section>
    {snapshot.dispatchMessage?<section><h2>Service note</h2><p>{snapshot.dispatchMessage}</p></section>:null}
    {snapshot.store.accessNotes?<section><h2>Access instructions</h2><p>{snapshot.store.accessNotes}</p></section>:null}
    {snapshot.offeredWork?.length?<section><h2>Additional work offered</h2>{snapshot.offeredWork.map(job=><div key={job.id}><strong>{job.number}</strong><p>{job.problem}</p></div>)}</section>:null}
    <section><h2>Billing instructions</h2><p>{snapshot.billingInstruction}</p></section>
    {roleCan(session,"issue_work_order") && canShareSentWork(work,issuance,latest,assignment,active)?<CopySentWorkLink workOrderId={id} issuanceId={issuance.id}/>:<p>This saved version remains available even when its vendor link is inactive.</p>}
  </article>;
}
