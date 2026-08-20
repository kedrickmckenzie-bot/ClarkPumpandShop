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

function textDateTime(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Not set";
  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/u.test(value) ? value : `${value}:00Z`;
  return `${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(normalized))} UTC`;
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
  const [decision, setDecision] = useState("escalate");
  if (!model.available) return null;
  const impact = model.latestImpact;
  const answerOptions = [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }, { value: "unknown", label: "Not sure" }];

  return (
    <section className={styles.controlPanel} id="request-review" aria-labelledby="request-review-heading">
      <PanelHeading
        id="request-review-heading"
        icon={<ClipboardCheck aria-hidden="true" size={19} />}
        title="Review and preserve the request"
        description="Record what happens next without rewriting or deleting the employee's original report."
      />
      <div className={styles.controlSummary}>
        <span><small>Request</small><strong>{model.reference}</strong></span>
        <span><small>Current state</small><strong>{model.statusLabel}</strong></span>
        <span><small>Store operation</small><strong>{impact ? domainLabel(impact.storeOperatingState) : "Not assessed"}</strong></span>
        <span><small>Safety</small><strong>{impact ? domainLabel(impact.safetyConcern) : "Not assessed"}</strong></span>
        <span><small>Product risk</small><strong>{impact ? domainLabel(impact.productInventoryRisk) : "Not assessed"}</strong></span>
        <span><small>Inventory value at risk</small><strong>{impact?.productInventoryValueLabel ?? "Not estimated"}</strong></span>
        <span><small>Daily revenue exposure</small><strong>{impact?.estimatedDailyRevenueExposureLabel ?? "Not estimated"}</strong></span>
        <span><small>Downtime exposure</small><strong>{impact?.estimatedDowntimeLabel ?? "Not estimated"}</strong></span>
      </div>
      <p className={styles.inlineEmpty}><strong>Estimate caveat.</strong> {model.impactCaveat}</p>
      {model.impactHistory.length ? (
        <details className={`${styles.subControlPanel} ${styles.controlDisclosure}`}>
          <summary className={styles.subControlHeading}><ClipboardCheck aria-hidden="true" size={18} /><div><h3>Append-only assessment history</h3><p>{model.impactHistory.length} assessment{model.impactHistory.length === 1 ? "" : "s"}; earlier reports are never overwritten.</p></div></summary>
          <ol className={styles.timeline}>
            {model.impactHistory.map((item) => <li key={item.id}><span className={styles.timelineDot} /><div><strong>{item.kindLabel}</strong><p>{item.summary}</p><small>{item.provenanceLabel}</small></div></li>)}
          </ol>
        </details>
      ) : null}
      {model.pendingApproval ? <PendingApprovalPanel approval={model.pendingApproval} /> : null}
      {!model.permitted ? <p className={styles.inlineEmpty}>Your role can review this request but cannot record a decision.</p> : (
        <>
        <form action={model.impactSubmitAction} method="post" onSubmit={impactMutation.submit} className={styles.controlForm}>
          <input type="hidden" name="expectedRequestStatus" value={model.expectedStatus} />
          {impact ? <input type="hidden" name="expectedLatestAssessmentId" value={impact.id} /> : null}
          <SelectField id={`impact-disposition-${model.requestId}`} name="disposition" label="Manager assessment" defaultValue="confirmed" options={[{ value: "confirmed", label: "Confirm the reported facts" }, { value: "revised", label: "Revise the reported facts" }]} helper="Leave facts unchanged when confirming. Choose revised if any reported fact changes; the prior assessment remains in history." />
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
          <MutationError message={impactMutation.state.error} />
          <div className={styles.formFooter}>
            <span className={styles.formMeta}>This action also starts or advances the request review Workflow Task.</span>
            <button className={styles.primaryButton} type="submit" disabled={impactMutation.state.pending}>{impactMutation.state.pending ? "Recording…" : "Record impact review"}<ShieldCheck aria-hidden="true" size={17} /></button>
          </div>
        </form>
        {model.expectedStatus === "under_review" ? <form action={model.submitAction} method="post" onSubmit={decisionMutation.submit} className={styles.controlForm}>
          <input type="hidden" name="expectedStatus" value={model.expectedStatus} />
          <label className={styles.field} htmlFor={`request-decision-${model.requestId}`}>
            <span>Review decision <em>Required</em></span>
            <select id={`request-decision-${model.requestId}`} name="decision" required value={decision} onChange={(event) => setDecision(event.target.value)}>
              <option value="escalate">Escalate for a higher-level decision</option>
              <option value="close">Close without creating work</option>
            </select>
          </label>
          <label className={styles.field} htmlFor={`request-note-${model.requestId}`}>
            <span>Decision note <em>Required</em></span>
            <textarea
              id={`request-note-${model.requestId}`}
              name="note"
              rows={3}
              required
              placeholder={decision === "close" ? "Explain why no work order is needed." : "Explain what decision or approval is needed."}
            />
          </label>
          <MutationError message={decisionMutation.state.error} />
          <div className={styles.formFooter}>
            {model.canCreateWorkOrder && model.createWorkOrderHref ? <Link className={styles.secondaryButton} href={model.createWorkOrderHref}>Create work order</Link> : null}
            <button className={styles.primaryButton} type="submit" disabled={decisionMutation.state.pending}>{decisionMutation.state.pending ? "Recording…" : "Record decision"}<ShieldCheck aria-hidden="true" size={17} /></button>
          </div>
        </form> : null}
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
          <span>Work state <em>Required</em></span>
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
            <label className={styles.field} htmlFor={`work-owner-${model.workOrderId}`}><span>Accountable party <em>Required</em></span><input id={`work-owner-${model.workOrderId}`} name="accountableParty" required defaultValue={model.accountableParty} /></label>
            <label className={styles.field} htmlFor={`work-due-${model.workOrderId}`}><span>Action due <em>Required</em></span><input id={`work-due-${model.workOrderId}`} name="dueAt" type="datetime-local" required defaultValue={inputDateTime(model.dueAt)} /></label>
          </div>
          <label className={styles.field} htmlFor={`work-next-${model.workOrderId}`}><span>Next required action <em>Required</em></span><input id={`work-next-${model.workOrderId}`} name="nextAction" required defaultValue={model.nextAction} /></label>
          <label className={styles.field} htmlFor={`work-escalation-${model.workOrderId}`}><span>Escalate to <em>Required</em></span><input id={`work-escalation-${model.workOrderId}`} name="escalationTo" required defaultValue={model.escalationTo} /></label>
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
          <h3>Authorization decision required</h3>
          <p>Decide the current policy request here. Ordinary {approval.subjectLabel === "request" ? "request-review" : "service-control"} updates cannot approve this {approval.subjectLabel}.</p>
        </div>
      </div>
      <div className={styles.controlSummary}>
        <span><small>Applied policy</small><strong>{approval.policyName} · version {approval.policyVersion}</strong></span>
        <span><small>Amount presented</small><strong>{approval.amountLabel}</strong></span>
        <span><small>Required role</small><strong>{approval.requiredRoleLabel}</strong></span>
        <span><small>Decision due</small><strong>{approval.dueLabel}</strong></span>
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

export function WorkOrderControlPanel({ model }: { model: WorkOrderControlViewModel }) {
  if (!model.available) return null;
  return (
    <section className={styles.controlPanel} id="work-control" aria-labelledby="work-control-heading">
      <PanelHeading
        id="work-control-heading"
        icon={<Route aria-hidden="true" size={19} />}
        title="Service control"
        description="Keep one accountable owner, one next required action, and one due time on every unresolved work order."
      />
      <WorkflowStages stages={model.stages} />
      <div className={styles.controlSummary}>
        <span><small>Current owner</small><strong>{model.accountableParty}</strong></span>
        <span><small>Next action</small><strong>{model.nextAction}</strong></span>
        <span><small>Due</small><strong>{textDateTime(model.dueAt)}</strong></span>
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
      {!model.permitted || model.isTerminal ? <p className={styles.inlineEmpty}>{model.isTerminal ? "This work order is terminal. Its service history remains available for review." : "Your role can review this control record but cannot change it."}</p> : (
        <details className={styles.controlDisclosure}>
          <summary className={styles.controlDisclosureSummary}><RefreshCw aria-hidden="true" size={18} /><span><strong>Update service control</strong><small>Change the valid work state, priority, owner, next action, due time, or escalation.</small></span></summary>
          <WorkOrderControlForm model={model} />
        </details>
      )}
      {model.permitted ? <ManualVendorResponseForm model={model} /> : null}
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
  return (
    <>
      <form action={model.submitAction} method="post" onSubmit={review.submit} className={styles.controlForm}>
        <div className={styles.fieldGrid}>
          <label className={styles.field} htmlFor={`exception-operation-${model.id}`}><span>Review decision <em>Required</em></span><select id={`exception-operation-${model.id}`} name="operation" required defaultValue="acknowledge"><option value="acknowledge">Acknowledge and keep open</option><option value="resolve">Resolve review item</option></select></label>
          <label className={styles.field} htmlFor={`exception-note-${model.id}`}><span>Review note <em>Required</em></span><textarea id={`exception-note-${model.id}`} name="note" required rows={3} placeholder="Record what you checked and why this decision is appropriate." /></label>
        </div>
        <MutationError message={review.state.error} />
        <div className={styles.formFooter}><button className={styles.primaryButton} type="submit" disabled={review.state.pending}>{review.state.pending ? "Recording…" : "Record review decision"}<ShieldCheck aria-hidden="true" size={17} /></button></div>
      </form>
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
          <label className={styles.field} htmlFor={`follow-owner-${model.id}`}><span>Accountable party <em>Required</em></span><input id={`follow-owner-${model.id}`} name="accountableParty" required defaultValue={model.accountableParty} /></label>
          <label className={styles.field} htmlFor={`follow-due-${model.id}`}><span>Action due <em>Required</em></span><input id={`follow-due-${model.id}`} name="dueAt" type="datetime-local" required defaultValue={inputDateTime(model.dueAt)} /></label>
        </div>
        <label className={styles.field} htmlFor={`follow-next-${model.id}`}><span>Next required action <em>Required</em></span><input id={`follow-next-${model.id}`} name="nextAction" required defaultValue={model.nextAction} /></label>
        <label className={styles.field} htmlFor={`follow-escalation-${model.id}`}><span>Escalate to <em>Required</em></span><input id={`follow-escalation-${model.id}`} name="escalationTo" required defaultValue={model.escalationTo} /></label>
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
