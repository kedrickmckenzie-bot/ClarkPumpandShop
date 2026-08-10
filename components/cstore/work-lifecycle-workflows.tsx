"use client";

import {
  type FormEvent,
  type ReactNode,
  useMemo,
  useState,
} from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  History,
  Mail,
  MessageSquareText,
  Phone,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Timer,
  Wrench,
} from "lucide-react";

import type {
  CostLine,
  VendorIssuance,
  Visit,
  WorkOrder,
} from "../../lib/cstore/types";
import styles from "./work-lifecycle-workflows.module.css";

export interface MaintenanceCostEntryValue {
  laborMinor: number;
  materialsMinor: number;
  tripMinor: number;
  miscellaneousMinor: number;
  note: string;
}

export interface MaintenanceCostEntryFormProps {
  workOrder: WorkOrder;
  existingRecordedLines: CostLine[];
  value?: MaintenanceCostEntryValue;
  initialValue?: Partial<MaintenanceCostEntryValue>;
  onChange?: (value: MaintenanceCostEntryValue) => void;
  onSubmit: (value: MaintenanceCostEntryValue) => void | Promise<void>;
  isSubmitting?: boolean;
}

export type WorkCompletionDecision =
  | "verified_resolved_close"
  | "needs_follow_up"
  | "reopen";

export interface WorkCompletionReviewValue {
  decision: WorkCompletionDecision | null;
  note: string;
}

export interface WorkCompletionReviewProps {
  workOrder: WorkOrder;
  visits: Visit[];
  value?: WorkCompletionReviewValue;
  initialValue?: Partial<WorkCompletionReviewValue>;
  onChange?: (value: WorkCompletionReviewValue) => void;
  onSubmit: (value: WorkCompletionReviewValue) => void | Promise<void>;
  isSubmitting?: boolean;
}

export type VendorProposalDecision =
  | "accept_proposed_window"
  | "request_different_date"
  | "record_manual_response";

export type VendorManualResponse =
  | "accepted"
  | "declined"
  | "date_proposed"
  | "question";

export interface VendorProposalReviewValue {
  decision: VendorProposalDecision | null;
  requestedDate: string;
  requestedTime: string;
  manualChannel: "phone" | "email";
  manualResponse: VendorManualResponse;
  manualProposedDate: string;
  manualProposedTime: string;
  manualNote: string;
  vendorTicket: string;
}

export interface VendorProposalReviewProps {
  workOrder: WorkOrder;
  issuance: VendorIssuance;
  vendorName?: string;
  value?: VendorProposalReviewValue;
  initialValue?: Partial<VendorProposalReviewValue>;
  onChange?: (value: VendorProposalReviewValue) => void;
  onSubmit: (value: VendorProposalReviewValue) => void | Promise<void>;
  isSubmitting?: boolean;
}

const emptyCostEntry: MaintenanceCostEntryValue = {
  laborMinor: 0,
  materialsMinor: 0,
  tripMinor: 0,
  miscellaneousMinor: 0,
  note: "",
};

const emptyCompletionReview: WorkCompletionReviewValue = {
  decision: null,
  note: "",
};

const emptyProposalReview: VendorProposalReviewValue = {
  decision: null,
  requestedDate: "",
  requestedTime: "",
  manualChannel: "phone",
  manualResponse: "accepted",
  manualProposedDate: "",
  manualProposedTime: "",
  manualNote: "",
  vendorTicket: "",
};

