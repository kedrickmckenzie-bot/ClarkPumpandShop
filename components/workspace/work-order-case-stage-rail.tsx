import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { WorkOrderCaseView } from "@/lib/ops/work-order-case";
import { formatOperationsDateTime } from "@/lib/ops/local-time";
import styles from "./owner-brief.module.css";

/**
 * The canonical stage rail for the work-order case header: one computed
 * plain-language stage, the accountable party, one primary next action, due
 * time, escalation destination, blocking reason, and contextual alternatives.
 * All values are projected from domain records - none are editable state.
 */
export function WorkOrderStageRail({ model }: { model: WorkOrderCaseView }) {
  const terminal = model.stage === "closed";
  const stageHref = (stageId: WorkOrderCaseView["stages"][number]["id"]) => {
    const view = stageId === "vendor_response_scheduling" || stageId === "authorization_or_bidding" || stageId === "provider_decision"
      ? "service"
      : stageId === "onsite_service"
        ? "visits"
        : stageId === "followup_closeout" || stageId === "closed"
          ? "activity"
          : stageId === "cost_invoice_evidence"
            ? "cost"
            : "overview";
    return `/app/work-orders/${model.workOrderId}?view=${view}`;
  };
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
            <Link className={styles.stageLink} href={stageHref(stage.id)}>
              <span className={styles.stageMarker} aria-hidden="true">{stage.state === "complete" ? "✓" : index + 1}</span>
              <span className={styles.stageCopy}>
                <strong>{stage.label}</strong>
                <small>{stage.state === "complete" ? "Complete" : stage.state === "current" ? "Current" : "Upcoming"}</small>
              </span>
              <ArrowRight aria-hidden="true" size={14} />
            </Link>
          </li>
        ))}
      </ol>

      <dl className={styles.factsRow}>
        <div>
          <dt>{terminal ? "Record" : "Owner"}</dt>
          <dd>{model.accountableParty}</dd>
        </div>
        <div>
          <dt>{terminal ? "Completed" : "Due"}</dt>
          <dd className={model.primaryActionOverdue ? styles.warningText : undefined}>
            {model.dueAt ? formatOperationsDateTime(model.dueAt, model.timeZone) : terminal ? "No open obligation" : "No due time recorded"}
            {model.primaryActionOverdue ? " · Overdue" : ""}
          </dd>
        </div>
        <div>
          <dt>{terminal ? "Escalation" : "If overdue, notify"}</dt>
          <dd>{model.escalationDestination}</dd>
        </div>
      </dl>

      {model.blockingReason ? (
        <p className={styles.decisionDetail}>Waiting on: {model.blockingReason}</p>
      ) : null}

      <div className={styles.moneyRow}>
        <Link className={styles.moneyCell} href={model.primaryNextAction.href}>
          <span className={styles.moneyLabel}>{terminal ? "Record" : "Recommended action"}</span>
          <strong>{model.primaryNextAction.label}</strong>
          <span className={styles.moneyNote}>{terminal ? "This case has no open action or escalation." : "The most likely action for this status; supporting records and other tools remain available."}</span>
          <span className={styles.actionPrompt}>Open action<ArrowRight aria-hidden="true" size={14} /></span>
        </Link>
      </div>
      {model.alternativeActions.length ? (
        <details className={styles.alternativeDisclosure}>
          <summary>Other actions and supporting records</summary>
          <div>
            {model.alternativeActions.map((action) => (
              <Link key={action.href + action.label} href={action.href}>
                <span>{action.label}</span><ArrowRight aria-hidden="true" size={14} />
              </Link>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}
