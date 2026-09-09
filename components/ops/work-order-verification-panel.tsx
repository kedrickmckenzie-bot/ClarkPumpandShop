import { CheckCircle2, ClipboardCheck, HelpCircle, RotateCcw, ShieldAlert } from "lucide-react";
import type { WorkOrderVerificationViewModel } from "@/app/app/_data/work-order-verification-presenter";
import styles from "./work-order-verification-panel.module.css";

function DecisionFence({ model }: { model: WorkOrderVerificationViewModel }) {
  return (
    <>
      <input name="expectedWorkOrderVersion" type="hidden" value={model.expectedWorkOrderVersion} />
      <input name="expectedSiteVisitWorkOrderId" type="hidden" value={model.expectedSiteVisitWorkOrderId} />
      <input name="expectedOutcomeRecordedAt" type="hidden" value={model.expectedOutcomeRecordedAt} />
    </>
  );
}

export function WorkOrderVerificationPanel({ model }: { model: WorkOrderVerificationViewModel }) {
  if (!model.available) return null;

  return (
    <section className={styles.panel} id="work-verification" aria-labelledby="work-verification-heading">
      <header className={styles.header}>
        <span><ClipboardCheck aria-hidden="true" size={20} /></span>
        <div>
          <p>Store result check</p>
          <h3 id="work-verification-heading">Is the reported problem fixed?</h3>
          <small>Confirm only what you can observe. This does not certify the technician&apos;s methods, labor, or invoice.</small>
        </div>
      </header>

      {model.currentOutcome ? (
        <article className={styles.outcome}>
          <div>
            <small>Original reported problem</small>
            <strong>{model.originalProblem}</strong>
          </div>
          <div>
            <small>Latest provider result</small>
            <strong>{model.currentOutcome.outcomeLabel}</strong>
            <span>{model.currentOutcome.technicianLabel} · {model.currentOutcome.recordedLabel}</span>
          </div>
          <p>{model.currentOutcome.notes ?? "No technician outcome note was provided."}</p>
        </article>
      ) : (
        <p className={styles.empty}>No per-work-order checkout outcome is available for internal verification.</p>
      )}

      {model.canDecide && model.expectedSiteVisitWorkOrderId && model.expectedOutcomeRecordedAt ? (
        <div className={styles.decisions}>
          <form action={model.action} method="post" className={styles.acceptForm}>
            <DecisionFence model={model} />
            <label>
              What are you confirming?
              <select name="verificationScope" defaultValue="reported_problem">
                <option value="reported_problem">The reported problem</option>
                <option value="pm_task">The visible PM result</option>
                {model.canUseTechnicalBasis ? <option value="technical_work">Technical work and evidence</option> : null}
              </select>
            </label>
            {model.canUseTechnicalBasis ? <label>
              Basis for this decision
              <select name="basis" defaultValue="observable_result">
                <option value="observable_result">What can be observed now</option>
                <option value="technical_evidence">Technical evidence</option>
                <option value="operational_review">Facilities operations review</option>
              </select>
            </label> : <input name="basis" type="hidden" value="observable_result" />}
            <label>
              What did you observe? <span>Required for “not fixed” or “not sure”</span>
              <textarea name="reason" maxLength={2000} placeholder="For example: case temperature is holding at 36°F, or the alarm returned after 20 minutes." rows={3} />
            </label>
            {model.currentOutcome?.canConfirmAvoidedSeparateTrip ? <label>
              <span><input name="avoidedSeparateTripConfirmed" type="checkbox" value="true" /> Confirm a separate trip was avoided</span>
              <small>Check only if this approved item would have required its own vendor visit. No dollar value is inferred.</small>
            </label> : null}
            <div className={styles.decisions}>
              <button type="submit" name="decision" value="verified"><CheckCircle2 aria-hidden="true" size={17} />Yes, it&apos;s fixed</button>
              <button type="submit" name="decision" value="rejected"><RotateCcw aria-hidden="true" size={17} />No, it&apos;s not fixed</button>
              <button type="submit" name="decision" value="inconclusive"><HelpCircle aria-hidden="true" size={17} />I&apos;m not sure</button>
            </div>
            <small>Eligible routine work may close automatically. Invoice or cost review remains open and separate.</small>
          </form>
        </div>
      ) : (
        <div className={styles.blocked}>
          <ShieldAlert aria-hidden="true" size={18} />
          <div><strong>Decision unavailable</strong><p>{model.decisionBlockReason ?? model.permissionMessage}</p></div>
        </div>
      )}

      <section className={styles.history} aria-labelledby="verification-history-heading">
        <header>
          <h4 id="verification-history-heading">Confirmation history</h4>
          <span>{model.history.length} decision{model.history.length === 1 ? "" : "s"}</span>
        </header>
        {model.history.length ? (
          <ol>
            {model.history.map((decision) => (
              <li key={decision.id} data-tone={decision.tone}>
                <span aria-hidden="true" />
                <div>
                  <header><strong>Cycle {decision.cycle} · {decision.decisionLabel}</strong>{decision.current ? <em>Current outcome</em> : null}</header>
                  <p>{decision.outcomeLabel} · {decision.scopeLabel} · {decision.basisLabel}{decision.reason ? ` — ${decision.reason}` : ""}{decision.avoidedSeparateTripConfirmed ? " · Separate trip explicitly confirmed as avoided" : ""}</p>
                  <small>{decision.decidedByLabel} · {decision.decidedLabel}</small>
                </div>
              </li>
            ))}
          </ol>
        ) : <p className={styles.empty}>No internal verification decisions have been recorded.</p>}
      </section>
    </section>
  );
}
