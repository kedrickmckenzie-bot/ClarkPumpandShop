import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  History,
  MessageSquareText,
  PackageOpen,
  Scale,
  Wrench,
  X,
} from "lucide-react";
import type { DetailFactViewModel, DetailPageViewModel, TimelineEventViewModel, Tone } from "@/components/ops/data-contract";
import type { WorkOrderCaseView } from "@/lib/ops/work-order-case";
import { RecordSections } from "./record-sections";
import { WorkOrderStageRail } from "./work-order-case-stage-rail";
import styles from "./lifecycle-record-stack.module.css";

export interface LifecycleDecisionWorkspaceModel {
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

const toneClass: Record<Tone, string> = {
  neutral: styles.neutral,
  positive: styles.positive,
  warning: styles.warning,
  critical: styles.critical,
  info: styles.info,
};

function FactGrid({ facts }: { facts: DetailFactViewModel[] }) {
  return (
    <dl className={styles.recordFacts}>
      {facts.map((fact) => (
        <div key={fact.label}>
          <dt>{fact.label}</dt>
          <dd>{fact.value}</dd>
          {fact.helperText ? <small>{fact.helperText}</small> : null}
        </div>
      ))}
    </dl>
  );
}

function ActivityTimeline({ events }: { events: TimelineEventViewModel[] }) {
  return (
    <section className={styles.activity} aria-labelledby="decision-activity-heading">
      <header>
        <span><History aria-hidden="true" size={19} /></span>
        <div><p>Recorded history</p><h3 id="decision-activity-heading">Updates and communications</h3></div>
        <strong>{events.length} events</strong>
      </header>
      {events.length ? <ol>{events.map((event) => (
        <li key={event.id}>
          <i className={toneClass[event.tone ?? "neutral"]} aria-hidden="true" />
          <div>
            <header><strong>{event.title}</strong><time>{event.timestampLabel}</time></header>
            {event.description ? <p>{event.description}</p> : null}
            <footer>{event.actorLabel}</footer>
          </div>
        </li>
      ))}</ol> : <p className={styles.empty}>No communication or status history has been recorded yet.</p>}
    </section>
  );
}

function NestedRecord({
  kind,
  model,
  closeHref,
  fullHref,
  workOrderCase,
}: {
  kind: "work-order" | "equipment";
  model: DetailPageViewModel;
  closeHref: string;
  fullHref: string;
  workOrderCase?: WorkOrderCaseView;
}) {
  const noun = kind === "work-order" ? "work order" : "equipment record";
  return (
    <div className={styles.childLayer} role="dialog" aria-modal="true" aria-label={`Open ${noun}`}>
      <Link className={styles.childBackdrop} href={closeHref} aria-label={`Close ${noun}`} scroll={false} />
      <article className={styles.childPanel}>
        <header className={styles.childHeader}>
          <div>
            <p>{kind === "work-order" ? "Source work order" : "Source equipment record"}</p>
            <h2>{model.page.title}</h2>
            <span>{model.page.description}</span>
          </div>
          <div className={styles.childActions}>
            <Link href={fullHref} className={styles.fullRecordLink} aria-label={`Open full ${noun}`}>Open full page<ArrowUpRight aria-hidden="true" size={15} /></Link>
            <Link className={styles.closeButton} href={closeHref} aria-label={`Close ${noun}`} scroll={false}><X aria-hidden="true" size={20} /></Link>
          </div>
        </header>
        <div className={styles.childBody}>
          {workOrderCase ? <WorkOrderStageRail model={workOrderCase} /> : null}
          <section className={styles.recordSummary} aria-label={`${noun} summary`}>
            <header><div><p>Record summary</p><h3>At a glance</h3></div><span className={`${styles.status} ${toneClass[model.statusTone ?? "neutral"]}`}>{model.statusLabel}</span></header>
            <FactGrid facts={model.facts} />
          </section>
          <RecordSections sections={model.sections} />
        </div>
      </article>
    </div>
  );
}

export function LifecycleRecordStack({
  model,
  workOrderDetail,
  equipmentDetail,
  workOrderCase,
}: {
  model: LifecycleDecisionWorkspaceModel;
  workOrderDetail?: DetailPageViewModel;
  equipmentDetail: DetailPageViewModel;
  workOrderCase?: WorkOrderCaseView;
}) {
  return (
    <div className={styles.decisionLayer} role="dialog" aria-modal={model.activeChild ? undefined : "true"} aria-label={`Repair or replace ${model.assetName}`}>
      <Link className={styles.backdrop} href={model.closeHref} aria-label="Close repair decision" scroll={false} />
      <article className={styles.decisionPanel}>
        <header className={styles.decisionHeader}>
          <div className={styles.decisionHeading}>
            <p>Repair or replace decision</p>
            <div><h2>{model.assetName}</h2><span className={`${styles.status} ${toneClass[model.statusTone]}`}>{model.statusLabel}</span></div>
            <span>{model.storeLabel} · {model.assetTag}{model.workOrderNumber ? ` · ${model.workOrderNumber}` : ""}</span>
          </div>
          <Link className={styles.closeButton} href={model.closeHref} aria-label="Close repair decision" scroll={false}><X aria-hidden="true" size={20} /></Link>
        </header>

        <div className={styles.decisionBody}>
          <section className={styles.decisionCallout}>
            <span><Scale aria-hidden="true" size={22} /></span>
            <div><small>Decision in plain language</small><h3>{model.decisionLabel}</h3><p>{model.decisionHelper}</p></div>
          </section>

          <section className={styles.comparison} aria-label="Repair and replacement comparison">
            <div><span><Wrench aria-hidden="true" size={18} />Current repair</span><strong>{model.repairAmountLabel}</strong><p>Vendor price for this work order only.</p></div>
            <div><span><PackageOpen aria-hidden="true" size={18} />Installed replacement</span><strong>{model.replacementAmountLabel}</strong><p>Current planning estimate for this equipment.</p></div>
            <div><span><Scale aria-hidden="true" size={18} />Repair share</span><strong>{model.repairShareLabel}</strong><p>Repair price as a share of installed replacement.</p></div>
            <div><span><CalendarClock aria-hidden="true" size={18} />Service needed to justify repair</span><strong>{model.requiredRunwayLabel}</strong><p>Entered service estimate: {model.enteredServiceLabel}.</p></div>
          </section>

          <section className={styles.accountability} aria-label="Decision accountability">
            <div><small>Owner</small><strong>{model.ownerLabel}</strong></div>
            <div><small>Next step</small><strong>{model.nextActionLabel}</strong></div>
            <div><small>Due</small><strong>{model.dueLabel}</strong></div>
          </section>

          <div className={styles.sourceActions}>
            {model.openWorkOrderHref ? <Link href={model.openWorkOrderHref} scroll={false}><span><ClipboardList aria-hidden="true" size={20} /></span><div><small>Service execution</small><strong>Open work order</strong><p>See the vendor stage, assignment, visits, cost, and closeout.</p></div><ArrowUpRight aria-hidden="true" size={17} /></Link> : null}
            <Link href={model.openEquipmentHref} scroll={false}><span><Building2 aria-hidden="true" size={20} /></span><div><small>Equipment history</small><strong>Open equipment</strong><p>See repair history, components, warranty, PM, and lifecycle evidence.</p></div><ArrowUpRight aria-hidden="true" size={17} /></Link>
          </div>

          <section className={styles.contextFacts}>
            <header><MessageSquareText aria-hidden="true" size={18} /><div><p>Decision context</p><h3>What else should be considered</h3></div></header>
            <ul>{model.contextFacts.map((fact) => <li key={fact}><CheckCircle2 aria-hidden="true" size={16} />{fact}</li>)}</ul>
          </section>

          <ActivityTimeline events={model.activity} />
        </div>
      </article>

      {model.activeChild === "work-order" && workOrderDetail && model.workOrderId ? <NestedRecord kind="work-order" model={workOrderDetail} closeHref={model.childCloseHref} fullHref={`/app/work-orders/${encodeURIComponent(model.workOrderId)}`} workOrderCase={workOrderCase} /> : null}
      {model.activeChild === "equipment" ? <NestedRecord kind="equipment" model={equipmentDetail} closeHref={model.childCloseHref} fullHref={`/app/equipment/${encodeURIComponent(model.assetId)}`} /> : null}
    </div>
  );
}
