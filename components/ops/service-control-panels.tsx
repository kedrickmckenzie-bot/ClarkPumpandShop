"use client";

import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  CircleDot,
  ClipboardCheck,
  Clock3,
  MessageSquareText,
  RefreshCw,
  Route,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type {
  ApprovalDecisionViewModel,
  AttentionItemControlViewModel,
  RequestReviewViewModel,
  SelectOptionViewModel,
  WorkOrderControlViewModel,
  WorkflowStageViewModel,
} from "./data-contract";
import styles from "./ops.module.css";
import { domainLabel } from "@/lib/product/domain-label";
import { DEFAULT_OPERATIONS_TIME_ZONE, formatOperationsDateTime } from "@/lib/ops/local-time";

type MutationState = { pending: boolean; error?: string };

function useMutation() {
  const [state, setState] = useState<MutationState>({ pending: false });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setState({ pending: true });
    try {
      const response = await fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        credentials: "same-origin",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        setState({ pending: false, error: payload?.error ?? "The update could not be recorded." });
        return;
      }
      window.location.assign(response.url || window.location.href);
    } catch {
      setState({ pending: false, error: "The update could not be recorded. Check your connection and try again." });
    }
  }

  return { state, submit };
}

function MutationError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className={styles.controlError} role="alert"><AlertTriangle aria-hidden="true" size={17} />{message}</p>;
}

const receiptMessages: Record<string, string> = {
  review: "Request review decision recorded in the audit history.",
  "impact-review": "Business impact confirmed or revised; the request review task and audit history were updated atomically.",
  control: "Work state, ownership, deadline, and next action updated.",
  "approval-approved": "Authorization approved and the accountable work-order state updated.",
  "approval-rejected": "Authorization rejected with an immutable decision record.",
  "approval-escalated": "Authorization escalated and the next accountable approval review created.",
  "vendor-response": "Attributed vendor response recorded against the current authorization.",
  acknowledge: "Exception acknowledged and kept visible for follow-up.",
  resolve: "Exception review completed; the triggering fact remains in history.",
  reconcile: "Visit linked by an auditable amendment; the original unmatched check-in remains preserved.",
  update: "Follow-up owner, action, deadline, and escalation updated.",
  complete: "Follow-up completed and the work order's next action recalculated.",
  classification: "Service area, equipment, and component classification updated with an auditable note.",
  cost: "Recorded work cost added to this work order and portfolio reporting.",
  "bid-request-created": "Work order created for pricing. Send bid requests below; no vendor is assigned and no site visit is authorized.",
  "service-work-created": "Work order created with a chosen service vendor. Review the service details below, then send the authorization.",
  "estimate-selected": "Vendor bid selected. Competing bid requests were closed; service is still not authorized until the work order is sent below.",
  "estimate-withdrawn": "Bid request withdrawn. No assignment, service authorization, visit, cost, or invoice was created.",
  "estimate-reopened": "Provider decision reopened. The prior selection remains in history, and another bid can now be selected.",
  "workflow-task-created": "Workflow Task created without overwriting any simultaneous obligation.",
  "workflow-task-start": "Workflow Task started and its accountable projection refreshed.",
  "workflow-task-complete": "Workflow Task completed with an immutable resolution note.",
  "workflow-task-cancel": "Workflow Task cancelled with its reason preserved in history.",
  "workflow-task-pause": "SLA pause recorded with its reason, owner, and affected clocks.",
  "workflow-task-resume": "SLA clock resumed; the original hold remains in history.",
  "workflow-task-escalate": "Workflow Task escalated one level with a recorded reason.",
};

export function MutationReceipt({ code }: { code?: string }) {
  const message = code ? receiptMessages[code] : undefined;
  if (!message) return null;
  return <p className={styles.controlSuccess} role="status"><CheckCircle2 aria-hidden="true" size={18} />{message}</p>;
}

function PanelHeading({ id, icon, title, description }: { id: string; icon: ReactNode; title: string; description: string }) {
  return (
    <div className={styles.controlHeading}>
      <span>{icon}</span>
      <div><h2 id={id}>{title}</h2><p>{description}</p></div>
    </div>
  );
}

function SelectField({ id, name, label, options, defaultValue, required = true, helper }: {
  id: string;
  name: string;
  label: string;
  options: SelectOptionViewModel[];
  defaultValue?: string;
  required?: boolean;
  helper?: string;
}) {
  return (
    <label className={styles.field} htmlFor={id}>
      <span>{label}{required ? <em>Required</em> : <small>Optional</small>}</span>
      <select id={id} name={name} required={required} defaultValue={defaultValue ?? ""}>
        {!defaultValue ? <option value="" disabled={required}>Select an option</option> : null}
        {options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
      </select>
      {helper ? <small>{helper}</small> : null}
    </label>
  );
}

function textDateTime(value?: string, timeZone = DEFAULT_OPERATIONS_TIME_ZONE) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Not set";
  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/u.test(value) ? value : `${value}:00Z`;
  return formatOperationsDateTime(normalized, timeZone);
}

function inputDateTime(value?: string) {
  if (!value) return "";
  const localShape = value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/u)?.[0];
  return localShape ?? (Number.isFinite(Date.parse(value)) ? new Date(value).toISOString().slice(0, 16) : "");
}

function stageIcon(stage: WorkflowStageViewModel) {
  if (stage.state === "complete") return <CheckCircle2 aria-hidden="true" size={18} />;
  if (stage.state === "current") return <CircleDot aria-hidden="true" size={18} />;
  if (stage.state === "blocked") return <AlertTriangle aria-hidden="true" size={18} />;
  return <Circle aria-hidden="true" size={18} />;
}

function WorkflowStages({ stages }: { stages: WorkflowStageViewModel[] }) {
  return (
    <ol className={styles.workflowStages} aria-label="Work-order progress">
      {stages.map((stage) => (
        <li data-state={stage.state} key={stage.id}>
          <span>{stageIcon(stage)}</span>
          <div><strong>{stage.label}</strong><p>{stage.detail}</p>{stage.timestampLabel ? <small>{stage.timestampLabel}</small> : null}</div>
        </li>
      ))}
    </ol>
  );
}

