"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { OPS_CLIENT_HEADER } from "@/lib/ops/http-contract";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Circle,
  CircleDollarSign,
  Clock3,
  Eye,
  FileText,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import type {
  EstimateComparisonViewModel,
  EstimateRequestComparisonViewModel,
} from "./data-contract";
import styles from "./ops.module.css";

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
        headers: { [OPS_CLIENT_HEADER]: "estimate-comparison" },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        setState({ pending: false, error: payload?.error ?? "The bid-request update could not be recorded." });
        return;
      }
      const payload = await response.json().catch(() => null) as { redirectTo?: string } | null;
      window.location.assign(payload?.redirectTo ?? window.location.href);
    } catch {
      setState({ pending: false, error: "The bid-request update could not be recorded. Check your connection and try again." });
    }
  }

  return { state, submit };
}

function EstimateProgress({ request }: { request: EstimateRequestComparisonViewModel }) {
  const hasOpened = Boolean(request.openedLabel);
  const hasProposal = Boolean(request.latestProposal);
  const isDecided = Boolean(request.decisionLabel);
  const declinedWithoutEstimate = request.status === "declined" && !hasProposal;
  const responseStep = declinedWithoutEstimate
    ? {
        label: "Vendor response",
        complete: true,
        detail: request.respondedLabel ? `Declined ${request.respondedLabel}` : "Declined without a bid",
        icon: X,
      }
    : {
        label: "Bid received",
        complete: hasProposal,
        detail: request.respondedLabel ?? "Awaiting response",
        icon: FileText,
      };
  const steps = [
    { label: "Request created", complete: true, detail: request.requestedLabel, icon: Send },
    { label: "Opened", complete: hasOpened, detail: request.openedLabel ?? "Not opened yet", icon: Eye },
    responseStep,
    { label: "Decision", complete: isDecided, detail: request.decisionLabel ?? "No decision yet", icon: Check },
  ];
  return (
    <ol className={styles.estimateProgress} aria-label={`${request.vendorName} bid-request progress`}>
      {steps.map((step) => {
        const Icon = step.complete ? step.icon : Circle;
        return (
          <li data-complete={step.complete ? "true" : "false"} key={step.label}>
            <Icon aria-hidden="true" size={15} />
            <span><strong>{step.label}</strong><small>{step.detail}</small></span>
          </li>
        );
      })}
    </ol>
  );
}

function EstimateDecisionControls({ request }: { request: EstimateRequestComparisonViewModel }) {
  const select = useMutation();
  const withdraw = useMutation();
  const reopen = useMutation();
  if (!request.canSelect && !request.canWithdraw && !request.canReopen) return null;
  return (
    <div className={styles.estimateDecisionControls}>
      {request.canWithdraw ? (
        <form action={request.decisionAction} method="post" onSubmit={withdraw.submit}>
          <input type="hidden" name="operation" value="withdraw" />
          <input type="hidden" name="expectedRevision" value={request.latestProposal?.revision ?? 0} />
          <label className={styles.visuallyHidden} htmlFor={`withdraw-note-${request.id}`}>Reason for withdrawing this request</label>
          <input id={`withdraw-note-${request.id}`} name="note" type="hidden" value="Bid request withdrawn by operator" readOnly />
          <button className={styles.secondaryButton} type="submit" disabled={withdraw.state.pending}>
            <X aria-hidden="true" size={16} />{withdraw.state.pending ? "Withdrawing..." : "Withdraw request"}
          </button>
        </form>
      ) : null}
      {request.canSelect && request.latestProposal ? (
        <form action={request.decisionAction} method="post" onSubmit={select.submit}>
          <input type="hidden" name="operation" value="select" />
          <input type="hidden" name="proposalId" value={request.latestProposal.id} />
          <input type="hidden" name="expectedRevision" value={request.latestProposal.revision} />
          <input type="hidden" name="note" value="Selected after operator bid and scope review" />
          <button className={styles.primaryButton} type="submit" disabled={select.state.pending}>
            <ShieldCheck aria-hidden="true" size={16} />{select.state.pending ? "Selecting..." : request.decisionKind === "replacement_quote" ? "Select quote for capital review" : "Select provider — authorization is next"}
          </button>
        </form>
      ) : null}
      {request.canReopen && request.latestProposal ? (
        <form action={request.decisionAction} method="post" onSubmit={reopen.submit}>
          <input type="hidden" name="operation" value="reopen" />
          <input type="hidden" name="expectedRevision" value={request.latestProposal.revision} />
          <input type="hidden" name="note" value="Vendor decision reopened by operator for another review" />
          <button className={styles.secondaryButton} type="submit" disabled={reopen.state.pending}>
            <X aria-hidden="true" size={16} />{reopen.state.pending ? "Reopening..." : "Reopen provider decision"}
          </button>
        </form>
      ) : null}
      {select.state.error || withdraw.state.error || reopen.state.error ? (
        <p className={styles.controlError} role="alert"><AlertTriangle aria-hidden="true" size={16} />{select.state.error ?? withdraw.state.error ?? reopen.state.error}</p>
      ) : null}
    </div>
  );
}

