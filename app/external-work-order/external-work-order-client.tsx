"use client";

import { type FormEvent, useId, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  Info,
  MapPin,
  MessageSquareText,
  ReceiptText,
  ShieldCheck,
  Store,
  Wrench,
  XCircle,
} from "lucide-react";

import styles from "./external-work-order.module.css";

export interface ExternalAuthorizationQuery {
  scenarioId: string;
  workOrderNumber: string;
  store: string;
  address: string;
  vendor: string;
  problem: string;
  scope: string;
  nte: string;
  nteMinor: string;
  requestedWindow: string;
  accessInstructions: string;
}

export interface ExternalWorkOrderClientProps {
  authorization: ExternalAuthorizationQuery;
}

type VendorResponse = "accepted" | "date_proposed" | "declined";

interface ResponseReceipt {
  response: VendorResponse;
  proposedDate?: string;
  proposedTime?: string;
  note?: string;
  openerNotified: boolean;
}

function formatNte(nte: string, nteMinor: string) {
  const explicitMinor = Number(nteMinor.replaceAll(",", ""));
  if (nteMinor && Number.isFinite(explicitMinor)) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(explicitMinor / 100);
  }

  const trimmed = nte.trim();
  if (!trimmed) return "No limit specified";
  if (/[$€£]/.test(trimmed)) return trimmed;

  const numeric = Number(trimmed.replaceAll(",", ""));
  if (!Number.isFinite(numeric)) return trimmed;

  // Friendly URLs commonly send dollars while the application sends integer minor units.
  const dollars = !trimmed.includes(".") && numeric >= 10_000 ? numeric / 100 : numeric;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(dollars);
}

function responseLabel(response: VendorResponse) {
  return response === "accepted"
    ? "Work order accepted"
    : response === "date_proposed"
      ? "Service date proposed"
      : "Work order declined";
}