export function RequestReviewPanel({ model }: { model: RequestReviewViewModel }) {
  const impactMutation = useMutation();
  const decisionMutation = useMutation();
  const linkMutation = useMutation();
  const [decision, setDecision] = useState("escalate");
  if (!model.available) return null;
  const impact = model.latestImpact;
  const answerOptions = [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }, { value: "unknown", label: "Not sure" }];
  const hiddenImpactInputs = (
    <>
      <input type="hidden" name="storeOperatingState" value={impact?.storeOperatingState ?? "unknown"} />
      <input type="hidden" name="safetyConcern" value={impact?.safetyConcern ?? "unknown"} />
      <input type="hidden" name="productInventoryRisk" value={impact?.productInventoryRisk ?? "unknown"} />
      <input type="hidden" name="productInventoryValue" value={impact?.productInventoryValueInput ?? ""} />
      <input type="hidden" name="customersAffected" value={impact?.customersAffected ?? "unknown"} />
      <input type="hidden" name="complianceImpact" value={impact?.complianceImpact ?? "unknown"} />
      <input type="hidden" name="capacityUnavailablePercent" value={impact?.capacityUnavailablePercentInput ?? ""} />
      <input type="hidden" name="redundantEquipment" value={impact?.redundantEquipment ?? "unknown"} />
      <input type="hidden" name="revenueFunctionImpact" value={impact?.revenueFunctionImpact ?? ""} />
      <input type="hidden" name="estimatedDailyRevenueExposure" value={impact?.estimatedDailyRevenueExposureInput ?? ""} />
      <input type="hidden" name="estimatedDowntimeMinutes" value={impact?.estimatedDowntimeMinutesInput ?? ""} />
      <input type="hidden" name="confidence" value={impact?.confidence ?? "low"} />
      <input type="hidden" name="impactNotes" value={impact?.notes ?? ""} />
    </>
  );

  return (
    <section className={styles.controlPanel} id="request-review" aria-labelledby="request-review-heading">
      <PanelHeading
        id="request-review-heading"
        icon={<ClipboardCheck aria-hidden="true" size={19} />}
        title="Review the request"
        description={model.pendingApproval ? "The request facts are preserved. Complete the current approval before creating work." : "Confirm what was reported, then decide whether to create work, escalate it, or close it."}
      />
      <div className={styles.controlSummary}>
        <span><small>Request</small><strong>{model.reference}</strong></span>
        <span><small>Current state</small><strong>{model.statusLabel}</strong></span>
        <span><small>Store operation</small><strong>{impact ? domainLabel(impact.storeOperatingState) : "Not assessed"}</strong></span>
        <span><small>Safety</small><strong>{impact ? domainLabel(impact.safetyConcern) : "Not assessed"}</strong></span>
        <span><small>Product risk</small><strong>{impact ? domainLabel(impact.productInventoryRisk) : "Not assessed"}</strong></span>
      </div>
      {model.pendingApproval ? <PendingApprovalPanel approval={model.pendingApproval} /> : null}
      {!model.permitted ? <p className={styles.inlineEmpty}>Your role can review this request but cannot record a decision.</p> : (
        <>
          {!model.pendingApproval ? <div className={styles.subControlPanel}>
            <div className={styles.subControlHeading}><ShieldCheck aria-hidden="true" size={18} /><div><h3>Choose what happens next</h3><p>Most requests can move directly into a work order. Equipment and detailed impact can remain unknown.</p></div></div>
            {model.relatedOpenWork.length ? <div className={styles.controlForm}>
              <div className={styles.subControlHeading}><Route aria-hidden="true" size={18} /><div><h3>Potentially related open work at this store</h3><p>Review before dispatching again. Linking preserves this report and does not create another assignment or authorization.</p></div></div>
              <div className={styles.controlSummary}>{model.relatedOpenWork.map((work) => <Link href={`/app/work-orders/${work.id}`} key={work.id}><small>{work.number} · {work.statusLabel}</small><strong>{work.problem}</strong><small>Internal owner: {work.internalOwner}</small></Link>)}</div>
              {model.linkExistingWorkAction ? <form action={model.linkExistingWorkAction} method="post" onSubmit={linkMutation.submit} className={styles.controlForm}>
                <input type="hidden" name="expectedStatus" value="under_review" />
                <SelectField id={`related-work-${model.requestId}`} name="workOrderId" label="Link this report to existing work" options={model.relatedOpenWork.map((work) => ({ value: work.id, label: `${work.number} — ${work.problem}` }))} helper="The original report and manager-reviewed impact remain unchanged and auditable." />
                <MutationError message={linkMutation.state.error} />
                <div className={styles.formFooter}><span className={styles.formMeta}>No duplicate dispatch, visit, or cost record will be created.</span><button className={styles.secondaryButton} type="submit" disabled={linkMutation.state.pending}>{linkMutation.state.pending ? "Linking…" : "Link report to this work"}</button></div>
              </form> : <p className={styles.inlineEmpty}>Confirm the report facts before linking it to existing work.</p>}
            </div> : null}
            {model.canCreateWorkOrder && model.createWorkOrderHref ? (
              <div className={styles.formFooter}><span className={styles.formMeta}>The manager review is complete. Define the work and choose the service path next.</span><Link className={styles.primaryButton} href={model.createWorkOrderHref}>Create work order<ShieldCheck aria-hidden="true" size={17} /></Link></div>
            ) : model.impactReviewed ? (
              <p className={styles.inlineEmpty}><strong>Request facts reviewed.</strong> {model.pendingApproval ? "Complete the authorization decision above before creating work." : "An authorized facilities operator can create the work order."}</p>
            ) : (
              <form action={model.impactSubmitAction} method="post" onSubmit={impactMutation.submit} className={styles.controlForm}>
                <input type="hidden" name="expectedRequestStatus" value={model.expectedStatus} />
                {impact ? <input type="hidden" name="expectedLatestAssessmentId" value={impact.id} /> : null}
                <input type="hidden" name="disposition" value="confirmed" />
                {model.canPrepareWorkOrder && model.createWorkOrderHref ? <input type="hidden" name="continueTo" value={model.createWorkOrderHref} /> : null}
                {hiddenImpactInputs}
                <MutationError message={impactMutation.state.error} />
                <div className={styles.formFooter}><span className={styles.formMeta}>Confirm the known facts without inventing details. Unknown answers remain visibly unknown.</span><button className={styles.primaryButton} type="submit" disabled={impactMutation.state.pending}>{impactMutation.state.pending ? "Recording…" : model.canPrepareWorkOrder ? "Confirm & create work order" : "Confirm request facts"}<ShieldCheck aria-hidden="true" size={17} /></button></div>
              </form>
            )}
          </div> : null}

          <details className={`${styles.subControlPanel} ${styles.controlDisclosure}`}>
            <summary className={styles.subControlHeading}><ClipboardCheck aria-hidden="true" size={18} /><div><h3>Add or correct business impact</h3><p>Optional detail for meaningful safety, product, compliance, capacity, or revenue exposure.</p></div></summary>
            <form action={model.impactSubmitAction} method="post" onSubmit={impactMutation.submit} className={styles.controlForm}>
              <input type="hidden" name="expectedRequestStatus" value={model.expectedStatus} />
              {impact ? <input type="hidden" name="expectedLatestAssessmentId" value={impact.id} /> : null}
              <SelectField id={`impact-disposition-${model.requestId}`} name="disposition" label="Manager assessment" defaultValue="revised" options={[{ value: "confirmed", label: "Confirm the reported facts" }, { value: "revised", label: "Add or correct facts" }]} helper="Earlier reports remain visible in the assessment history." />
              <div className={styles.fieldGrid}>
                <SelectField id={`impact-operation-${model.requestId}`} name="storeOperatingState" label="Store operating state" defaultValue={impact?.storeOperatingState ?? "unknown"} options={[{ value: "open", label: "Open" }, { value: "partially_operational", label: "Partially operational" }, { value: "unable_to_operate", label: "Unable to operate" }, { value: "unknown", label: "Not sure" }]} />
                <SelectField id={`impact-safety-${model.requestId}`} name="safetyConcern" label="Safety concern" defaultValue={impact?.safetyConcern ?? "unknown"} options={[{ value: "none_reported", label: "None reported" }, { value: "potential", label: "Potential concern" }, { value: "immediate", label: "Immediate concern" }, { value: "unknown", label: "Not sure" }]} />
                <SelectField id={`impact-inventory-${model.requestId}`} name="productInventoryRisk" label="Product or inventory risk" defaultValue={impact?.productInventoryRisk ?? "unknown"} options={[{ value: "none_reported", label: "None reported" }, { value: "at_risk", label: "At risk" }, { value: "loss_reported", label: "Loss reported" }, { value: "unknown", label: "Not sure" }]} />
                <SelectField id={`impact-customers-${model.requestId}`} name="customersAffected" label="Customers affected" defaultValue={impact?.customersAffected ?? "unknown"} options={answerOptions} />
                <SelectField id={`impact-compliance-${model.requestId}`} name="complianceImpact" label="Compliance impact" defaultValue={impact?.complianceImpact ?? "unknown"} options={[{ value: "none_reported", label: "None reported" }, { value: "potential", label: "Potential impact" }, { value: "confirmed", label: "Confirmed impact" }, { value: "unknown", label: "Not sure" }]} />
                <SelectField id={`impact-redundancy-${model.requestId}`} name="redundantEquipment" label="Backup equipment available" defaultValue={impact?.redundantEquipment ?? "unknown"} options={answerOptions} />
              </div>
              <div className={styles.fieldGrid}>
                <label className={styles.field} htmlFor={`impact-inventory-value-${model.requestId}`}><span>Product value at risk <small>Optional · USD</small></span><input id={`impact-inventory-value-${model.requestId}`} name="productInventoryValue" type="number" min="0" step="0.01" defaultValue={impact?.productInventoryValueInput} /></label>
                <label className={styles.field} htmlFor={`impact-capacity-${model.requestId}`}><span>Capacity unavailable <small>Optional · percent</small></span><input id={`impact-capacity-${model.requestId}`} name="capacityUnavailablePercent" type="number" min="0" max="100" step="0.01" defaultValue={impact?.capacityUnavailablePercentInput} /></label>
                <SelectField id={`impact-revenue-${model.requestId}`} name="revenueFunctionImpact" label="Revenue function affected" required={false} defaultValue={impact?.revenueFunctionImpact} options={[{ value: "fuel", label: "Fuel" }, { value: "foodservice", label: "Foodservice" }, { value: "refrigerated_merchandise", label: "Refrigerated merchandise" }, { value: "beverages", label: "Beverages" }, { value: "lottery", label: "Lottery" }, { value: "car_wash", label: "Car wash" }, { value: "other", label: "Other" }]} />
                <label className={styles.field} htmlFor={`impact-revenue-value-${model.requestId}`}><span>Estimated daily revenue exposure <small>Optional · USD</small></span><input id={`impact-revenue-value-${model.requestId}`} name="estimatedDailyRevenueExposure" type="number" min="0" step="0.01" defaultValue={impact?.estimatedDailyRevenueExposureInput} /></label>
                <label className={styles.field} htmlFor={`impact-downtime-${model.requestId}`}><span>Estimated downtime <small>Optional · minutes</small></span><input id={`impact-downtime-${model.requestId}`} name="estimatedDowntimeMinutes" type="number" min="0" step="1" defaultValue={impact?.estimatedDowntimeMinutesInput} /></label>
                <SelectField id={`impact-confidence-${model.requestId}`} name="confidence" label="Confidence" defaultValue={impact?.confidence ?? "low"} options={[{ value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }]} />
              </div>
              <label className={styles.field} htmlFor={`impact-notes-${model.requestId}`}><span>Review notes <small>Optional</small></span><textarea id={`impact-notes-${model.requestId}`} name="impactNotes" rows={3} defaultValue={impact?.notes} /></label>
              <p className={styles.inlineEmpty}><strong>About these estimates.</strong> {model.impactCaveat}</p>
              <MutationError message={impactMutation.state.error} />
              <div className={styles.formFooter}><span className={styles.formMeta}>This appends a manager assessment; it never rewrites the employee report.</span><button className={styles.primaryButton} type="submit" disabled={impactMutation.state.pending}>{impactMutation.state.pending ? "Recording…" : "Save assessment"}<ShieldCheck aria-hidden="true" size={17} /></button></div>
            </form>
          </details>

          <details className={`${styles.subControlPanel} ${styles.controlDisclosure}`}>
            <summary className={styles.subControlHeading}><Route aria-hidden="true" size={18} /><div><h3>Escalate or close without work</h3><p>Use these paths only when this request should not become a work order now.</p></div></summary>
            <form action={model.submitAction} method="post" onSubmit={decisionMutation.submit} className={styles.controlForm}>
              <input type="hidden" name="expectedStatus" value={model.expectedStatus} />
              <label className={styles.field} htmlFor={`request-decision-${model.requestId}`}><span>Decision <em>Required</em></span><select id={`request-decision-${model.requestId}`} name="decision" required value={decision} onChange={(event) => setDecision(event.target.value)}><option value="escalate">Escalate for a higher-level decision</option><option value="close">Close without creating work</option></select></label>
              <label className={styles.field} htmlFor={`request-note-${model.requestId}`}><span>Reason <em>Required</em></span><textarea id={`request-note-${model.requestId}`} name="note" rows={3} required placeholder={decision === "close" ? "Explain why no work order is needed." : "Explain what decision or authority is needed."} /></label>
              <MutationError message={decisionMutation.state.error} />
              <div className={styles.formFooter}><button className={styles.secondaryButton} type="submit" disabled={decisionMutation.state.pending}>{decisionMutation.state.pending ? "Recording…" : decision === "close" ? "Close request" : "Escalate request"}</button></div>
            </form>
          </details>

          {model.impactHistory.length ? <details className={`${styles.subControlPanel} ${styles.controlDisclosure}`}><summary className={styles.subControlHeading}><ClipboardCheck aria-hidden="true" size={18} /><div><h3>Earlier updates</h3><p>{model.impactHistory.length} recorded update{model.impactHistory.length === 1 ? "" : "s"}.</p></div></summary><ol className={styles.timeline}>{model.impactHistory.map((item) => <li key={item.id}><span className={styles.timelineDot} /><div><strong>{item.kindLabel}</strong><p>{item.summary}</p><small>{item.provenanceLabel}</small></div></li>)}</ol></details> : null}
        </>
      )}
    </section>
  );
}

