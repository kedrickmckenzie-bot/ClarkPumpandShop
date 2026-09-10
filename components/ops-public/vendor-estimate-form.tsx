"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleDollarSign, FileCheck2, X } from "lucide-react";
import type { PublicActionReceipt, VendorEstimateView } from "./contracts";
import { ServerReceipt } from "./public-ui";
import styles from "./public-workflows.module.css";

type ResponseMode = "submit" | "decline";

export function VendorEstimateForm({ token, estimate }: { token: string; estimate: VendorEstimateView }) {
  const router = useRouter();
  const [mode, setMode] = useState<ResponseMode>("submit");
  const [responderName, setResponderName] = useState("");
  const [amount, setAmount] = useState(estimate.latestProposal?.amount ?? "");
  const [scope, setScope] = useState(estimate.latestProposal?.scope ?? estimate.requestedScope);
  const [exclusions, setExclusions] = useState(estimate.latestProposal?.exclusions ?? "");
  const [leadTimeDays, setLeadTimeDays] = useState(estimate.latestProposal?.leadTimeDays?.toString() ?? "");
  const [validUntil, setValidUntil] = useState(estimate.latestProposal?.validUntil?.slice(0, 10) ?? "");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<PublicActionReceipt | null>(null);

  if (receipt) return <><ServerReceipt receipt={receipt} /><div className={styles.actions}><button className={styles.button} type="button" onClick={() => window.location.reload()}>Review submitted quote and files</button></div></>;
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
        if (!response.ok) throw new Error(body.error ?? "The quote request could not be opened.");
        window.location.reload();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "The quote request could not be opened.");
        setSubmitting(false);
      }
    }
    return (
      <section className={styles.card} aria-labelledby="open-estimate-title">
        <span className={styles.eyebrow}>Vendor response</span>
        <h2 className={styles.cardTitle} id="open-estimate-title">Review this quote request</h2>
        <p className={styles.helper}>Review the requested work and send your price and availability. This is a quote request; service is not yet authorized.</p>
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
        <strong>This quote request is {estimate.statusLabel.toLocaleLowerCase("en-US")}.</strong>
        <p className={styles.helper}>Contact {estimate.organizationName} if a correction or new quote request is needed. This link cannot assign work, authorize service, start a visit, or support billing.</p>
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
      const form = new FormData();
      form.set("command", JSON.stringify(payload));
      if (mode === "submit") attachments.forEach((file) => form.append("attachments", file));
      const response = await fetch(`/api/ops-public/estimate/${encodeURIComponent(token)}`, {
        method: "POST", body: form,
      });
      const body = (await response.json()) as PublicActionReceipt & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "The quote response could not be recorded.");
      setReceipt(body);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The quote response could not be recorded.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className={styles.card} aria-labelledby="estimate-response-title">
      <div className={styles.cardHeader}>
        <div>
          <span className={styles.eyebrow}>Vendor response</span>
          <h2 className={styles.cardTitle} id="estimate-response-title">{estimate.latestProposal ? "Submit a revised quote" : "Submit a quote or decline the request"}</h2>
          <p className={styles.helper}>Send your price and scope. Wait for work approval before making a service call.</p>
        </div>
      </div>
      <div className={styles.tabs} role="group" aria-label="Quote response type">
        <button aria-pressed={mode === "submit"} className={`${styles.tab} ${mode === "submit" ? styles.tabActive : ""}`} onClick={() => setMode("submit")} type="button"><CircleDollarSign aria-hidden="true" size={16} /> {estimate.latestProposal ? "Revise quote" : "Submit quote"}</button>
        <button aria-pressed={mode === "decline"} className={`${styles.tab} ${mode === "decline" ? styles.tabActive : ""}`} onClick={() => setMode("decline")} type="button"><X aria-hidden="true" size={16} /> Decline request</button>
      </div>
      <form className={styles.form} onSubmit={submit} style={{ marginTop: "1.1rem" }}>
        <label className={styles.label}>Your name <span className={styles.required} aria-hidden="true">*</span>
          <input autoComplete="name" className={styles.input} maxLength={100} onChange={(event) => setResponderName(event.target.value)} required value={responderName} />
        </label>
        {mode === "submit" ? (
          <>
            <div className={styles.twoColumns}>
              <label className={styles.label}>Quote amount · USD <span className={styles.required} aria-hidden="true">*</span>
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
            <label className={styles.label}>Files for this quote version <span className={styles.helper}>Optional · up to 4 PDF or image files, 10 MB each. Add the files for this version; earlier versions keep their own files.</span>
              <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" multiple onChange={(event) => setAttachments(Array.from(event.target.files ?? []))} />
            </label>
            {estimate.localFileStorage ? <p className={styles.helper}>Local demo files are available until this server restarts.</p> : null}
            <label className={styles.label}>Quote valid through <span className={styles.helper}>Optional</span>
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
          <p>Your quote is for work order {estimate.operatorWorkOrderNumber}. The operator will review it before approving work.</p>
        </div>
        <div className={styles.actions}>
          <button className={mode === "decline" ? styles.dangerButton : styles.button} disabled={submitting} type="submit">
            {mode === "decline" ? <X aria-hidden="true" size={17} /> : <FileCheck2 aria-hidden="true" size={17} />}
            {submitting ? "Sending..." : mode === "decline" ? "Decline quote request" : estimate.latestProposal ? "Submit revised quote" : "Submit quote"}
          </button>
        </div>
      </form>
    </section>
  );
}