function formatProposedDate(date: string, time?: string) {
  if (!date) return "";
  const parsed = new Date(`${date}T${time || "12:00"}:00`);
  if (Number.isNaN(parsed.getTime())) return [date, time].filter(Boolean).join(" at ");
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    ...(time ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(parsed);
}

export function ExternalWorkOrderClient({ authorization }: ExternalWorkOrderClientProps) {
  const formId = useId();
  const [responsePanel, setResponsePanel] = useState<"date" | "decline" | null>(null);
  const [proposedDate, setProposedDate] = useState("");
  const [proposedTime, setProposedTime] = useState("");
  const [note, setNote] = useState("");
  const [receipt, setReceipt] = useState<ResponseReceipt | null>(null);

  const nteLabel = formatNte(authorization.nte, authorization.nteMinor);

  function sendResponse(
    response: VendorResponse,
    details?: { proposedDate?: string; proposedTime?: string; note?: string },
  ) {
    const openerAvailable = Boolean(window.opener && !window.opener.closed);
    const payload = {
      response,
      scenarioId: authorization.scenarioId,
      workOrderNumber: authorization.workOrderNumber,
      ...(details?.proposedDate ? { proposedDate: details.proposedDate } : {}),
      ...(details?.proposedTime ? { proposedTime: details.proposedTime } : {}),
      ...(details?.note ? { note: details.note } : {}),
    };

    if (openerAvailable) {
      window.opener.postMessage(
        {
          type: "traceops:guided-vendor-response",
          payload,
        },
        window.location.origin,
      );
    }

    setReceipt({
      response,
      ...details,
      openerNotified: openerAvailable,
    });
    setResponsePanel(null);
  }

  function submitProposedDate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!proposedDate) return;
    sendResponse("date_proposed", {
      proposedDate,
      ...(proposedTime ? { proposedTime } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    });
  }

  function submitDecline(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendResponse("declined", note.trim() ? { note: note.trim() } : undefined);
  }

  if (receipt) {
    const isDeclined = receipt.response === "declined";
    return (
      <main className={styles.page}>
        <section className={styles.confirmation} aria-live="polite">
          <div className={isDeclined ? styles.confirmationIconDeclined : styles.confirmationIcon}>
            {isDeclined ? <XCircle aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
          </div>
          <span className={styles.demoPill}>Demo vendor response</span>
          <h1>{responseLabel(receipt.response)}</h1>
          <p className={styles.confirmationReference}>
            Customer work order <strong>{authorization.workOrderNumber}</strong>
          </p>
          {receipt.response === "date_proposed" && receipt.proposedDate ? (
            <div className={styles.responseSummary}>
              <CalendarClock aria-hidden="true" />
              <div>
                <span>Proposed arrival</span>
                <strong>{formatProposedDate(receipt.proposedDate, receipt.proposedTime)}</strong>
              </div>
            </div>
          ) : null}
          {receipt.note ? (
            <div className={styles.responseSummary}>
              <MessageSquareText aria-hidden="true" />
              <div>
                <span>Vendor note</span>
                <strong>{receipt.note}</strong>
              </div>
            </div>
          ) : null}
          <p className={styles.confirmationCopy}>
            {receipt.openerNotified
              ? "The TraceOps demo was notified. Return to the original tab to see this response attached to the work order."
              : "This mock response was recorded on this page. No original TraceOps tab was available to receive it."}
          </p>
          <div className={styles.confirmationActions}>
            <button className={styles.primaryButton} type="button" onClick={() => window.close()}>
              Close this tab
            </button>
            <Link className={styles.secondaryButton} href="/">
              <ArrowLeft aria-hidden="true" />
              Return to TraceOps demo
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.siteHeader}>
        <Link className={styles.brand} href="/" aria-label="TraceOps demo home">
          <span className={styles.brandMark}>T</span>
          <span>
            <strong>TraceOps</strong>
            <small>External service authorization</small>
          </span>
        </Link>
        <div className={styles.secureLabel}>
          <ShieldCheck aria-hidden="true" />
          Secure work-order link · Demo Mode
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <div>
            <span className={styles.eyebrow}>Customer work order / service authorization</span>
            <h1>{authorization.workOrderNumber}</h1>
            <p>
              Issued to <strong>{authorization.vendor}</strong>. Review the requested work and
              respond below. You may continue using your own dispatch and service-ticket system.
            </p>
          </div>
          <div className={styles.heroReference}>
            <ReceiptText aria-hidden="true" />
            <span>Billing reference</span>
            <strong>{authorization.workOrderNumber}</strong>
            <small>Include this number on the invoice and service ticket.</small>
          </div>
        </section>

        <div className={styles.layout}>
          <div className={styles.documentColumn}>
            <section className={styles.card} aria-labelledby="location-heading">
              <header className={styles.cardHeader}>
                <span className={styles.cardIcon}>
                  <Store aria-hidden="true" />
                </span>
                <div>
                  <span>Service location</span>
                  <h2 id="location-heading">{authorization.store}</h2>
                </div>
              </header>
              <div className={styles.locationLine}>
                <MapPin aria-hidden="true" />
                <span>{authorization.address}</span>
              </div>
              <dl className={styles.factGrid}>
                <div>
                  <dt>Requested window</dt>
                  <dd>{authorization.requestedWindow}</dd>
                </div>
                <div>
                  <dt>Not to exceed</dt>
                  <dd>{nteLabel}</dd>
                </div>
              </dl>
            </section>

            <section className={styles.card} aria-labelledby="scope-heading">
              <header className={styles.cardHeader}>
                <span className={styles.cardIcon}>
                  <Wrench aria-hidden="true" />
                </span>
                <div>
                  <span>Authorized service</span>
                  <h2 id="scope-heading">Problem and scope</h2>
                </div>
              </header>
              <div className={styles.contentBlock}>
                <span>Problem reported by the customer</span>
                <p>{authorization.problem}</p>
              </div>
              <div className={styles.contentBlock}>
                <span>Authorized scope</span>
                <p>{authorization.scope}</p>
              </div>
              <div className={styles.nteCallout}>
                <CircleDollarSign aria-hidden="true" />
                <div>
                  <strong>NTE: {nteLabel}</strong>
                  <p>
                    Contact the customer before exceeding this amount or materially changing the
                    authorized scope. This authorization is not a promise of payment for unrelated
                    work.
                  </p>
                </div>
              </div>
            </section>

            <section className={styles.card} aria-labelledby="visit-heading">
              <header className={styles.cardHeader}>
                <span className={styles.cardIcon}>
                  <BadgeCheck aria-hidden="true" />
                </span>
                <div>
                  <span>Visit evidence</span>
                  <h2 id="visit-heading">Arrival and checkout</h2>
                </div>
              </header>
              <p className={styles.accessCopy}>{authorization.accessInstructions}</p>
              <ol className={styles.instructionList}>
                <li>
                  <span>1</span>
                  <div>
                    <strong>Check in when you arrive</strong>
                    <p>Select this customer work-order number. If it is unavailable, use the no-work-order option and explain why you are there.</p>
                  </div>
                </li>
                <li>
                  <span>2</span>
                  <div>
                    <strong>Complete the authorized work</strong>
                    <p>Photos and documents are optional unless the customer specifically requests them.</p>
                  </div>
                </li>
                <li>
                  <span>3</span>
                  <div>
                    <strong>Check out with an outcome</strong>
                    <p>Choose resolved, waiting on parts, return visit required, or unresolved. Recorded presence is supporting evidence, not automatic billable labor.</p>
                  </div>
                </li>
              </ol>
              <div className={styles.privacyNote}>
                <Info aria-hidden="true" />
                Location, when required, is captured only at check-in or checkout. TraceOps does not continuously track technicians.
              </div>
            </section>
          </div>

          <aside className={styles.responseColumn} aria-labelledby="response-heading">
            <div className={styles.responseCard}>
              <span className={styles.eyebrow}>Vendor response</span>
              <h2 id="response-heading">Can you take this work?</h2>
              <p>
                Respond without creating an account. The customer will see your choice on its work order.
              </p>

              <div className={styles.primaryResponses}>
                <button
                  className={styles.acceptButton}
                  type="button"
                  onClick={() => sendResponse("accepted")}
                >
                  <CheckCircle2 aria-hidden="true" />
                  <span>
                    <strong>Accept work order</strong>
                    <small>Confirm that your company will handle it.</small>
                  </span>
                </button>
                <button
                  className={styles.proposeButton}
                  type="button"
                  onClick={() => {
                    setResponsePanel("date");
                    setNote("");
                  }}
                  aria-expanded={responsePanel === "date"}
                  aria-controls={`${formId}-date-panel`}
                >
                  <CalendarClock aria-hidden="true" />
                  <span>
                    <strong>Propose a date</strong>
                    <small>Suggest when a technician can arrive.</small>
                  </span>
                </button>
                <button
                  className={styles.declineButton}
                  type="button"
                  onClick={() => {
                    setResponsePanel("decline");
                    setNote("");
                  }}
                  aria-expanded={responsePanel === "decline"}
                  aria-controls={`${formId}-decline-panel`}
                >
                  <XCircle aria-hidden="true" />
                  <span>
                    <strong>Decline</strong>
                    <small>Tell the customer you cannot take this work.</small>
                  </span>
                </button>
              </div>

              {responsePanel === "date" ? (
                <form
                  id={`${formId}-date-panel`}
                  className={styles.responseForm}
                  onSubmit={submitProposedDate}
                >
                  <h3>Propose an arrival</h3>
                  <div className={styles.twoFields}>
                    <label>
                      <span>Date</span>
                      <input
                        type="date"
                        value={proposedDate}
                        onChange={(event) => setProposedDate(event.target.value)}
                        required
                      />
                    </label>
                    <label>
                      <span>Approximate time</span>
                      <input
                        type="time"
                        value={proposedTime}
                        onChange={(event) => setProposedTime(event.target.value)}
                      />
                    </label>
                  </div>
                  <label>
                    <span>Note (optional)</span>
                    <textarea
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Add scheduling context for the customer."
                    />
                  </label>
                  <div className={styles.formActions}>
                    <button className={styles.primaryButton} type="submit">
                      <Clock3 aria-hidden="true" />
                      Send proposed date
                    </button>
                    <button className={styles.textButton} type="button" onClick={() => setResponsePanel(null)}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : null}

              {responsePanel === "decline" ? (
                <form
                  id={`${formId}-decline-panel`}
                  className={styles.responseForm}
                  onSubmit={submitDecline}
                >
                  <h3>Decline this work order</h3>
                  <label>
                    <span>Reason (optional)</span>
                    <textarea
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Example: outside our service area this week."
                    />
                  </label>
                  <div className={styles.formActions}>
                    <button className={styles.dangerButton} type="submit">
                      <XCircle aria-hidden="true" />
                      Confirm decline
                    </button>
                    <button className={styles.textButton} type="button" onClick={() => setResponsePanel(null)}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : null}

              <div className={styles.helpBox}>
                <FileCheck2 aria-hidden="true" />
                <p>
                  Your response does not replace your company’s own work ticket. Keep this customer work-order number with the job for billing.
                </p>
              </div>
            </div>

            <div className={styles.contactCard}>
              <Building2 aria-hidden="true" />
              <div>
                <strong>Questions about scope or authorization?</strong>
                <p>Reply through the original work-order message or contact the customer’s facilities coordinator before proceeding.</p>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <footer className={styles.footer}>
        <span>TraceOps Convenience Suite · External vendor view</span>
        <span>Demo Mode · No real dispatch or billing action occurs</span>
      </footer>
    </div>
  );
}
