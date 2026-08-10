"use client";

import { type FormEvent, useId, useState } from "react";
import {
  CalendarPlus,
  CheckCircle2,
  Copy,
  DollarSign,
  FileText,
  Gauge,
  History,
  Mail,
  MessageSquareText,
  PackageSearch,
  Send,
  ShieldCheck,
} from "lucide-react";

import styles from "./cstore-workflows.module.css";
import type {
  ServiceAuthorizationIssueValue,
  ServiceAuthorizationRecord,
} from "./types";

export interface VendorServiceAuthorizationProps {
  authorization: ServiceAuthorizationRecord;
  onIssue: (value: ServiceAuthorizationIssueValue) => void | Promise<void>;
  onSaveDraft?: (value: ServiceAuthorizationIssueValue) => void | Promise<void>;
  defaultAcceptanceRequested?: boolean;
  lifecycleReview?: ServiceAuthorizationLifecycleReview;
  onOpenEquipmentHistory?: () => void;
  onAddToCapexPlan?: () => void;
  onSelectEquipment?: () => void;
  className?: string;
  isIssuing?: boolean;
}

export type ServiceAuthorizationLifecycleReview =
  | {
      kind: "review";
      assetName: string;
      assetCode: string;
      repairCostMinor: number;
      optionalInvoiceAmountMinor?: number;
      replacementEstimateMinor: number;
      reactiveWorkOrderCount: number;
      ageYears?: number;
      expectedLifeYears: number;
      facts: string[];
      alreadyPlanned?: boolean;
    }
  | {
      kind: "equipment_not_selected";
    };

function formatMoney(minorUnits: number | undefined, currency: string) {
  if (minorUnits === undefined) return "Not set";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(minorUnits / 100);
}

function moneyInputValue(minorUnits: number | undefined) {
  return minorUnits === undefined ? "" : (minorUnits / 100).toFixed(2);
}

function currencySymbol(currency: string) {
  return (
    new Intl.NumberFormat("en-US", { style: "currency", currency })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? currency
  );
}

function toMinorUnits(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : undefined;
}

