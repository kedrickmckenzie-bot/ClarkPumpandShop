import Link from "next/link";
import type { DetailPageViewModel, TimelineEventViewModel, Tone } from "@/components/ops/data-contract";
import type { WorkOrderCaseView } from "@/lib/ops/work-order-case";
import type { lifecyclePriceEvidence } from "@/lib/ops/lifecycle-price-evidence";
import type { WorkReviewModel } from "@/lib/ops/work-review";
import { WorkReviewButton } from "./work-review";
import styles from "./lifecycle-record-stack.module.css";

export interface LifecycleDecisionWorkspaceModel {
  prices?: ReturnType<typeof lifecyclePriceEvidence>;
  review?: WorkReviewModel;
  assetId: string;
  assetName: string;
  assetTag: string;
  storeLabel: string;
  statusLabel: string;
  statusTone: Tone;
  description: string;
  workOrderId?: string;
  workOrderNumber?: string;
  repairAmountLabel: string;
  replacementAmountLabel: string;
  repairShareLabel: string;
  requiredRunwayLabel: string;
  enteredServiceLabel: string;
  decisionLabel: string;
  decisionHelper: string;
  ownerLabel: string;
  nextActionLabel: string;
  dueLabel: string;
  contextFacts: string[];
  activity: TimelineEventViewModel[];
  closeHref: string;
  openWorkOrderHref?: string;
  openEquipmentHref: string;
  childCloseHref: string;
  activeChild?: "work-order" | "equipment";
}