function EstimateRequestCard({ request }: { request: EstimateRequestComparisonViewModel }) {
  return (
    <article className={styles.estimateCard} data-status={request.status}>
      <header>
        <div>
          <span className={styles.estimateVendorIcon}><CircleDollarSign aria-hidden="true" size={18} /></span>
          <span><strong>{request.vendorName}</strong><small>{request.kindLabel}</small></span>
        </div>
        <span className={styles.estimateStatus} data-status={request.status}>{request.statusLabel}</span>
      </header>
      <EstimateProgress request={request} />
      <div className={styles.estimateScope}>
        <small>Bid scope</small>
        <p>{request.requestedScope}</p>
        {request.dueLabel ? <span><Clock3 aria-hidden="true" size={14} />Bid due {request.dueLabel}</span> : null}
      </div>
      {request.latestProposal ? (
        <div className={styles.estimateProposal}>
          <div className={styles.estimateAmount}>
            <small>Vendor bid</small>
            <strong>{request.latestProposal.amountLabel}</strong>
            <span>Revision {request.latestProposal.revision} · {request.latestProposal.submittedLabel}</span>
          </div>
          <dl>
            <div><dt>Proposed scope</dt><dd>{request.latestProposal.scope}</dd></div>
            <div><dt>Exclusions</dt><dd>{request.latestProposal.exclusions ?? "None stated"}</dd></div>
            <div><dt>Lead time</dt><dd>{request.latestProposal.leadTimeLabel ?? "Not stated"}</dd></div>
            <div><dt>Valid through</dt><dd>{request.latestProposal.validUntilLabel ?? "Not stated"}</dd></div>
          </dl>
        </div>
      ) : request.status === "declined" ? (
        <p className={styles.estimateEmpty}>The vendor declined this bid request. No assignment, service authorization, visit, or cost was created.</p>
      ) : (
        <p className={styles.estimateEmpty}>No bid has been submitted. This pricing request does not authorize work or a site visit.</p>
      )}
      <EstimateDecisionControls request={request} />
    </article>
  );
}

function RequestEstimateForm({ model }: { model: EstimateComparisonViewModel }) {
  return (
    <details className={styles.controlDisclosure}>
      <summary className={styles.controlDisclosureSummary}>
        <CircleDollarSign aria-hidden="true" size={18} />
        <span><strong>Send another bid request</strong><small>Invite a qualified vendor to price the same scope before service is authorized.</small></span>
      </summary>
      <form action={model.submitAction} method="post" target="_blank" className={styles.controlForm}>
        <input name="kind" type="hidden" value="estimate_only" />
        <div className={styles.fieldGrid}>
          <label className={styles.field} htmlFor={`estimate-purpose-${model.workOrderId}`}>
            <span>What are you requesting? <em>Required</em></span>
            <select id={`estimate-purpose-${model.workOrderId}`} name="decisionKind" required defaultValue="service_bid">
              <option value="service_bid">Price this service work</option>
              <option value="replacement_quote">Price equipment replacement</option>
            </select>
            <small>A service bid can become a service authorization. A replacement quote goes to capital review and cannot create a technician assignment.</small>
          </label>
          <label className={styles.field} htmlFor={`estimate-vendor-${model.workOrderId}`}>
            <span>Vendor to invite <em>Required</em></span>
            <select id={`estimate-vendor-${model.workOrderId}`} name="vendorId" required defaultValue="">
              <option value="" disabled>Select an approved vendor</option>
              {model.vendors.map((vendor) => <option value={vendor.value} key={vendor.value}>{vendor.label}{vendor.description ? ` — ${vendor.description}` : ""}</option>)}
            </select>
            <small>This vendor is being asked for pricing only. They are not assigned to the work.</small>
          </label>
        </div>
        <label className={styles.field} htmlFor={`estimate-scope-${model.workOrderId}`}>
          <span>What should this vendor price? <em>Required</em></span>
          <textarea id={`estimate-scope-${model.workOrderId}`} name="requestedScope" rows={4} required defaultValue={model.defaultRequestedScope} />
        </label>
        <div className={styles.fieldGrid}>
          <label className={styles.field} htmlFor={`estimate-due-${model.workOrderId}`}>
            <span>Bid due <em>Required</em></span>
            <input id={`estimate-due-${model.workOrderId}`} name="dueAt" type="datetime-local" required />
          </label>
          <label className={styles.field} htmlFor={`estimate-channel-${model.workOrderId}`}>
            <span>Link handoff <em>Required</em></span>
            <select id={`estimate-channel-${model.workOrderId}`} name="channel" required defaultValue="email">
              <option value="email">Prepare email-ready link</option>
              <option value="sms">Prepare text-message-ready link</option>
              <option value="manual">Copy or print link</option>
            </select>
            <small>This preview prepares a secure response link; it does not send email or text messages.</small>
          </label>
        </div>
        <div className={styles.formFooter}>
          <span className={styles.formMeta}>Pricing only—no assignment, site visit, check-in, recorded cost, or billing is created.</span>
          <button className={styles.primaryButton} type="submit">
            <Send aria-hidden="true" size={16} />Create bid request & link
          </button>
        </div>
      </form>
    </details>
  );
}

