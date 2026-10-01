import Link from "next/link";
import { loadOperatorSession } from "@/app/app/_data/operator-loader";
import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import { workWarrantyReview } from "@/lib/ops/work-warranty-review";
import { formatOperationsDate } from "@/lib/ops/local-time";
import { RecordForm } from "@/components/ops/record-form";
import styles from "./work-warranty-context.module.css";

export async function WorkWarrantyContext({workOrderId}:{workOrderId:string}) {
  const session=await loadOperatorSession(), repository=await getServerOpsRepository();
  const review=await workWarrantyReview(repository,session,workOrderId,new Date().toISOString().slice(0,10));
  if(!review) {
    const work=await repository.getWorkOrderDetail(session,workOrderId);
    if(!work || work.asset || !work.categoryKey) return null;
    const coverage=await repository.listWarrantyDirectory({...session,storeIds:[work.storeId]},{today:new Date().toISOString().slice(0,10),view:"active",categoryKey:work.categoryKey,limit:1});
    if(!coverage.totalCount)return null;
    return <aside className={styles.banner} id="work-warranty"><strong>This store has active {work.categoryKey.replaceAll("_"," ")} warranties.</strong><p><Link href={`/app/work-orders/${workOrderId}?view=equipment#work-records`}>Link the equipment to check coverage →</Link></p></aside>;
  }
  if(!review?.coverage.totalCount) return null;
  const {coverage,decision,work}=review;
  const originalWork=new Map(await Promise.all([...new Set(coverage.items.flatMap(c=>c.workId?[c.workId]:[]))].map(async id=>[id,await repository.getWorkOrderDetail(session,id)] as const)));
  return <section className={styles.banner} data-dismissed={Boolean(decision)} id="work-warranty" aria-labelledby="work-warranty-title">
    <h2 id="work-warranty-title">{decision ? "Warranty reviewed" : "This may be under warranty"}</h2>
    <p>{work.asset?.name}{work.component ? ` · ${work.component.name}` : ""}</p>
    {!decision ? <p>{[...new Set(coverage.items.map(c=>c.provider))].join(" · ")}</p> : null}
    {decision ? <p>{JSON.parse(decision.payloadJson).reason} · {decision.actorName} · {formatOperationsDate(decision.occurredAt)}</p> : <p>Check coverage with the listed provider before agreeing to charges.</p>}
    <details>
      <summary>See warranty details ({coverage.totalCount})</summary>
      <ul className={styles.terms}>{coverage.items.map(c=><li key={c.id}>
        <strong>{c.provider} · {c.component ?? "Whole equipment"}</strong>
        <span>{c.title} · {formatOperationsDate(c.start)}–{formatOperationsDate(c.end)}</span>
        <span>Parts: {c.parts} · Labor: {c.labor} · Travel: {c.travel} · Diagnostic: {c.diagnostic}</span>
        {c.replacementDate ? <span>Replacement recorded {formatOperationsDate(c.replacementDate)}</span> : null}
        <Link href={`/app/warranties/coverage/${encodeURIComponent(c.id)}`}>Terms and documents →</Link>
        {c.workId && originalWork.get(c.workId) ? <Link href={`/app/work-orders/${encodeURIComponent(c.workId)}`}>Original work: {originalWork.get(c.workId)!.number} →</Link> : null}
      </li>)}</ul>
      {coverage.nextOffset !== undefined ? <Link href={`/app/equipment/${work.asset!.id}#equipment-warranties`}>All equipment coverage →</Link> : null}
    </details>
    {!decision && ["executive","facilities","regional"].includes(session.role) ? <details>
      <summary>Not a warranty issue</summary>
      <RecordForm action="/api/ops/warranties/dismiss" offerSavedWork={false}>
        <input type="hidden" name="workId" value={workOrderId}/><input type="hidden" name="signature" value={review.signature}/>
        <label>Reason<textarea name="reason" required maxLength={2000} rows={2}/></label>
        <button type="submit">Save decision</button>
      </RecordForm>
    </details> : null}
  </section>;
}
