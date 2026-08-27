import { CheckCircle2, ClipboardCheck, RotateCcw, ShieldAlert } from "lucide-react";
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
          <p>Internal operating check</p>
          <h3 id="work-verification-heading">Verification, resolution, and closure</h3>
          <small>Technician evidence stays immutable. Internal review accepts or rejects one exact per-work-order outcome.</small>
        </div>
      </header>

      {model.currentOutcome ? (
        <article className={styles.outcome}>
          <div>
            <small>Current technician outcome</small>
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
            <input name="decision" type="hidden" value="verified" />
            <label>
              Verification note <span>Optional</span>
              <textarea name="reason" maxLength={2000} placeholder="What did store operations confirm?" rows={3} />
            </label>
            {model.currentOutcome?.canConfirmAvoidedSeparateTrip ? <label>
              <span><input name="avoidedSeparateTripConfirmed" type="checkbox" value="true" /> Confirm a separate trip was avoided</span>
              <small>Check only if this approved item would have required its own vendor visit. No dollar value is inferred.</small>
            </label> : null}
            <button type="submit"><CheckCircle2 aria-hidden="true" size={17} />Verify and mark resolved</button>
            <small>This creates a separate closure obligation. It does not close the work order automatically.</small>
          </form>

          <form action={model.action} method="post" className={styles.rejectForm}>
            <DecisionFence model={model} />
            <input name="decision" type="hidden" value="rejected" />
            <label>
              Rejection reason <span>Required</span>
              <textarea name="reason" maxLength={2000} required placeholder="What is still not operating correctly?" rows={3} />
            </label>
            <button type="submit"><RotateCcw aria-hidden="true" size={17} />Reject and require return work</button>
            <small>The prior visit and outcome remain visible; the work returns to an active service cycle.</small>
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
          <h4 id="verification-history-heading">Immutable decision history</h4>
          <span>{model.history.length} decision{model.history.length === 1 ? "" : "s"}</span>
        </header>
        {model.history.length ? (
          <ol>
            {model.history.map((decision) => (
              <li key={decision.id} data-tone={decision.tone}>
                <span aria-hidden="true" />
                <div>
                  <header><strong>Cycle {decision.cycle} · {decision.decisionLabel}</strong>{decision.current ? <em>Current outcome</em> : null}</header>
                  <p>{decision.outcomeLabel}{decision.reason ? ` — ${decision.reason}` : ""}{decision.avoidedSeparateTripConfirmed ? " · Separate trip explicitly confirmed as avoided" : ""}</p>
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
