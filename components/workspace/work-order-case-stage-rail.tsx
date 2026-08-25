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

      <ol className={styles.factsRow} aria-label="Canonical service stages">
        {model.stages.map((stage) => (
          <li key={stage.id} aria-current={stage.state === "current" ? "step" : undefined}>
            <strong>{stage.label}</strong>
            <small>{stage.state === "complete" ? "Done" : stage.state === "current" ? "You are here" : ""}</small>
          </li>
        ))}
      </ol>

      <dl className={styles.factsRow}>
        <div>
          <dt>Accountable</dt>
          <dd>{model.accountableParty}</dd>
        </div>
        <div>
          <dt>Due</dt>
          <dd>{model.dueAt ? new Date(model.dueAt).toLocaleString("en-US") : "No due time recorded"}</dd>
        </div>
        <div>
          <dt>Escalates to</dt>
          <dd>{model.escalationDestination}</dd>
        </div>
      </dl>

      {model.blockingReason ? (
        <p className={styles.decisionDetail}>Blocking: {model.blockingReason}</p>
      ) : null}

      <div className={styles.moneyRow}>
        <Link className={styles.moneyCell} href={model.primaryNextAction.href}>
          <span className={styles.moneyLabel}>Next required action</span>
          <strong>{model.primaryNextAction.label}</strong>
          <span className={styles.moneyNote}>One primary action for this stage — projected from open records</span>
        </Link>
        {model.alternativeActions.map((action) => (
          <Link className={styles.moneyCell} key={action.href + action.label} href={action.href}>
            <span className={styles.moneyLabel}>Alternative</span>
            <strong>{action.label}</strong>
          </Link>
        ))}
      </div>
    </section>
  );
}