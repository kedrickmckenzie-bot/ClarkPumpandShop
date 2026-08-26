import Link from "next/link";
import type { WorkOrderCaseView } from "@/lib/ops/work-order-case";
import styles from "./owner-brief.module.css";

/**
 * The canonical stage rail for the work-order case header: one computed
 * plain-language stage, the accountable party, one primary next action, due
 * time, escalation destination, blocking reason, and contextual alternatives.
 * All values are projected from domain records - none are editable state.
 */
export function WorkOrderStageRail({ model }: { model: WorkOrderCaseView }) {
  return (
    <section className={styles.brief} aria-labelledby="stage-rail-heading">
      <header className={styles.header}>
        <p className={styles.eyebrow}>{model.workOrderNumber}{model.storeName ? ` · ${model.storeName}` : ""}</p>
        <h2 id="stage-rail-heading">
          {model.stageLabel}
          {model.serviceSubStage ? ` — ${model.serviceSubStage.label}` : ""}
        </h2>
      </header>

      <ol className={styles.stageRail} aria-label="Service progress">
        {model.stages.map((stage, index) => (
          <li className={styles.stageStep} data-state={stage.state} key={stage.id} aria-current={stage.state === "current" ? "step" : undefined}>
            <span className={styles.stageMarker} aria-hidden="true">{stage.state === "complete" ? "✓" : index + 1}</span>
            <strong>{stage.label}</strong>
            <small>{stage.state === "complete" ? "Complete" : stage.state === "current" ? "Current" : "Upcoming"}</small>
          </li>
        ))}
      </ol>

      <dl className={styles.factsRow}>
        <div>
          <dt>Owner</dt>
          <dd>{model.accountableParty}</dd>
        </div>
        <div>
          <dt>Due</dt>
          <dd className={model.primaryActionOverdue ? styles.warningText : undefined}>
            {model.dueAt ? new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: model.timeZone, timeZoneName: "short" }).format(new Date(model.dueAt)) : "No due time recorded"}
            {model.primaryActionOverdue ? " · Overdue" : ""}
          </dd>
        </div>
        <div>
          <dt>If overdue, notify</dt>
          <dd>{model.escalationDestination}</dd>
        </div>
      </dl>

      {model.blockingReason ? (
        <p className={styles.decisionDetail}>Waiting on: {model.blockingReason}</p>
      ) : null}

      <div className={styles.moneyRow}>
        <Link className={styles.moneyCell} href={model.primaryNextAction.href}>
          <span className={styles.moneyLabel}>Next step</span>
          <strong>{model.primaryNextAction.label}</strong>
          <span className={styles.moneyNote}>The one action that moves this work forward.</span>
        </Link>
        {model.alternativeActions.map((action) => (
          <Link className={styles.moneyCell} key={action.href + action.label} href={action.href}>
            <span className={styles.moneyLabel}>Another option</span>
            <strong>{action.label}</strong>
          </Link>
        ))}
      </div>
    </section>
  );
}
