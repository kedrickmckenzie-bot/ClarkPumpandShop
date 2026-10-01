"use client";

import { CheckCircle2, ClipboardCheck, HelpCircle, RotateCcw } from "lucide-react";
import type { WorkOrderVerificationViewModel } from "@/app/app/_data/work-order-verification-presenter";
import styles from "./work-order-verification-panel.module.css";

function DecisionFence({ model }: { model: WorkOrderVerificationViewModel }) {
  return <>
    <input name="expectedWorkOrderVersion" type="hidden" value={model.expectedWorkOrderVersion} />
    <input name="expectedSiteVisitWorkOrderId" type="hidden" value={model.expectedSiteVisitWorkOrderId} />
    <input name="expectedOutcomeRecordedAt" type="hidden" value={model.expectedOutcomeRecordedAt} />
  </>;
}

function ConfirmationForm({ model }: { model: WorkOrderVerificationViewModel }) {
  return <form action={model.action} method="post" className={styles.form} onSubmit={event => {
    const form = event.currentTarget;
    const decision = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value");
    const notes = form.elements.namedItem("reason") as HTMLTextAreaElement;
    if (decision !== "verified" && !notes.value.trim()) {
      event.preventDefault();
      notes.setCustomValidity("Add a note about what needs follow-up or what you could not confirm.");
      notes.reportValidity();
    }
  }}>
    <DecisionFence model={model} />
    <input name="verificationScope" type="hidden" value="reported_problem" />
    <input name="basis" type="hidden" value="observable_result" />
    {model.correcting ? <label>Why are you correcting this result?<textarea name="correctionReason" required maxLength={2000} rows={2} /></label> : null}
    <label>Notes <span>Required if work needs follow-up or you’re not sure.</span>
      <textarea name="reason" onInput={event => event.currentTarget.setCustomValidity("")} maxLength={2000} placeholder="What did you find?" rows={2} />
    </label>
    {model.currentOutcome?.canConfirmAvoidedSeparateTrip ? <label className={styles.checkbox}>
      <input name="avoidedSeparateTripConfirmed" type="checkbox" value="true" />
      Confirm a separate trip was avoided
    </label> : null}
    <div className={styles.actions}>
      <button type="submit" name="decision" value="verified" onClick={event => (event.currentTarget.form?.elements.namedItem("reason") as HTMLTextAreaElement | null)?.setCustomValidity("")}><CheckCircle2 aria-hidden="true" size={18} />Yes, completed as expected</button>
      <button type="submit" name="decision" value="rejected"><RotateCcw aria-hidden="true" size={18} />No, needs follow-up</button>
      <button type="submit" name="decision" value="inconclusive"><HelpCircle aria-hidden="true" size={18} />I&apos;m not sure</button>
    </div>
  </form>;
}

export function WorkOrderVerificationPanel({ model }: { model: WorkOrderVerificationViewModel }) {
  if (!model.available) return null;
  const current = model.history.find(decision => decision.current);
  return <section className={styles.panel} id="work-verification" aria-labelledby="work-verification-heading">
    <header className={styles.header}>
      <ClipboardCheck aria-hidden="true" size={22} />
      <h3 id="work-verification-heading">{current ? "Work confirmation" : "Was the work completed as expected?"}</h3>
    </header>
    {current ? <div className={styles.result} data-tone={current.tone}>
      <strong>{current.decisionLabel}</strong>
      {current.reason ? <p>{current.reason}</p> : null}
      <span>{current.decidedByLabel} · {current.decidedLabel}</span>
    </div> : model.currentOutcome ? <div className={styles.outcome}>
      <strong>{model.currentOutcome.outcomeLabel}</strong>
      <span>{model.currentOutcome.technicianLabel} · {model.currentOutcome.recordedLabel}</span>
      {model.currentOutcome.notes ? <p>{model.currentOutcome.notes}</p> : null}
    </div> : null}
    {model.canDecide ? <ConfirmationForm model={model} /> : !current ? <p className={styles.empty}>{model.decisionBlockReason ?? model.permissionMessage}{model.permitted && !model.currentOutcome ? <> <a href={`/app/work-orders/${encodeURIComponent(model.workOrderId)}?view=visits`}>Record the result first →</a></> : null}</p> : null}
    {model.canCorrect ? <details className={styles.disclosure}><summary>Correct this confirmation</summary><ConfirmationForm model={model} /></details> : null}
    {model.canUseTechnicalBasis && model.currentOutcome && model.workOrderStatus !== "cancelled" ? <details className={styles.disclosure}>
      <summary>Correct the technician’s reported result</summary>
      <form action={model.action} method="post" className={styles.form}>
        <DecisionFence model={model} /><input type="hidden" name="action" value="correct-outcome" />
        <label>Correct result<select name="outcome" defaultValue={model.currentOutcome.outcome}><option value="completed">Work completed</option><option value="no_issue_found">No issue found</option><option value="return_visit_required">Return visit needed</option></select></label>
        <label>Why is the recorded result incorrect?<textarea name="reason" required maxLength={2000} rows={2} /></label>
        <div className={styles.actions}><button type="submit">Save correction</button></div>
      </form>
    </details> : null}
    {model.history.some(decision => !decision.current) || model.outcomeCorrections?.length ? <details className={styles.disclosure}>
      <summary>Confirmation and correction history</summary>
      <ol className={styles.history}>
        {model.history.map(decision => <li key={decision.id}><strong>{decision.decisionLabel}</strong>{decision.reason ? <p>{decision.reason}</p> : null}<span>{decision.decidedByLabel} · {decision.decidedLabel}</span></li>)}
        {model.outcomeCorrections?.map(change => <li key={change.id}><strong>{change.original} → {change.corrected}</strong><p>{change.reason}</p><span>{change.by} · {change.when}</span></li>)}
      </ol>
    </details> : null}
  </section>;
}