export function LifecycleRecordStack({ model }: { model: LifecycleDecisionWorkspaceModel; equipmentDetail?: DetailPageViewModel; workOrderDetail?: DetailPageViewModel; workOrderCase?: WorkOrderCaseView }) {
  const prices = model.prices;
  const review = model.review;
  return <main className={styles.page}>
    <Link className={styles.back} href={model.closeHref}>← Back to replacement planning</Link>
    <header className={styles.heading}>
      <div><p>Repair or replace</p><h1>{model.assetName}</h1><span>{model.storeLabel} · {model.assetTag}{model.workOrderNumber ? ` · ${model.workOrderNumber}` : ""}</span></div>
      <strong className={styles.status}>{model.statusLabel}</strong>
    </header>
    <p className={styles.problem}>{model.description}</p>
    <section className={styles.prices} aria-label="Repair and replacement prices">
      <div><h2>Repair price</h2><strong>{model.repairAmountLabel}</strong><p>Estimate entered on this work order.</p>{model.workOrderId ? <Link href={`/app/work-orders/${model.workOrderId}?view=overview`}>Review the repair estimate</Link> : <Link href={model.openEquipmentHref}>Add the missing repair information</Link>}</div>
      <div><h2>{prices?.replacementBasis ?? "Replacement quote"}</h2><strong>{model.replacementAmountLabel}</strong><p>{prices?.approvedVendor ?? (prices?.quotes.length ? "Review the available vendor quotes below." : "No vendor replacement quote has been selected.")}</p><a href="#replacement-quotes">Review replacement scope and quotes ↓</a></div>
      <div><h2>Planning estimate</h2><strong>{prices?.planningLabel ?? "Not entered"}</strong><p>Equipment planning reference. This is separate from the vendor’s quote and approved amount.</p><Link href={model.openEquipmentHref}>Review the planning source</Link></div>
    </section>
    {prices?.finalAmount ? <p className={styles.notice}>Final replacement amount recorded: <strong>{prices.finalAmount}</strong>. The approved amount above remains part of the decision history.</p> : null}
    {prices?.missing ? <p className={styles.notice}>{prices.missing}</p> : null}
    <section className={styles.next} aria-labelledby="decision-next">
      <div><h2 id="decision-next">What happens next</h2><p>{model.nextActionLabel}</p><span>{model.ownerLabel} · Due {model.dueLabel}</span></div>
      {model.openWorkOrderHref ? <Link className={styles.action} href={model.openWorkOrderHref}>Continue {model.workOrderNumber ?? "existing work"} →</Link> : <Link className={styles.action} href={model.openEquipmentHref}>Review equipment and open work →</Link>}
    </section>
    <nav className={styles.sections} aria-label="Decision sections"><a href="#replacement-quotes">Quotes and scope</a><a href="#decision-history">Repair history and warranty</a><a href="#decision-method">Comparison details</a><a href="#decision-activity">Decision history</a></nav>
    <section className={styles.section} id="replacement-quotes"><h2>Replacement quotes and what they include</h2><p>{prices?.scope}</p>
      {prices?.quotes.length ? <div className={styles.quotes}>{prices.quotes.map((quote) => <article key={quote.id}><header><div><h3>{quote.vendor}</h3><span>{quote.status}</span></div><strong>{quote.amount}</strong></header><dl><div><dt>Included work</dt><dd>{quote.scope}</dd></div><div><dt>Not included / needs checking</dt><dd>{quote.exclusions}</dd></div><div><dt>Availability</dt><dd>{quote.timing}</dd></div></dl><Link href={quote.href}>Open the quote and its recorded decision →</Link></article>)}</div> : <p>No replacement quote is recorded here. {model.workOrderId ? <Link href={`/app/work-orders/${model.workOrderId}?view=service&path=bids`}>Request replacement pricing for this work order</Link> : <Link href={model.openEquipmentHref}>Open equipment to start a pricing request</Link>}.</p>}
    </section>
    <section className={styles.section} id="decision-history"><h2>Repair history and warranty</h2>
      {review ? <><p><strong>{review.outcome.label}.</strong> {review.outcome.detail}</p><div className={styles.history}><div><h3>Earlier work on this equipment scope</h3>{review.related.length ? <ul>{review.related.map((row) => <li key={row.id}><strong>{row.label}</strong><p>{row.detail}</p>{row.href ? <><Link href={row.href}>Open repair record</Link> <WorkReviewButton href={row.href} label={row.label} context="Repair or replace · related equipment work" /></> : null}</li>)}</ul> : <p>No earlier work is recorded for this scope.</p>}</div><div><h3>Warranty evidence</h3>{review.warranties.length ? <ul>{review.warranties.map((row) => <li key={row.id}><strong>{row.label}</strong><p>{row.detail}</p>{row.href ? <Link href={row.href}>Review warranty evidence →</Link> : null}</li>)}</ul> : <p>No warranty terms are recorded for this work. Check coverage before approving another charge.</p>}</div></div></> : <p>No current service record is attached. The equipment history remains available below.</p>}
      <Link href={model.openEquipmentHref}>Open the complete equipment history →</Link>
    </section>
    <details className={styles.section} id="decision-method"><summary>How the repair comparison was calculated</summary><dl className={styles.method}><div><dt>Repair compared with replacement</dt><dd>{model.repairShareLabel}</dd></div><div><dt>Service needed for the repair to match replacement cost per year</dt><dd>{model.requiredRunwayLabel}</dd></div><div><dt>Estimated service after repair</dt><dd>{model.enteredServiceLabel}</dd></div></dl><p>The comparison uses {prices?.replacement ? "the selected or approved replacement amount" : "the planning estimate because a replacement quote has not been selected"}. It does not predict failures or make the decision for you. Costs in different currencies are not compared.</p><ul>{model.contextFacts.map((fact) => <li key={fact}>{fact}</li>)}</ul></details>
    <section className={styles.section} id="decision-activity"><h2>Decision history</h2><p><strong>{model.decisionLabel}.</strong> {model.decisionHelper}</p>{model.activity.length ? <ol className={styles.timeline}>{model.activity.map((event) => <li key={event.id}><div><strong>{event.title}</strong><time>{event.timestampLabel}</time></div><p>{event.description}</p><span>{event.actorLabel}</span></li>)}</ol> : <p>No decision history has been recorded.</p>}</section>
  </main>;
}