function WorkOrderControlForm({ model }: { model: WorkOrderControlViewModel }) {
  const { state, submit } = useMutation();
  const [status, setStatus] = useState(model.status);
  const terminal = status === "closed" || status === "cancelled";

  return (
    <form action={model.submitAction} method="post" onSubmit={submit} className={styles.controlForm}>
      <input type="hidden" name="operation" value="update" />
      <input type="hidden" name="expectedStatus" value={model.expectedStatus} />
      <div className={styles.fieldGrid}>
        <label className={styles.field} htmlFor={`work-status-${model.workOrderId}`}>
          <span>Status <em>Required</em></span>
          <select id={`work-status-${model.workOrderId}`} name="status" required value={status} onChange={(event) => setStatus(event.target.value)}>
            {model.statusOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
          </select>
          <small>Only valid next states are available.</small>
        </label>
        <SelectField id={`work-priority-${model.workOrderId}`} name="priority" label="Priority" options={model.priorityOptions} defaultValue={model.priority} />
      </div>
      {!terminal ? (
        <div className={styles.accountabilityFields}>
          <div className={styles.fieldGrid}>
            <label className={styles.field} htmlFor={`work-owner-${model.workOrderId}`}><span>Owner <em>Required</em></span><input id={`work-owner-${model.workOrderId}`} name="accountableParty" required defaultValue={model.accountableParty} /></label>
            <label className={styles.field} htmlFor={`work-due-${model.workOrderId}`}><span>Due <em>Required</em></span><input id={`work-due-${model.workOrderId}`} name="dueAt" type="datetime-local" required defaultValue={model.dueInputValue ?? inputDateTime(model.dueAt)} /></label>
          </div>
          <label className={styles.field} htmlFor={`work-next-${model.workOrderId}`}><span>Next step <em>Required</em></span><input id={`work-next-${model.workOrderId}`} name="nextAction" required defaultValue={model.nextAction} /></label>
          <label className={styles.field} htmlFor={`work-escalation-${model.workOrderId}`}><span>If overdue, notify <em>Required</em></span><input id={`work-escalation-${model.workOrderId}`} name="escalationTo" required defaultValue={model.escalationTo} /></label>
        </div>
      ) : (
        <div className={styles.controlWarning}><AlertTriangle aria-hidden="true" size={18} /><p>Closing or cancelling removes the active owner and next action. The historical record and all evidence remain available.</p></div>
      )}
      <label className={styles.field} htmlFor={`work-note-${model.workOrderId}`}>
        <span>Update note <em>Required</em></span>
        <textarea id={`work-note-${model.workOrderId}`} name="note" required minLength={3} rows={3} placeholder="Explain what changed, what was confirmed, or why this state is appropriate." />
      </label>
      <MutationError message={state.error} />
      <div className={styles.formFooter}><span className={styles.formMeta}>Current owner: {model.accountableParty}</span><button className={styles.primaryButton} type="submit" disabled={state.pending}>{state.pending ? "Recording…" : "Record work update"}<RefreshCw aria-hidden="true" size={17} /></button></div>
    </form>
  );
}

function CloseoutChecklistForm({ model }: { model: WorkOrderControlViewModel }) {
  const { state, submit } = useMutation();
  const closeout = model.closeout;
  if (!closeout) return null;
  return (
    <div className={styles.subControlPanel} id="manager-closeout">
      <div className={styles.subControlHeading}><ClipboardCheck aria-hidden="true" size={18} /><div><h3>Manager closeout checklist</h3><p>Review the final operating evidence here. Invoices and deep equipment classification remain optional; explicitly deferring them is valid and visible.</p></div></div>
      {!closeout.ready ? <div className={styles.controlWarning}><AlertTriangle aria-hidden="true" size={18} /><p>Closure is not ready. Complete the verified outcome and all required follow-ups first.</p></div> : null}
      <form action={model.submitAction} method="post" onSubmit={submit} className={styles.controlForm}>
        <input type="hidden" name="operation" value="closeout" />
        <input type="hidden" name="expectedStatus" value={model.expectedStatus} />
        <input type="hidden" name="priority" value={model.priority} />
        <div className={styles.closeoutChecklist}>
          <label htmlFor={`closeout-outcome-${model.workOrderId}`}><span className={styles.visuallyHidden}>Verified outcome reviewed</span><input id={`closeout-outcome-${model.workOrderId}`} type="checkbox" name="outcomeReviewed" required /><span><strong>Verified outcome reviewed</strong><small>{closeout.outcomeLabel}</small></span></label>
          <label htmlFor={`closeout-evidence-${model.workOrderId}`}><span className={styles.visuallyHidden}>Visit evidence reviewed</span><input id={`closeout-evidence-${model.workOrderId}`} type="checkbox" name="evidenceReviewed" required /><span><strong>Visit evidence reviewed</strong><small>{closeout.visitEvidenceLabel}</small></span></label>
          <label htmlFor={`closeout-cost-${model.workOrderId}`}><span className={styles.visuallyHidden}>Cost and invoice evidence reviewed or deferred</span><input id={`closeout-cost-${model.workOrderId}`} type="checkbox" name="costReviewed" required /><span><strong>Cost and optional invoice evidence reviewed or deferred</strong><small>{closeout.costEvidenceLabel} · {closeout.invoiceEvidenceLabel}</small></span></label>
          <label htmlFor={`closeout-classification-${model.workOrderId}`}><span className={styles.visuallyHidden}>Equipment classification confirmed or deferred</span><input id={`closeout-classification-${model.workOrderId}`} type="checkbox" name="classificationReviewed" required /><span><strong>Equipment classification confirmed or deferred</strong><small>{closeout.classificationLabel}</small></span></label>
          <label htmlFor={`closeout-followups-${model.workOrderId}`} data-ready={closeout.openFollowUpCount === 0 ? "true" : "false"}><span className={styles.visuallyHidden}>No unresolved follow-up remains</span><input id={`closeout-followups-${model.workOrderId}`} type="checkbox" name="followUpsReviewed" required disabled={closeout.openFollowUpCount > 0} /><span><strong>No unresolved follow-up remains</strong><small>{closeout.openFollowUpCount ? `${closeout.openFollowUpCount} follow-up${closeout.openFollowUpCount === 1 ? "" : "s"} must be completed first` : "No open follow-ups"}</small></span></label>
        </div>
        <label className={styles.field} htmlFor={`closeout-note-${model.workOrderId}`}><span>Closeout note <em>Required</em></span><textarea id={`closeout-note-${model.workOrderId}`} name="note" required minLength={3} rows={3} placeholder="Summarize the verified outcome and any intentionally deferred cost, invoice, or equipment details." /></label>
        <MutationError message={state.error} />
        <div className={styles.formFooter}><span className={styles.formMeta}>Closure is explicit, attributable, and reversible only through a new auditable action.</span><button className={styles.primaryButton} type="submit" disabled={!closeout.ready || state.pending}>{state.pending ? "Closing…" : "Close verified work order"}<CheckCircle2 aria-hidden="true" size={17} /></button></div>
      </form>
    </div>
  );
}

function ApprovalDecisionForm({ approval }: { approval: ApprovalDecisionViewModel }) {
  const { state, submit } = useMutation();
  const [decision, setDecision] = useState<ApprovalDecisionViewModel["decisionOptions"][number]["value"]>("approved");
  const selectedOption = approval.decisionOptions.find((option) => option.value === decision) ?? approval.decisionOptions[0];

  return (
    <form action={approval.decisionAction} method="post" onSubmit={submit} className={styles.controlForm}>
      <label className={styles.field} htmlFor={`approval-decision-${approval.requestId}`}>
        <span>Approval decision <em>Required</em></span>
        <select
          id={`approval-decision-${approval.requestId}`}
          name="decision"
          required
          value={decision}
          onChange={(event) => setDecision(event.target.value as typeof decision)}
        >
          {approval.decisionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <small>{selectedOption?.description}</small>
      </label>
      <label className={styles.field} htmlFor={`approval-reason-${approval.requestId}`}>
        <span>Decision reason {selectedOption?.reasonRequired ? <em>Required</em> : <small>Optional</small>}</span>
        <textarea
          id={`approval-reason-${approval.requestId}`}
          name="reason"
          rows={3}
          required={selectedOption?.reasonRequired}
          placeholder={decision === "approved" ? "Add approval context for the permanent record." : "Explain why this authorization is being rejected or escalated."}
        />
        <small>A reason is required for rejection or escalation and optional for approval.</small>
      </label>
      <MutationError message={state.error} />
      <div className={styles.formFooter}>
        <span className={styles.formMeta}>The policy version and presented amount remain immutable.</span>
        <button className={styles.primaryButton} type="submit" disabled={state.pending}>
          {state.pending ? "Recording…" : "Record approval decision"}<ShieldCheck aria-hidden="true" size={17} />
        </button>
      </div>
    </form>
  );
}

function PendingApprovalPanel({ approval }: { approval: ApprovalDecisionViewModel }) {
  return (
    <div className={styles.subControlPanel} id="approval-decision">
      <div className={styles.subControlHeading}>
        <ShieldCheck aria-hidden="true" size={18} />
        <div>
          <h3>Approval needed</h3>
          <p>This {approval.subjectLabel} is above the current approval limit. A person with the role below must decide it.</p>
        </div>
      </div>
      <div className={styles.controlSummary}>
        <span><small>Approval rule</small><strong>{approval.policyName} · version {approval.policyVersion}</strong></span>
        <span><small>Amount</small><strong>{approval.amountLabel}</strong></span>
        <span><small>Who can approve</small><strong>{approval.requiredRoleLabel}</strong></span>
        <span><small>Due</small><strong>{approval.dueLabel}</strong></span>
      </div>
      {approval.canDecide
        ? <ApprovalDecisionForm approval={approval} />
        : <p className={styles.inlineEmpty}>{approval.decisionAccessMessage}</p>}
    </div>
  );
}

function ManualVendorResponseForm({ model }: { model: WorkOrderControlViewModel }) {
  const { state, submit } = useMutation();
  const [response, setResponse] = useState("accepted");
  const target = model.manualVendorResponseTarget;
  if (!model.canRecordManualVendorResponse || !target) return null;

  return (
    <details className={`${styles.subControlPanel} ${styles.controlDisclosure}`}>
      <summary className={styles.subControlHeading}><MessageSquareText aria-hidden="true" size={18} /><div><h3>Record a response received outside the platform</h3><p>Use this when a vendor replied by phone, email, or in person. The record preserves who entered it and who responded.</p></div></summary>
      <form action={model.manualResponseAction} method="post" onSubmit={submit} className={styles.controlForm}>
        <input type="hidden" name="operation" value="vendor_response" />
        <input type="hidden" name="expectedAssignmentId" value={target.expectedAssignmentId} />
        <input type="hidden" name="expectedIssuanceId" value={target.expectedIssuanceId} />
        <input type="hidden" name="expectedIssuanceRevision" value={target.expectedIssuanceRevision} />
        <div className={styles.fieldGrid}>
          <label className={styles.field} htmlFor={`vendor-response-${model.workOrderId}`}>
            <span>Vendor response <em>Required</em></span>
            <select id={`vendor-response-${model.workOrderId}`} name="response" required value={response} onChange={(event) => setResponse(event.target.value)}>
              {model.vendorResponseOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className={styles.field} htmlFor={`vendor-source-${model.workOrderId}`}>
            <span>Response received by <em>Required</em></span>
            <select id={`vendor-source-${model.workOrderId}`} name="responseSource" required defaultValue="phone">
              <option value="phone">Phone</option><option value="email">Email</option><option value="in_person">In person</option><option value="other">Other documented channel</option>
            </select>
          </label>
        </div>
        <label className={styles.field} htmlFor={`vendor-responder-${model.workOrderId}`}><span>Vendor contact name <em>Required</em></span><input id={`vendor-responder-${model.workOrderId}`} name="responderName" required autoComplete="name" /></label>
        {response === "proposed_date" ? <label className={styles.field} htmlFor={`vendor-proposed-${model.workOrderId}`}><span>Proposed service date <em>Required</em></span><input id={`vendor-proposed-${model.workOrderId}`} name="proposedAt" type="datetime-local" required /></label> : null}
        <label className={styles.field} htmlFor={`vendor-message-${model.workOrderId}`}><span>Response details{response === "declined" || response === "question" ? <em>Required</em> : <small>Optional</small>}</span><textarea id={`vendor-message-${model.workOrderId}`} name="message" rows={3} required={response === "declined" || response === "question"} placeholder="Record the vendor's words or a concise factual summary." /></label>
        <MutationError message={state.error} />
        <div className={styles.formFooter}><button className={styles.secondaryButton} type="submit" disabled={state.pending}>{state.pending ? "Recording…" : "Record attributed response"}</button></div>
      </form>
    </details>
  );
}

function CreateFollowUpForm({ model }: { model: WorkOrderControlViewModel }) {
  const { state, submit } = useMutation();
  return (
    <details className={`${styles.subControlPanel} ${styles.controlDisclosure}`} id="follow-up-control">
      <summary className={styles.subControlHeading}><Clock3 aria-hidden="true" size={18} /><div><h3>Add another follow-up</h3><p>Track a separate callback, parts check, site confirmation, or vendor commitment with its own owner and due time.</p></div></summary>
      <form action={model.followUpAction} method="post" onSubmit={submit} className={styles.controlForm}>
        <label className={styles.field} htmlFor={`follow-up-next-${model.workOrderId}`}><span>What needs to happen? <em>Required</em></span><input id={`follow-up-next-${model.workOrderId}`} name="nextAction" required maxLength={500} placeholder="Confirm parts arrival with vendor" /></label>
        <div className={styles.fieldGrid}>
          <label className={styles.field} htmlFor={`follow-up-owner-${model.workOrderId}`}><span>Owner <em>Required</em></span><input id={`follow-up-owner-${model.workOrderId}`} name="accountableParty" required maxLength={200} defaultValue={model.accountableParty} /></label>
          <label className={styles.field} htmlFor={`follow-up-due-${model.workOrderId}`}><span>Due <em>Required</em></span><input id={`follow-up-due-${model.workOrderId}`} name="dueAt" type="datetime-local" required defaultValue={model.dueInputValue ?? inputDateTime(model.dueAt)} /></label>
        </div>
        <label className={styles.field} htmlFor={`follow-up-escalation-${model.workOrderId}`}><span>If overdue, notify <em>Required</em></span><input id={`follow-up-escalation-${model.workOrderId}`} name="escalationTo" required maxLength={200} defaultValue={model.escalationTo} /></label>
        <MutationError message={state.error} />
        <div className={styles.formFooter}><span className={styles.formMeta}>This adds a distinct obligation; it does not replace another open follow-up.</span><button className={styles.secondaryButton} type="submit" disabled={state.pending}>{state.pending ? "Adding…" : "Add follow-up"}</button></div>
      </form>
    </details>
  );
}

function InternalAccountabilityForm({ model }: { model: WorkOrderControlViewModel }) {
  const { state, submit } = useMutation();
  const owner = model.internalAccountability;
  const defaultValue = owner.ownerType && owner.ownerId
    ? `${owner.ownerType}:${owner.ownerId}`
    : "team:facilities-coordination";
  return (
    <details className={`${styles.subControlPanel} ${styles.controlDisclosure}`}>
      <summary className={styles.subControlHeading}>
        <UserRound aria-hidden="true" size={18} />
        <div>
          <h3>Internal accountability</h3>
          <p>{owner.structured ? "A persisted membership or team owns the customer-side follow-through." : "This older record has only a display label. Assign a persisted owner before relying on named accountability."}</p>
        </div>
      </summary>
      <form action={owner.reassignAction} method="post" onSubmit={submit} className={styles.controlForm}>
        <input type="hidden" name="operation" value="reassign_internal_owner" />
        <input type="hidden" name="expectedVersion" value={model.expectedVersion} />
        <SelectField id={`internal-owner-${model.workOrderId}`} name="internalOwner" label="Customer-side owner" defaultValue={defaultValue} options={owner.options} />
        <label className={styles.field} htmlFor={`internal-owner-reason-${model.workOrderId}`}>
          <span>Reassignment reason <em>Required</em></span>
          <textarea id={`internal-owner-reason-${model.workOrderId}`} name="reason" required minLength={3} rows={3} placeholder="Explain why this membership or team now owns internal follow-through." />
        </label>
        <MutationError message={state.error} />
        <div className={styles.formFooter}>
          <span className={styles.formMeta}>Vendor-owned next actions stay with the vendor; their escalation route follows the internal owner.</span>
          <button className={styles.secondaryButton} type="submit" disabled={state.pending}>{state.pending ? "Reassigning…" : "Reassign internal owner"}</button>
        </div>
      </form>
    </details>
  );
}

export function WorkOrderControlPanel({ model }: { model: WorkOrderControlViewModel }) {
  if (!model.available) return null;
  return (
    <section className={styles.controlPanel} id="work-control" aria-labelledby="work-control-heading">
      <PanelHeading
        id="work-control-heading"
        icon={<Route aria-hidden="true" size={19} />}
        title="Service control"
        description="Keep one primary next action on the case, with as many separately owned follow-ups and due times as the work requires."
      />
      <WorkflowStages stages={model.stages} />
      <div className={styles.controlSummary}>
        <span><small>Current owner</small><strong>{model.accountableParty}</strong></span>
        <span><small>Next action</small><strong>{model.nextAction}</strong></span>
        <span><small>Due</small><strong>{textDateTime(model.dueAt, model.timeZone)}</strong></span>
        <span><small>Escalation</small><strong>{model.escalationTo ?? "Not active"}</strong></span>
      </div>
      {model.pendingApproval ? <PendingApprovalPanel approval={model.pendingApproval} /> : null}
      {model.assignment ? (
        <div className={styles.handoffStatus}>
          <span><small>Current provider route</small><strong>{model.assignment.providerLabel}</strong><p>{model.assignment.kind === "outside_vendor" ? "Outside vendor" : model.assignment.kind === "internal" ? "Internal maintenance" : "Provider not selected"} · {domainLabel(model.assignment.status)}</p></span>
          <span><small>Assigned</small><strong>{model.assignment.assignedLabel}</strong></span>
        </div>
      ) : null}
      {model.latestIssuance ? (
        <div className={styles.handoffStatus}>
          <span><small>Latest handoff record</small><strong>Revision {model.latestIssuance.revision} · {model.latestIssuance.channelLabel}</strong></span>
          <span><small>Delivery evidence</small><strong>{model.latestIssuance.deliveryStateLabel}</strong><p>{model.latestIssuance.deliveryStateDetail}</p></span>
        </div>
      ) : null}
      {model.latestVendorResponse ? (
        <div className={styles.handoffStatus}>
          <span><small>Latest vendor response</small><strong>{domainLabel(model.latestVendorResponse.response)}</strong><p>{model.latestVendorResponse.responderName} · {model.latestVendorResponse.respondedLabel}</p></span>
          <span><small>Response detail</small><strong>{model.latestVendorResponse.proposedAt ? `Proposed ${model.latestVendorResponse.proposedAt.replace("T", " ")}` : "No proposed date"}</strong><p>{model.latestVendorResponse.message ?? "No additional message recorded"}</p></span>
        </div>
      ) : null}
      {model.permitted && !model.isTerminal ? <InternalAccountabilityForm model={model} /> : null}
      {!model.permitted || model.isTerminal ? <p className={styles.inlineEmpty}>{model.isTerminal ? "This work order is terminal. Its service history remains available for review." : "Your role can review this control record but cannot change it."}</p> : model.closeout ? (
        <CloseoutChecklistForm model={model} />
      ) : (
        <details className={styles.controlDisclosure}>
          <summary className={styles.controlDisclosureSummary}><RefreshCw aria-hidden="true" size={18} /><span><strong>Update service control</strong><small>Change the valid work state, priority, owner, next action, due time, or escalation.</small></span></summary>
          <WorkOrderControlForm model={model} />
        </details>
      )}
      {model.permitted ? <ManualVendorResponseForm model={model} /> : null}
      {model.permitted && !model.isTerminal ? <CreateFollowUpForm model={model} /> : null}
      {model.followUps.length ? (
        <div className={styles.followUpList}>
          <h3>Open follow-ups</h3>
          {model.followUps.map((followUp) => (
            <Link href={`/app/action-center/${followUp.id}`} key={followUp.id}>
              <span><strong>{followUp.nextAction}</strong><small>{followUp.accountableParty} · {followUp.dueLabel}</small></span><span>{followUp.status}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ExceptionControls({ model }: { model: AttentionItemControlViewModel }) {
  const review = useMutation();
  const reconcile = useMutation();
  const classify = useMutation();
  return (
    <>
      {!model.unmatchedVisit ? <form action={model.submitAction} method="post" onSubmit={review.submit} className={styles.controlForm}>
        <div className={styles.fieldGrid}>
          <label className={styles.field} htmlFor={`exception-operation-${model.id}`}><span>Review decision <em>Required</em></span><select id={`exception-operation-${model.id}`} name="operation" required defaultValue="acknowledge"><option value="acknowledge">Acknowledge and keep open</option><option value="resolve">Resolve review item</option></select></label>
          <label className={styles.field} htmlFor={`exception-note-${model.id}`}><span>Review note <em>Required</em></span><textarea id={`exception-note-${model.id}`} name="note" required rows={3} placeholder="Record what you checked and why this decision is appropriate." /></label>
        </div>
        <MutationError message={review.state.error} />
        <div className={styles.formFooter}><button className={styles.primaryButton} type="submit" disabled={review.state.pending}>{review.state.pending ? "Recording…" : "Record review decision"}<ShieldCheck aria-hidden="true" size={17} /></button></div>
      </form> : null}
      {model.reconciliationOptions?.length ? (
        <div className={styles.subControlPanel}>
          <div className={styles.subControlHeading}><Route aria-hidden="true" size={18} /><div><h3>Link the unmatched visit</h3><p>Select eligible open work at the same store. This adds an amendment; it does not rewrite the original check-in.</p></div></div>
          <form action={model.submitAction} method="post" onSubmit={reconcile.submit} className={styles.controlForm}>
            <input type="hidden" name="operation" value="reconcile" />
            <SelectField id={`exception-work-${model.id}`} name="workOrderId" label="Operator work order" options={model.reconciliationOptions} />
            <label className={styles.field} htmlFor={`reconcile-note-${model.id}`}><span>Reconciliation note <em>Required</em></span><textarea id={`reconcile-note-${model.id}`} name="note" required rows={3} placeholder="Explain how the visit was matched to this work order." /></label>
            <MutationError message={reconcile.state.error} />
            <div className={styles.formFooter}><button className={styles.secondaryButton} type="submit" disabled={reconcile.state.pending}>{reconcile.state.pending ? "Linking…" : "Link visit with amendment"}</button></div>
          </form>
        </div>
      ) : null}
      {model.unmatchedVisit ? (
        <div className={styles.subControlPanel}>
          <div className={styles.subControlHeading}><ClipboardCheck aria-hidden="true" size={18} /><div><h3>Choose what this visit belongs to</h3><p>Create the missing work order, link an eligible work order above, or record that this was authorized non-maintenance service. This single decision closes the review without rewriting the original check-in.</p></div></div>
          <div className={styles.recoveryChoiceGrid}>
            <div className={styles.recoveryChoice}>
              <strong>Create work from this visit</strong>
              <p>Prefill the store, purpose, and {model.unmatchedVisit.providerLabel} assignment, then link the visit by an auditable amendment.</p>
              <Link className={styles.secondaryButton} href={model.unmatchedVisit.createWorkOrderHref}>Create work order from visit</Link>
            </div>
            <form action={model.submitAction} method="post" onSubmit={classify.submit} className={styles.recoveryChoice}>
              <input type="hidden" name="operation" value="resolve_non_work_service" />
              <strong>Resolve as non-work service</strong>
              <p>Use for authorized recurring visits, inspections, deliveries, or other activity that should remain visible without inventing maintenance work.</p>
              <label className={styles.field} htmlFor={`non-work-note-${model.id}`}><span>Classification note <em>Required</em></span><textarea id={`non-work-note-${model.id}`} name="note" required rows={3} placeholder="Explain why this visit does not require an operator work order." /></label>
              <MutationError message={classify.state.error} />
              <button className={styles.secondaryButton} type="submit" disabled={classify.state.pending}>{classify.state.pending ? "Resolving…" : "Resolve as non-work service"}</button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function FollowUpControls({ model }: { model: AttentionItemControlViewModel }) {
  const update = useMutation();
  const complete = useMutation();
  return (
    <>
      <form action={model.submitAction} method="post" onSubmit={update.submit} className={styles.controlForm}>
        <input type="hidden" name="operation" value="update" />
        <div className={styles.fieldGrid}>
          <label className={styles.field} htmlFor={`follow-owner-${model.id}`}><span>Owner <em>Required</em></span><input id={`follow-owner-${model.id}`} name="accountableParty" required defaultValue={model.accountableParty} /></label>
          <label className={styles.field} htmlFor={`follow-due-${model.id}`}><span>Due <em>Required</em></span><input id={`follow-due-${model.id}`} name="dueAt" type="datetime-local" required defaultValue={inputDateTime(model.dueAt)} /></label>
        </div>
        <label className={styles.field} htmlFor={`follow-next-${model.id}`}><span>Next step <em>Required</em></span><input id={`follow-next-${model.id}`} name="nextAction" required defaultValue={model.nextAction} /></label>
        <label className={styles.field} htmlFor={`follow-escalation-${model.id}`}><span>If overdue, notify <em>Required</em></span><input id={`follow-escalation-${model.id}`} name="escalationTo" required defaultValue={model.escalationTo} /></label>
        <label className={styles.field} htmlFor={`follow-note-${model.id}`}><span>Update note <em>Required</em></span><textarea id={`follow-note-${model.id}`} name="note" required rows={3} placeholder="Explain the new owner, timing, or next action." /></label>
        <MutationError message={update.state.error} />
        <div className={styles.formFooter}><button className={styles.secondaryButton} type="submit" disabled={update.state.pending}>{update.state.pending ? "Recording…" : "Update follow-up"}</button></div>
      </form>
      <div className={styles.subControlPanel}>
        <div className={styles.subControlHeading}><CheckCircle2 aria-hidden="true" size={18} /><div><h3>Complete this follow-up</h3><p>Completion projects the next open follow-up—or returns the work order to service review when none remain.</p></div></div>
        <form action={model.submitAction} method="post" onSubmit={complete.submit} className={styles.controlForm}>
          <input type="hidden" name="operation" value="complete" />
          <label className={styles.field} htmlFor={`follow-resolution-${model.id}`}><span>Completion note <em>Required</em></span><textarea id={`follow-resolution-${model.id}`} name="resolution" required rows={3} placeholder="Describe what was completed and any remaining condition." /></label>
          <MutationError message={complete.state.error} />
          <div className={styles.formFooter}><button className={styles.primaryButton} type="submit" disabled={complete.state.pending}>{complete.state.pending ? "Completing…" : "Complete follow-up"}<CheckCircle2 aria-hidden="true" size={17} /></button></div>
        </form>
      </div>
    </>
  );
}

export function AttentionItemPanel({ model }: { model: AttentionItemControlViewModel }) {
  const terminal = model.status === "resolved" || model.status === "completed" || model.status === "cancelled";
  return (
    <section className={styles.controlPanel} aria-labelledby="attention-control-heading">
      <PanelHeading
        id="attention-control-heading"
        icon={model.kind === "exception" ? <AlertTriangle aria-hidden="true" size={19} /> : <Clock3 aria-hidden="true" size={19} />}
        title={model.kind === "exception" ? "Review the evidence" : "Keep the next action accountable"}
        description={model.kind === "exception" ? "Acknowledge, resolve, or reconcile this item without deleting the fact that triggered it." : "Update ownership and timing, or record completion with a permanent note."}
      />
      {model.kind === "follow_up" ? <div className={styles.controlSummary}><span><small>Owner</small><strong>{model.accountableParty}</strong></span><span><small>Next action</small><strong>{model.nextAction}</strong></span><span><small>Due</small><strong>{textDateTime(model.dueAt)}</strong></span><span><small>Escalation</small><strong>{model.escalationTo}</strong></span></div> : null}
      {!model.available || !model.permitted || terminal ? <p className={styles.inlineEmpty}>{!model.available ? "This review item is no longer available." : terminal ? "This item is complete. Its record remains in the activity history." : "Your role can review this item but cannot change it."}</p> : model.kind === "exception" ? <ExceptionControls model={model} /> : <FollowUpControls model={model} />}
    </section>
  );
}