export function VendorServiceAuthorization({
  authorization,
  onIssue,
  onSaveDraft,
  defaultAcceptanceRequested = false,
  lifecycleReview,
  onOpenEquipmentHistory,
  onAddToCapexPlan,
  onSelectEquipment,
  className,
  isIssuing: issuingFromParent = false,
}: VendorServiceAuthorizationProps) {
  const formId = useId();
  const [useNte, setUseNte] = useState(authorization.nteMinorUnits !== undefined);
  const [nteValue, setNteValue] = useState(moneyInputValue(authorization.nteMinorUnits));
  const [sendByEmail, setSendByEmail] = useState(Boolean(authorization.vendor.dispatchEmail));
  const [email, setEmail] = useState(authorization.vendor.dispatchEmail ?? "");
  const [sendByText, setSendByText] = useState(false);
  const [phone, setPhone] = useState(authorization.vendor.dispatchPhone ?? "");
  const [acceptanceRequested, setAcceptanceRequested] = useState(
    defaultAcceptanceRequested,
  );
  const [vendorNote, setVendorNote] = useState("");
  const [localIssuing, setLocalIssuing] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copy number");
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState(false);

  const isIssuing = issuingFromParent || localIssuing;
  const nteMinorUnits = useNte ? toMinorUnits(nteValue) : undefined;

  function issueValue(): ServiceAuthorizationIssueValue {
    return {
      workOrderId: authorization.workOrderId,
      customerWorkOrderNumber: authorization.customerWorkOrderNumber,
      nteMinorUnits,
      currency: authorization.currency,
      sendByEmail,
      ...(sendByEmail ? { email: email.trim() } : {}),
      sendByText,
      ...(sendByText ? { phone: phone.trim() } : {}),
      acceptanceRequested,
      ...(vendorNote.trim() ? { vendorNote: vendorNote.trim() } : {}),
    };
  }

  function validate() {
    if (!sendByEmail && !sendByText) {
      return "Choose email, text message, or both before issuing the authorization.";
    }
    if (sendByEmail && !email.trim()) return "Enter the vendor dispatch email.";
    if (sendByText && !phone.trim()) return "Enter the vendor dispatch phone number.";
    if (useNte && (nteMinorUnits === undefined || nteMinorUnits < 0)) {
      return "Enter a valid not-to-exceed amount, or turn the limit off.";
    }
    return null;
  }

  async function handleIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setLocalIssuing(true);
      await onIssue(issueValue());
      setIssued(true);
    } catch {
      setError("The authorization was not issued. The work order remains saved for retry.");
    } finally {
      setLocalIssuing(false);
    }
  }

  async function handleSaveDraft() {
    if (!onSaveDraft) return;
    setError(null);
    try {
      setLocalIssuing(true);
      await onSaveDraft(issueValue());
    } catch {
      setError("The authorization settings could not be saved. Please try again.");
    } finally {
      setLocalIssuing(false);
    }
  }

  async function copyWorkOrderNumber() {
    try {
      await navigator.clipboard.writeText(authorization.customerWorkOrderNumber);
      setCopyLabel("Copied");
      window.setTimeout(() => setCopyLabel("Copy number"), 1600);
    } catch {
      setCopyLabel("Select number to copy");
    }
  }

  return (
    <form
      className={[styles.root, styles.surface, className].filter(Boolean).join(" ")}
      onSubmit={handleIssue}
      noValidate
    >
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <span className={styles.eyebrow}>Vendor issuance</span>
          <h2>Review the service authorization</h2>
          <p>
            This is the operator’s work order and billing reference. The vendor may continue
            using its own dispatch and service-ticket system.
          </p>
        </div>
        <span className={styles.statusPill}>
          <FileText aria-hidden="true" />
          Ready to issue
        </span>
      </header>

      {lifecycleReview?.kind === "review" ? (
        <section className={styles.lifecycleReview} aria-label="Repair or replacement review">
          <span className={styles.lifecycleIcon}><Gauge aria-hidden="true" /></span>
          <div className={styles.lifecycleCopy}>
            <span className={styles.lifecycleEyebrow}>Before this work is sent</span>
            <h3>Review repair or replacement</h3>
            <p>
              {lifecycleReview.assetCode} · {lifecycleReview.assetName}. This does not block the
              work order; it puts the useful history beside the send decision.
            </p>
            <div className={styles.lifecycleFacts}>
              <span><small>Completed-work cost</small><strong>{formatMoney(lifecycleReview.repairCostMinor, authorization.currency)}</strong></span>
              <span><small>Corrective work</small><strong>{lifecycleReview.reactiveWorkOrderCount} work orders</strong></span>
              <span><small>Equipment age</small><strong>{lifecycleReview.ageYears === undefined ? "Not recorded" : `${lifecycleReview.ageYears.toFixed(1)} of ${lifecycleReview.expectedLifeYears} years`}</strong></span>
              <span><small>Replace estimate</small><strong>{formatMoney(lifecycleReview.replacementEstimateMinor, authorization.currency)}</strong></span>
              {lifecycleReview.optionalInvoiceAmountMinor ? <span><small>Optional invoice check</small><strong>{formatMoney(lifecycleReview.optionalInvoiceAmountMinor, authorization.currency)}</strong></span> : null}
            </div>
            <div className={styles.lifecycleReasons}>
              {lifecycleReview.facts.slice(0, 3).map((fact) => <span key={fact}>{fact}</span>)}
            </div>
          </div>
          <div className={styles.lifecycleActions}>
            {onOpenEquipmentHistory ? (
              <button type="button" onClick={onOpenEquipmentHistory}>
                <History aria-hidden="true" /> Open full history
              </button>
            ) : null}
            {onAddToCapexPlan ? (
              <button type="button" onClick={onAddToCapexPlan} disabled={lifecycleReview.alreadyPlanned}>
                <CalendarPlus aria-hidden="true" />
                {lifecycleReview.alreadyPlanned ? "Already in CapEx plan" : "Add to CapEx plan"}
              </button>
            ) : null}
          </div>
        </section>
      ) : lifecycleReview?.kind === "equipment_not_selected" ? (
        <section className={`${styles.lifecycleReview} ${styles.lifecycleUnclassified}`} aria-label="Equipment not selected">
          <span className={styles.lifecycleIcon}><PackageSearch aria-hidden="true" /></span>
          <div className={styles.lifecycleCopy}>
            <span className={styles.lifecycleEyebrow}>Optional before sending</span>
            <h3>No equipment is selected</h3>
            <p>Select the equipment if you want to compare its repair history and replacement estimate. You can still issue this work order without it.</p>
          </div>
          {onSelectEquipment ? (
            <div className={styles.lifecycleActions}>
              <button type="button" onClick={onSelectEquipment}><PackageSearch aria-hidden="true" /> Select equipment</button>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className={styles.authorizationLayout}>
        <section
          className={styles.authorizationDocument}
          aria-label="Vendor service authorization preview"
        >
          <div className={styles.documentTopline}>
            <div>
              <span>Work order / service authorization</span>
              <h3>{authorization.vendor.name}</h3>
            </div>
            <div className={styles.workOrderNumber}>
              <small>Customer work order</small>
              <strong>{authorization.customerWorkOrderNumber}</strong>
              <button className={styles.copyButton} type="button" onClick={copyWorkOrderNumber}>
                <Copy aria-hidden="true" />
                {copyLabel}
              </button>
            </div>
          </div>

          <div className={styles.documentFacts}>
            <div className={styles.documentFact}>
              <span>Store</span>
              <strong>
                #{authorization.store.storeNumber} · {authorization.store.name}
              </strong>
            </div>
            <div className={styles.documentFact}>
              <span>Address</span>
              <strong>{authorization.store.address}</strong>
            </div>
            <div className={styles.documentFact}>
              <span>Priority</span>
              <strong>{authorization.priority.replaceAll("_", " ")}</strong>
            </div>
            <div className={styles.documentFact}>
              <span>Not to exceed</span>
              <strong>{useNte ? formatMoney(nteMinorUnits, authorization.currency) : "Not set"}</strong>
            </div>
            {authorization.requestedWindow ? (
              <div className={styles.documentFact}>
                <span>Requested service window</span>
                <strong>{authorization.requestedWindow}</strong>
              </div>
            ) : null}
            <div className={styles.documentFact}>
              <span>Issued to</span>
              <strong>{authorization.vendor.name}</strong>
            </div>
          </div>

          <div className={styles.documentBlock}>
            <span className={styles.summaryLabel}>Problem reported</span>
            <p>{authorization.problem}</p>
          </div>

          <div className={styles.documentBlock}>
            <span className={styles.summaryLabel}>Requested service</span>
            <p>
              {authorization.requestedService ??
                "Inspect the reported condition, make authorized repairs when practical, and document the outcome."}
            </p>
          </div>

          {authorization.accessInstructions ? (
            <div className={styles.documentBlock}>
              <span className={styles.summaryLabel}>Store access</span>
              <p>{authorization.accessInstructions}</p>
            </div>
          ) : null}

          <div className={styles.billingCallout}>
            <DollarSign aria-hidden="true" />
            <div>
              <strong>Invoice reference required</strong>
              <p>
                Include customer work order <b>{authorization.customerWorkOrderNumber}</b> on
                invoices and service documents. The vendor’s own job number and invoice number
                remain separate references.
              </p>
            </div>
          </div>
        </section>

        <aside className={styles.authorizationAside}>
          <h3 className={styles.asideTitle}>Issue settings</h3>
          <p className={styles.asideDescription}>
            Use only the controls this operator needs. Vendor acceptance remains optional.
          </p>

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={useNte}
              onChange={(event) => setUseNte(event.target.checked)}
            />
            <span>
              Add a not-to-exceed limit
              <small>The vendor should request approval before exceeding this amount.</small>
            </span>
          </label>
          {useNte ? (
            <div className={`${styles.subField} ${styles.field}`}>
              <label htmlFor={`${formId}-nte`}>NTE amount</label>
              <div className={styles.nteField}>
                <span aria-hidden="true">{currencySymbol(authorization.currency)}</span>
                <input
                  id={`${formId}-nte`}
                  className={styles.input}
                  type="number"
                  min="0"
                  step="0.01"
                  value={nteValue}
                  onChange={(event) => setNteValue(event.target.value)}
                  inputMode="decimal"
                />
              </div>
            </div>
          ) : null}

          <div className={styles.asideDivider} />

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={sendByEmail}
              onChange={(event) => setSendByEmail(event.target.checked)}
            />
            <span>
              Send by email
              <small>Includes the authorization and a secure vendor link.</small>
            </span>
          </label>
          {sendByEmail ? (
            <div className={`${styles.subField} ${styles.field}`}>
              <label htmlFor={`${formId}-email`}>Dispatch email</label>
              <input
                id={`${formId}-email`}
                className={styles.input}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="dispatch@vendor.com"
                autoComplete="email"
              />
            </div>
          ) : null}

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={sendByText}
              onChange={(event) => setSendByText(event.target.checked)}
            />
            <span>
              Also send by text
              <small>Useful for dispatch desks that act from a mobile phone.</small>
            </span>
          </label>
          {sendByText ? (
            <div className={`${styles.subField} ${styles.field}`}>
              <label htmlFor={`${formId}-phone`}>Dispatch phone</label>
              <input
                id={`${formId}-phone`}
                className={styles.input}
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="(555) 555-0123"
                autoComplete="tel"
              />
            </div>
          ) : null}

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={acceptanceRequested}
              onChange={(event) => setAcceptanceRequested(event.target.checked)}
            />
            <span>
              Ask the vendor to accept or decline
              <small>
                Optional. The authorization is still delivered when this is off; no portal
                account is required.
              </small>
            </span>
          </label>

          <div className={`${styles.field} ${styles.documentBlock}`}>
            <label htmlFor={`${formId}-note`}>Note to vendor (optional)</label>
            <textarea
              id={`${formId}-note`}
              className={styles.textarea}
              value={vendorNote}
              onChange={(event) => setVendorNote(event.target.value)}
              placeholder="Add access, coordination, or approval instructions."
            />
          </div>

          {error ? (
            <div className={styles.error} role="alert">
              <ShieldCheck aria-hidden="true" />
              {error}
            </div>
          ) : null}

          {issued ? (
            <div className={styles.successCallout} role="status">
              <CheckCircle2 aria-hidden="true" />
              <div>
                <strong>Authorization issued</strong>
                <p>
                  Delivery and any vendor response will remain attached to the work-order
                  timeline.
                </p>
              </div>
            </div>
          ) : null}

          <div className={styles.issueActions}>
            <button className={styles.primaryButton} type="submit" disabled={isIssuing}>
              <Send aria-hidden="true" />
              {isIssuing ? "Issuing…" : "Issue to vendor"}
            </button>
            {onSaveDraft ? (
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={handleSaveDraft}
                disabled={isIssuing}
              >
                <FileText aria-hidden="true" />
                Save without sending
              </button>
            ) : null}
          </div>

          <div className={styles.footerNote} style={{ marginTop: 15 }}>
            {sendByEmail ? <Mail aria-hidden="true" /> : <MessageSquareText aria-hidden="true" />}
            <span>
              The record keeps the recipient, channel, issued version, sent time, and delivery
              result. Prior versions stay available.
            </span>
          </div>
        </aside>
      </div>
    </form>
  );
}