export function EstimateComparisonPanel({ model }: { model: EstimateComparisonViewModel }) {
  if (!model.available) return null;
  return (
    <section className={styles.controlPanel} id="bid-requests" aria-labelledby="bid-requests-heading">
      <div className={styles.controlHeading}>
        <span><CircleDollarSign aria-hidden="true" size={19} /></span>
        <div>
          <h2 id="bid-requests-heading">Request and compare vendor bids</h2>
          <p>Request and compare service bids or replacement quotes, with a separate next step for each.</p>
        </div>
      </div>
      <div className={styles.estimateGuardrail}>
        <ShieldCheck aria-hidden="true" size={19} />
        <p><strong>Bid requests are pricing only.</strong> Vendors are not assigned, should not travel to the store, and cannot check in. A selected service bid requires a separate service authorization; a selected replacement quote requires a capital decision.</p>
      </div>
      <div className={styles.controlSummary}>
        <span><small>Operator work order</small><strong>{model.workOrderNumber}</strong></span>
        <span><small>Open bid requests</small><strong>{model.activeRequestCount}</strong></span>
        <span><small>Bids received</small><strong>{model.proposalCount}</strong></span>
        <span><small>{model.selectedDecisionKind === "replacement_quote" ? "Selected replacement quote" : "Selected service provider"}</small><strong>{model.selectedVendorName ?? "No selection yet"}</strong></span>
      </div>
      {model.requests.length ? (
        <div className={styles.estimateGrid}>{model.requests.map((request) => <EstimateRequestCard request={request} key={request.id} />)}</div>
      ) : (
        <div className={styles.estimateBlank}><CheckCircle2 aria-hidden="true" size={20} /><p>No vendor bids have been requested. You can still send service work directly to a known vendor.</p></div>
      )}
      {!model.rolePermitted ? (
        <p className={styles.inlineEmpty}>Your role can review the bid path but cannot send bid requests or select a service provider.</p>
      ) : model.workflowBlocked ? (
        <p className={styles.inlineEmpty} role="status"><strong>Bid path paused.</strong> {model.workflowBlockMessage}</p>
      ) : model.comparisonClosed ? (
        <div className={styles.estimateContinuation}>
          <CheckCircle2 aria-hidden="true" size={20} />
          <div>
            <strong>{model.selectedDecisionKind === "replacement_quote" ? "Replacement quote selected" : "Service provider selected"}</strong>
            <p>{model.selectedDecisionKind === "replacement_quote" ? `${model.selectedVendorName}'s quote is ready for capital review. No assignment, authorization, or visit was created.` : `${model.selectedVendorName} is selected, but is not authorized to begin work until the separate service authorization is sent.`}</p>
          </div>
          <a className={styles.primaryButton} href={model.selectedDecisionKind === "replacement_quote" ? `/app/work-orders/${model.workOrderId}?view=equipment` : "#issue-work"}>
            {model.selectedDecisionKind === "replacement_quote" ? "Open capital review" : "Send service authorization"}<Send aria-hidden="true" size={16} />
          </a>
        </div>
      ) : model.permitted && model.vendors.length ? (
        <RequestEstimateForm model={model} />
      ) : model.permitted ? (
        <p className={styles.inlineEmpty}>Every currently qualified vendor is already represented. Select a bid or withdraw an open request before inviting another vendor.</p>
      ) : (
        <p className={styles.inlineEmpty}>Bid actions are unavailable while this work order is in its current service state.</p>
      )}
    </section>
  );
}
