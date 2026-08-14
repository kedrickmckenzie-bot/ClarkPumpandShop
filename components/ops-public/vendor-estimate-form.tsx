"use client";

import { useState } from "react";
import { CircleDollarSign, FileCheck2, X } from "lucide-react";
import type { PublicActionReceipt, VendorEstimateView } from "./contracts";
import { ServerReceipt } from "./public-ui";
import styles from "./public-workflows.module.css";

type ResponseMode = "submit" | "decline";

export function VendorEstimateForm({ token, estimate }: { token: string; estimate: VendorEstimateView }) {
  const [mode, setMode] = useState<ResponseMode>("submit");
  const [responderName, setResponderName] = useState("");
  const [amount, setAmount] = useState("");
  const [scope, setScope] = useState(estimate.latestProposal?.scope ?? estimate.requestedScope);
  const [exclusions, setExclusions] = useState(estimate.latestProposal?.exclusions ?? "");
  const [leadTimeDays, setLeadTimeDays] = useState(estimate.latestProposal?.leadTimeDays?.toString() ?? "");
  const [validUntil, setValidUntil] = useState(estimate.latestProposal?.validUntil?.slice(0, 10) ?? "");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<PublicActionReceipt | null>(null);

  if (receipt) return <ServerReceipt receipt={receipt} />;
  if (estimate.status === "requested") {
    async function openRequest() {
      setSubmitting(true);
      setError(null);
      try {
        const response = await fetch(`/api/ops-public/estimate/${encodeURIComponent(token)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "open" }),
        });
        const body = (await response.json()) as PublicActionReceipt & { error?: string };
        if (!response.ok) throw new Error(body.error ?? "The bid request could not be opened.");
        window.location.reload();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "The bid request could not be opened.");
        setSubmitting(false);
      }
    }
    return (
      <section className={styles.card} aria-labelledby="open-estimate-title">
        <span className={styles.eyebrow}>Vendor response</span>
        <h2 className={styles.cardTitle} id="open-estimate-title">Review this bid request</h2>
        <p className={styles.helper}>Opening the request records that a person reviewed it. Automated link previews and operator test views do not change its status. This is an RFP for pricing, not an onsite service call.</p>
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        <div className={styles.actions}>
          <button className={styles.button} disabled={submitting} onClick={openRequest} type="button">
            <FileCheck2 aria-hidden="true" size={17} />{submitting ? "Opening..." : "Open and respond"}
          </button>
        </div>
      </section>
    );
  }
  if (!estimate.canRespond) {
    return (
      <section className={styles.notice}>
        <strong>This bid request is {estimate.statusLabel.toLocaleLowerCase("en-US")}.</strong>
        <p className={styles.helper}>Contact {estimate.organizationName} if a correction or new bid request is needed. This link cannot assign work, authorize service, start a visit, or support billing.</p>
      </section>
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = mode === "decline"
        ? { action: "decline", responderName, expectedRevision: estimate.latestProposal?.revision ?? 0, reason }
        : {
            action: "submit",
            responderName,
            expectedRevision: estimate.latestProposal?.revision ?? 0,
            amount,
            currency: "USD",
            scope,
            exclusions,
            leadTimeDays: leadTimeDays ? Number(leadTimeDays) : undefined,
            validUntil: validUntil || undefined,
          };
      const response = await fetch(`/api/ops-public/estimate/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as PublicActionReceipt & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "The bid response could not be recorded.");
      setReceipt(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The bid response could not be recorded.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className={styles.card} aria-labelledby="estimate-response-title">
      <div className={styles.cardHeader}>
        <div>
          <span className={styles.eyebrow}>Vendor response</span>
          <h2 className={styles.cardTitle} id="estimate-response-title">Submit a bid or decline the request</h2>
          <p className={styles.helper}>No account is required. This RFP asks for pricing by the stated due date. A submitted bid does not assign your company or authorize travel, check-in, service, or billing.</p>
        </div>
      </div>
      <div className={styles.tabs} role="group" aria-label="Bid response type">
        <button aria-pressed={mode === "submit"} className={`${styles.tab} ${mode === "submit" ? styles.tabActive : ""}`} onClick={() => setMode("submit")} type="button"><CircleDollarSign aria-hidden="true" size={16} /> Submit bid</button>
        <button aria-pressed={mode === "decline"} className={`${styles.tab} ${mode === "decline" ? styles.tabActive : ""}`} onClick={() => setMode("decline")} type="button"><X aria-hidden="true" size={16} /> Decline request</button>
      </div>
      <form className={styles.form} onSubmit={submit} style={{ marginTop: "1.1rem" }}>
        <label className={styles.label}>Your name <span className={styles.required} aria-hidden="true">*</span>
          <input autoComplete="name" className={styles.input} maxLength={100} onChange={(event) => setResponderName(event.target.value)} required value={responderName} />
        </label>
        {mode === "submit" ? (
          <>
            <div className={styles.twoColumns}>
              <label className={styles.label}>Bid amount <span className={styles.required} aria-hidden="true">*</span>
                <input className={styles.input} inputMode="decimal" min="0" onChange={(event) => setAmount(event.target.value)} placeholder="0.00" required step="0.01" type="number" value={amount} />
              </label>
              <label className={styles.label}>Lead time in days <span className={styles.helper}>Optional</span>
                <input className={styles.input} min="0" onChange={(event) => setLeadTimeDays(event.target.value)} step="1" type="number" value={leadTimeDays} />
              </label>
            </div>
            <label className={styles.label}>Proposed scope <span className={styles.required} aria-hidden="true">*</span>
              <textarea className={styles.textarea} maxLength={3000} onChange={(event) => setScope(event.target.value)} required value={scope} />
            </label>
            <label className={styles.label}>Exclusions or assumptions <span className={styles.helper}>Optional</span>
              <textarea className={styles.textarea} maxLength={2000} onChange={(event) => setExclusions(event.target.value)} value={exclusions} />
            </label>
            <label className={styles.label}>Bid valid through <span className={styles.helper}>Optional</span>
              <input className={styles.input} onChange={(event) => setValidUntil(event.target.value)} type="date" value={validUntil} />
            </label>
          </>
        ) : (
          <label className={styles.label}>Reason for declining <span className={styles.required} aria-hidden="true">*</span>
            <textarea className={styles.textarea} maxLength={1000} onChange={(event) => setReason(event.target.value)} required value={reason} />
          </label>
        )}
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        <div className={styles.callout}>
          <strong>Pricing only - no service authorization</strong>
          <p>This bid stays attached to operator work order {estimate.operatorWorkOrderNumber} as comparison evidence. It does not create a second work order, recorded cost, invoice, assignment, technician visit, or permission to perform the repair.</p>
        </div>
        <div className={styles.actions}>
          <button className={mode === "decline" ? styles.dangerButton : styles.button} disabled={submitting} type="submit">
            {mode === "decline" ? <X aria-hidden="true" size={17} /> : <FileCheck2 aria-hidden="true" size={17} />}
            {submitting ? "Sending..." : mode === "decline" ? "Decline bid request" : "Submit bid"}
          </button>
        </div>
      </form>
    </section>
  );
}