function money(amountMinor: number, currency: WorkOrder["currency"] = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function words(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateTimeLabel(value?: string) {
  if (!value) return "Not provided";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function durationLabel(checkedInAt: string, checkedOutAt?: string) {
  if (!checkedOutAt) return "Still onsite";
  const minutes = Math.max(
    0,
    Math.round((Date.parse(checkedOutAt) - Date.parse(checkedInAt)) / 60_000),
  );
  if (!Number.isFinite(minutes)) return "Duration unavailable";
  if (minutes < 60) return `${minutes} min observed`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours} hr${remainder ? ` ${remainder} min` : ""} observed`;
}

function dollarsToMinor(rawValue: string) {
  const amount = Number(rawValue);
  if (!Number.isFinite(amount)) return 0;
  return Math.max(0, Math.round(amount * 100));
}

function minorToInput(amountMinor: number) {
  return amountMinor > 0 ? (amountMinor / 100).toFixed(2) : "";
}

function useControllableValue<T>(
  controlledValue: T | undefined,
  initialValue: T,
  onChange?: (value: T) => void,
) {
  const [internalValue, setInternalValue] = useState(initialValue);
  const value = controlledValue ?? internalValue;

  function update(nextValue: T) {
    if (controlledValue === undefined) setInternalValue(nextValue);
    onChange?.(nextValue);
  }

  return [value, update] as const;
}

function WorkflowHeader({
  eyebrow,
  title,
  description,
  status,
}: {
  eyebrow: string;
  title: string;
  description: string;
  status: string;
}) {
  return (
    <header className={styles.workflowHeader}>
      <div>
        <span className={styles.eyebrow}>{eyebrow}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <span className={styles.statusBadge}>{status}</span>
    </header>
  );
}

function BoundaryCallout({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className={styles.boundaryCallout} role="note">
      <span>{icon}</span>
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </div>
  );
}

function MoneyField({
  id,
  label,
  description,
  valueMinor,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  valueMinor: number;
  onChange: (valueMinor: number) => void;
}) {
  return (
    <label className={styles.moneyField} htmlFor={id}>
      <span>{label}</span>
      <small>{description}</small>
      <span className={styles.moneyInput}>
        <span aria-hidden="true">$</span>
        <input
          id={id}
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={minorToInput(valueMinor)}
          onChange={(event) => onChange(dollarsToMinor(event.target.value))}
          placeholder="0.00"
        />
      </span>
    </label>
  );
}

export function MaintenanceCostEntryForm({
  workOrder,
  existingRecordedLines,
  value: controlledValue,
  initialValue,
  onChange,
  onSubmit,
  isSubmitting: submittingFromParent = false,
}: MaintenanceCostEntryFormProps) {
  const [value, updateValue] = useControllableValue(
    controlledValue,
    { ...emptyCostEntry, ...initialValue },
    onChange,
  );
  const [localSubmitting, setLocalSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSubmitting = submittingFromParent || localSubmitting;
  const recordedLines = existingRecordedLines.filter(
    (line) => line.workOrderId === workOrder.id && line.basis === "recorded",
  );
  const recordedMinor = recordedLines.reduce((sum, line) => sum + line.amountMinor, 0);
  const entryMinor =
    value.laborMinor +
    value.materialsMinor +
    value.tripMinor +
    value.miscellaneousMinor;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (entryMinor <= 0) {
      setError("Enter at least one maintenance cost amount.");
      return;
    }
    if (value.note.trim().length < 8) {
      setError("Add a short note explaining what this maintenance cost represents.");
      return;
    }

    setLocalSubmitting(true);
    try {
      await onSubmit({ ...value, note: value.note.trim() });
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "The maintenance cost could not be recorded.");
    } finally {
      setLocalSubmitting(false);
    }
  }

  return (
    <form className={styles.root} onSubmit={handleSubmit}>
      <WorkflowHeader
        eyebrow={`${workOrder.number} · operational record`}
        title="Record maintenance cost"
        description="Capture what the operator knows about labor, materials, trip, or other maintenance cost without waiting for an invoice."
        status={words(workOrder.status)}
      />

      <BoundaryCallout icon={<ShieldCheck />} title="Operational maintenance cost — not an invoice">
        This updates maintenance visibility only. It does not create a vendor invoice,
        approve payment, post to a ledger, or replace the customer’s accounting system.
      </BoundaryCallout>

      <section className={styles.costSummary} aria-label="Maintenance cost summary">
        <article>
          <span>Recorded to date</span>
          <strong>{money(recordedMinor, workOrder.currency)}</strong>
          <small>{recordedLines.length} existing {recordedLines.length === 1 ? "line" : "lines"}</small>
        </article>
        <article data-tone="entry">
          <span>This entry</span>
          <strong>{money(entryMinor, workOrder.currency)}</strong>
          <small>Operational cost being added now</small>
        </article>
        <article>
          <span>After recording</span>
          <strong>{money(recordedMinor + entryMinor, workOrder.currency)}</strong>
          <small>Recorded maintenance-cost basis</small>
        </article>
      </section>

      {recordedLines.length ? (
        <details className={styles.existingLines}>
          <summary>
            <History aria-hidden="true" />
            Review {recordedLines.length} existing recorded {recordedLines.length === 1 ? "line" : "lines"}
          </summary>
          <div>
            {recordedLines.map((line) => (
              <div key={line.id}>
                <span><strong>{line.description}</strong><small>{words(line.costType)} · {dateTimeLabel(line.recordedAt)}</small></span>
                <strong>{money(line.amountMinor, line.currency)}</strong>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      <section className={styles.formSection}>
        <header className={styles.sectionHeader}>
          <span><CircleDollarSign aria-hidden="true" /></span>
          <div><h3>Cost breakdown</h3><p>Enter only the amounts known from the completed work or internal record.</p></div>
        </header>
        <div className={styles.moneyGrid}>
          <MoneyField
            id={`${workOrder.id}-labor-cost`}
            label="Labor"
            description="Internal labor or vendor labor known now"
            valueMinor={value.laborMinor}
            onChange={(laborMinor) => updateValue({ ...value, laborMinor })}
          />
          <MoneyField
            id={`${workOrder.id}-materials-cost`}
            label="Parts and materials"
            description="Installed parts, supplies, or consumables"
            valueMinor={value.materialsMinor}
            onChange={(materialsMinor) => updateValue({ ...value, materialsMinor })}
          />
          <MoneyField
            id={`${workOrder.id}-trip-cost`}
            label="Trip or service call"
            description="Known call-out or travel charge"
            valueMinor={value.tripMinor}
            onChange={(tripMinor) => updateValue({ ...value, tripMinor })}
          />
          <MoneyField
            id={`${workOrder.id}-misc-cost`}
            label="Other maintenance cost"
            description="Rental or another clearly explained item"
            valueMinor={value.miscellaneousMinor}
            onChange={(miscellaneousMinor) => updateValue({ ...value, miscellaneousMinor })}
          />
        </div>
      </section>

      <section className={styles.formSection}>
        <header className={styles.sectionHeader}>
          <span><MessageSquareText aria-hidden="true" /></span>
          <div><h3>Source note</h3><p>Explain where the amount came from so another manager can understand it.</p></div>
        </header>
        <label className={styles.textField} htmlFor={`${workOrder.id}-cost-note`}>
          <span>Maintenance cost note <b>Required</b></span>
          <textarea
            id={`${workOrder.id}-cost-note`}
            rows={4}
            value={value.note}
            onChange={(event) => updateValue({ ...value, note: event.target.value })}
            placeholder="Example: Amount entered from the technician’s completed service summary; vendor invoice has not been received."
          />
        </label>
      </section>

      {error ? <p className={styles.errorMessage} role="alert"><AlertTriangle /> {error}</p> : null}

      <footer className={styles.actionFooter}>
        <span>
          <ReceiptText aria-hidden="true" />
          An invoice can be attached later as separate evidence without replacing this record.
        </span>
        <button className={styles.primaryButton} type="submit" disabled={isSubmitting}>
          <FileCheck2 aria-hidden="true" />
          {isSubmitting ? "Recording…" : `Record ${money(entryMinor, workOrder.currency)}`}
        </button>
      </footer>
    </form>
  );
}

const completionChoices: Array<{
  value: WorkCompletionDecision;
  title: string;
  description: string;
  icon: ReactNode;
  tone: string;
}> = [
  {
    value: "verified_resolved_close",
    title: "Verified resolved — close work",
    description: "The reported issue is resolved and the operational work record can close.",
    icon: <CheckCircle2 />,
    tone: "resolved",
  },
  {
    value: "needs_follow_up",
    title: "Needs follow-up",
    description: "Keep the work open and assign the next action, return visit, or parts step.",
    icon: <RefreshCw />,
    tone: "followup",
  },
  {
    value: "reopen",
    title: "Reopen maintenance work",
    description: "The repair did not hold, the issue returned, or the prior outcome was incorrect.",
    icon: <RotateCcw />,
    tone: "reopen",
  },
];

export function WorkCompletionReview({
  workOrder,
  visits,
  value: controlledValue,
  initialValue,
  onChange,
  onSubmit,
  isSubmitting: submittingFromParent = false,
}: WorkCompletionReviewProps) {
  const [value, updateValue] = useControllableValue(
    controlledValue,
    { ...emptyCompletionReview, ...initialValue },
    onChange,
  );
  const [localSubmitting, setLocalSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSubmitting = submittingFromParent || localSubmitting;
  const workVisits = useMemo(
    () => visits
      .filter((visit) => visit.workOrderId === workOrder.id)
      .sort((left, right) => right.checkedInAt.localeCompare(left.checkedInAt)),
    [visits, workOrder.id],
  );
  const latestVisit = workVisits[0];
  const unresolvedVisits = workVisits.filter(
    (visit) => visit.outcome && !["resolved", "preventive_complete"].includes(visit.outcome),
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!value.decision) {
      setError("Choose the manager decision for this work order.");
      return;
    }
    if (value.note.trim().length < 8) {
      setError("Add a short note describing what was verified or what needs to happen next.");
      return;
    }

    setLocalSubmitting(true);
    try {
      await onSubmit({ decision: value.decision, note: value.note.trim() });
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "The completion review could not be saved.");
    } finally {
      setLocalSubmitting(false);
    }
  }

  const actionLabel = value.decision === "verified_resolved_close"
    ? "Verify and close work"
    : value.decision === "needs_follow_up"
      ? "Save follow-up decision"
      : value.decision === "reopen"
        ? "Reopen work order"
        : "Save manager review";

  return (
    <form className={styles.root} onSubmit={handleSubmit}>
      <WorkflowHeader
        eyebrow={`${workOrder.number} · manager verification`}
        title="Review the completed work"
        description="Use the technician outcome and store context to decide the operational next step. The original history remains intact."
        status={words(workOrder.status)}
      />

      <BoundaryCallout icon={<ClipboardCheck />} title="Close the maintenance work, not the financial record">
        Operational closure confirms the maintenance outcome. Optional invoice evidence may
        arrive or remain under review later without reopening this work order.
      </BoundaryCallout>

      <section className={styles.completionContext}>
        <article>
          <span><Wrench aria-hidden="true" /></span>
          <div><small>Reported problem</small><strong>{workOrder.problemDescription}</strong></div>
        </article>
        <article>
          <span><Clock3 aria-hidden="true" /></span>
          <div><small>Latest technician outcome</small><strong>{latestVisit?.outcome ? words(latestVisit.outcome) : "No checkout outcome recorded"}</strong><p>{latestVisit ? `${latestVisit.technicianName} · ${dateTimeLabel(latestVisit.checkedOutAt ?? latestVisit.checkedInAt)}` : "Review the work history before deciding."}</p></div>
        </article>
        <article>
          <span><Timer aria-hidden="true" /></span>
          <div><small>Observed visit context</small><strong>{workVisits.length} {workVisits.length === 1 ? "visit" : "visits"}</strong><p>{latestVisit ? durationLabel(latestVisit.checkedInAt, latestVisit.checkedOutAt) : "No presence record"}</p></div>
        </article>
      </section>

      {unresolvedVisits.length ? (
        <div className={styles.attentionCallout}>
          <AlertTriangle aria-hidden="true" />
          <span><strong>{unresolvedVisits.length} visit {unresolvedVisits.length === 1 ? "outcome needs" : "outcomes need"} context</strong><small>Choosing “verified resolved” is still allowed, but explain the later resolution in the required note.</small></span>
        </div>
      ) : null}

      <fieldset className={styles.choiceFieldset}>
        <legend>What should happen now?</legend>
        <div className={styles.decisionGrid}>
          {completionChoices.map((choice) => (
            <label
              key={choice.value}
              className={styles.decisionCard}
              data-selected={value.decision === choice.value}
              data-tone={choice.tone}
            >
              <input
                type="radio"
                name={`${workOrder.id}-completion-decision`}
                value={choice.value}
                checked={value.decision === choice.value}
                onChange={() => updateValue({ ...value, decision: choice.value })}
              />
              <span className={styles.decisionIcon}>{choice.icon}</span>
              <span><strong>{choice.title}</strong><small>{choice.description}</small></span>
              <span className={styles.radioMark} aria-hidden="true" />
            </label>
          ))}
        </div>
      </fieldset>

      <label className={styles.textField} htmlFor={`${workOrder.id}-completion-note`}>
        <span>Manager verification note <b>Required</b></span>
        <textarea
          id={`${workOrder.id}-completion-note`}
          rows={4}
          value={value.note}
          onChange={(event) => updateValue({ ...value, note: event.target.value })}
          placeholder={value.decision === "verified_resolved_close"
            ? "What was checked, and how was the result confirmed?"
            : value.decision === "needs_follow_up"
              ? "What remains open, who needs to act, and what should happen next?"
              : value.decision === "reopen"
                ? "What returned or was found to be unresolved?"
                : "Describe what you verified and why you chose this next step."}
        />
      </label>

      {error ? <p className={styles.errorMessage} role="alert"><AlertTriangle /> {error}</p> : null}

      <footer className={styles.actionFooter}>
        <span><History aria-hidden="true" /> The decision and note are added to the permanent work-order timeline.</span>
        <button className={styles.primaryButton} type="submit" disabled={isSubmitting}>
          {value.decision === "reopen" ? <RotateCcw /> : <CheckCircle2 />}
          {isSubmitting ? "Saving…" : actionLabel}
        </button>
      </footer>
    </form>
  );
}

const proposalChoices: Array<{
  value: VendorProposalDecision;
  title: string;
  description: string;
  icon: ReactNode;
}> = [
  {
    value: "accept_proposed_window",
    title: "Accept proposed window",
    description: "Confirm the date the vendor proposed through the secure response.",
    icon: <CalendarCheck />,
  },
  {
    value: "request_different_date",
    title: "Request a different date",
    description: "Record the operator’s preferred date and send it back for confirmation.",
    icon: <RefreshCw />,
  },
  {
    value: "record_manual_response",
    title: "Record phone or email response",
    description: "Capture what the vendor said outside the portal without inventing a digital action.",
    icon: <Phone />,
  },
];

export function VendorProposalReview({
  workOrder,
  issuance,
  vendorName = "Outside vendor",
  value: controlledValue,
  initialValue,
  onChange,
  onSubmit,
  isSubmitting: submittingFromParent = false,
}: VendorProposalReviewProps) {
  const [value, updateValue] = useControllableValue(
    controlledValue,
    { ...emptyProposalReview, vendorTicket: issuance.vendorReference ?? "", ...initialValue },
    onChange,
  );
  const [localSubmitting, setLocalSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSubmitting = submittingFromParent || localSubmitting;
  const proposedDateAvailable = Boolean(issuance.proposedArrivalAt);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!value.decision) {
      setError("Choose how the vendor response should be handled.");
      return;
    }
    if (value.decision === "accept_proposed_window" && !proposedDateAvailable) {
      setError("This issuance does not include a proposed date to accept.");
      return;
    }
    if (value.decision === "request_different_date" && (!value.requestedDate || !value.requestedTime)) {
      setError("Enter the different date and preferred arrival time.");
      return;
    }
    if (value.decision === "record_manual_response") {
      if (value.manualResponse === "date_proposed" && (!value.manualProposedDate || !value.manualProposedTime)) {
        setError("Record the date and time the vendor proposed.");
        return;
      }
      if (value.manualNote.trim().length < 5) {
        setError("Add a short note describing the phone or email response.");
        return;
      }
    }

    setLocalSubmitting(true);
    try {
      await onSubmit({
        ...value,
        manualNote: value.manualNote.trim(),
        vendorTicket: value.vendorTicket.trim(),
      });
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "The vendor response could not be saved.");
    } finally {
      setLocalSubmitting(false);
    }
  }

  const actionLabel = value.decision === "accept_proposed_window"
    ? "Accept proposed window"
    : value.decision === "request_different_date"
      ? "Request different date"
      : value.decision === "record_manual_response"
        ? "Record manual response"
        : "Save vendor response";

  return (
    <form className={styles.root} onSubmit={handleSubmit}>
      <WorkflowHeader
        eyebrow={`${workOrder.number} · issuance version ${issuance.version}`}
        title="Review the vendor’s scheduling response"
        description="Confirm the proposed window, ask for another date, or accurately record a response received by phone or email."
        status={issuance.response ? words(issuance.response) : words(issuance.deliveryStatus)}
      />

      <BoundaryCallout icon={<ShieldCheck />} title="One work-order history across every response channel">
        A manually recorded response is labeled phone or email and never presented as a
        vendor portal action. The vendor may continue using its own scheduling system.
      </BoundaryCallout>

      <section className={styles.proposalSummary}>
        <article className={styles.proposedWindow} data-missing={!proposedDateAvailable}>
          <span><CalendarCheck aria-hidden="true" /></span>
          <div><small>Vendor-proposed arrival</small><strong>{dateTimeLabel(issuance.proposedArrivalAt)}</strong><p>{proposedDateAvailable ? `${vendorName} proposed this window on version ${issuance.version}.` : "No date was included with the latest response."}</p></div>
        </article>
        <dl>
          <div><dt>Vendor</dt><dd>{vendorName}</dd></div>
          <div><dt>Work requested</dt><dd>{workOrder.scopeOfWork}</dd></div>
          <div><dt>Requested window</dt><dd>{dateTimeLabel(workOrder.requestedWindow.startsAt)} – {dateTimeLabel(workOrder.requestedWindow.endsAt)}</dd></div>
          <div><dt>Vendor ticket</dt><dd>{issuance.vendorReference ?? "Not provided"}</dd></div>
        </dl>
      </section>

      <fieldset className={styles.choiceFieldset}>
        <legend>How should this response be handled?</legend>
        <div className={styles.proposalChoiceGrid}>
          {proposalChoices.map((choice) => {
            const disabled = choice.value === "accept_proposed_window" && !proposedDateAvailable;
            return (
              <label
                key={choice.value}
                className={styles.proposalChoice}
                data-selected={value.decision === choice.value}
                data-disabled={disabled}
              >
                <input
                  type="radio"
                  name={`${workOrder.id}-proposal-decision`}
                  value={choice.value}
                  checked={value.decision === choice.value}
                  disabled={disabled}
                  onChange={() => updateValue({ ...value, decision: choice.value })}
                />
                <span className={styles.decisionIcon}>{choice.icon}</span>
                <span><strong>{choice.title}</strong><small>{choice.description}</small></span>
                <span className={styles.radioMark} aria-hidden="true" />
              </label>
            );
          })}
        </div>
      </fieldset>

      {value.decision === "request_different_date" ? (
        <section className={styles.conditionalPanel}>
          <header><RefreshCw aria-hidden="true" /><span><strong>Operator’s requested date</strong><small>The vendor still confirms the final schedule.</small></span></header>
          <div className={styles.twoFieldGrid}>
            <label className={styles.inputField} htmlFor={`${workOrder.id}-requested-date`}>
              <span>Preferred date</span>
              <input id={`${workOrder.id}-requested-date`} type="date" value={value.requestedDate} onChange={(event) => updateValue({ ...value, requestedDate: event.target.value })} />
            </label>
            <label className={styles.inputField} htmlFor={`${workOrder.id}-requested-time`}>
              <span>Preferred arrival time</span>
              <input id={`${workOrder.id}-requested-time`} type="time" value={value.requestedTime} onChange={(event) => updateValue({ ...value, requestedTime: event.target.value })} />
            </label>
          </div>
        </section>
      ) : null}

      {value.decision === "record_manual_response" ? (
        <section className={styles.conditionalPanel}>
          <header><Phone aria-hidden="true" /><span><strong>Manual response details</strong><small>Record the source and the vendor’s actual response.</small></span></header>
          <div className={styles.channelPicker} role="group" aria-label="Manual response channel">
            <button type="button" data-active={value.manualChannel === "phone"} onClick={() => updateValue({ ...value, manualChannel: "phone" })}><Phone /> Phone</button>
            <button type="button" data-active={value.manualChannel === "email"} onClick={() => updateValue({ ...value, manualChannel: "email" })}><Mail /> Email</button>
          </div>
          <label className={styles.inputField} htmlFor={`${workOrder.id}-manual-outcome`}>
            <span>Vendor response</span>
            <select id={`${workOrder.id}-manual-outcome`} value={value.manualResponse} onChange={(event) => updateValue({ ...value, manualResponse: event.target.value as VendorManualResponse })}>
              <option value="accepted">Accepted work</option>
              <option value="declined">Declined work</option>
              <option value="date_proposed">Proposed a date</option>
              <option value="question">Asked a question</option>
            </select>
          </label>
          {value.manualResponse === "date_proposed" ? (
            <div className={styles.twoFieldGrid}>
              <label className={styles.inputField} htmlFor={`${workOrder.id}-manual-date`}><span>Vendor-proposed date</span><input id={`${workOrder.id}-manual-date`} type="date" value={value.manualProposedDate} onChange={(event) => updateValue({ ...value, manualProposedDate: event.target.value })} /></label>
              <label className={styles.inputField} htmlFor={`${workOrder.id}-manual-time`}><span>Vendor-proposed time</span><input id={`${workOrder.id}-manual-time`} type="time" value={value.manualProposedTime} onChange={(event) => updateValue({ ...value, manualProposedTime: event.target.value })} /></label>
            </div>
          ) : null}
          <label className={styles.textField} htmlFor={`${workOrder.id}-manual-note`}>
            <span>What the vendor said <b>Required</b></span>
            <textarea id={`${workOrder.id}-manual-note`} rows={3} value={value.manualNote} onChange={(event) => updateValue({ ...value, manualNote: event.target.value })} placeholder="Example: Monica at Summit Dispatch confirmed the technician can arrive Tuesday after 10:00 AM." />
          </label>
        </section>
      ) : null}

      <label className={styles.inputField} htmlFor={`${workOrder.id}-vendor-ticket`}>
        <span>Vendor service-ticket number <em>Optional</em></span>
        <small>Keep the vendor’s identifier separate from customer work order {workOrder.number}.</small>
        <input id={`${workOrder.id}-vendor-ticket`} value={value.vendorTicket} onChange={(event) => updateValue({ ...value, vendorTicket: event.target.value })} placeholder="Example: SV-884219" />
      </label>

      {error ? <p className={styles.errorMessage} role="alert"><AlertTriangle /> {error}</p> : null}

      <footer className={styles.actionFooter}>
        <span><History aria-hidden="true" /> The response channel, decision, and source details remain visible in the timeline.</span>
        <button className={styles.primaryButton} type="submit" disabled={isSubmitting}>
          {value.decision === "record_manual_response" ? <Phone /> : <CalendarCheck />}
          {isSubmitting ? "Saving…" : actionLabel}
          {!isSubmitting ? <ArrowRight aria-hidden="true" /> : null}
        </button>
      </footer>
    </form>
  );
}
