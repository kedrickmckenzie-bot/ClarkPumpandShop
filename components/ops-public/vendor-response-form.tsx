"use client";

import { useState } from "react";
import { CalendarClock, Check, FileCheck2, HelpCircle, X } from "lucide-react";
import type { PublicActionReceipt, PublicVendorResponseKind } from "./contracts";
import { ServerReceipt } from "./public-ui";
import styles from "./public-workflows.module.css";

const RESPONSE_OPTIONS: Array<{
  id: PublicVendorResponseKind;
  title: string;
  description: string;
  icon: typeof Check;
}> = [
  { id: "accepted", title: "Accept work", description: "Confirm that your company will take this service call.", icon: Check },
  { id: "proposed_date", title: "Propose a date", description: "Send the operator an expected arrival date and time.", icon: CalendarClock },
  { id: "question", title: "Ask a question", description: "Request clarification without accepting or declining yet.", icon: HelpCircle },
  { id: "declined", title: "Decline work", description: "Return the service call to the operator with a reason.", icon: X },
];

export function VendorResponseForm({ token, opened, organizationName, disabled = false }: { token: string; opened: boolean; organizationName: string; disabled?: boolean }) {
  const [response, setResponse] = useState<PublicVendorResponseKind | null>(null);
  const [responderName, setResponderName] = useState("");
  const [proposedArrival, setProposedArrival] = useState("");
  const [detail, setDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<PublicActionReceipt | null>(null);

  if (receipt) return <ServerReceipt receipt={receipt} />;

  if (!opened) {
    async function openAuthorization() {
      setSubmitting(true);
      setError(null);
      try {
        const result = await fetch(`/api/ops-public/service/${encodeURIComponent(token)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "open" }),
        });
        const body = (await result.json()) as PublicActionReceipt & { error?: string };
        if (!result.ok) throw new Error(body.error ?? "The service authorization could not be opened.");
        window.location.reload();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "The service authorization could not be opened.");
        setSubmitting(false);
      }
    }
    return (
      <section className={styles.card} aria-labelledby="open-service-title">
        <span className={styles.eyebrow}>Vendor response</span>
        <h2 className={styles.cardTitle} id="open-service-title">Review this service authorization</h2>
        <p className={styles.helper}>Opening records that a person reviewed it. Automated email previews and operator test views do not change its status.</p>
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        <div className={styles.actions}>
          <button className={styles.button} disabled={submitting} onClick={openAuthorization} type="button">
            <FileCheck2 aria-hidden="true" size={17} />{submitting ? "Opening..." : "Open and respond"}
          </button>
        </div>
      </section>
    );
  }

  async function submitResponse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!response) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await fetch(`/api/ops-public/service/${encodeURIComponent(token)}/response`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response, responderName, proposedArrival, detail }),
      });
      const body = (await result.json()) as PublicActionReceipt & { error?: string };
      if (!result.ok) throw new Error(body.error ?? `${organizationName} could not receive the response. Try again.`);
      setReceipt(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The response could not be sent. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!response) {
    return (
      <section className={styles.card} aria-labelledby="respond-title">
        <div className={styles.cardHeader}>
          <div>
            <h2 className={styles.cardTitle} id="respond-title">Respond to {organizationName}</h2>
            <p className={styles.helper}>No account or app is required. Choose one action.</p>
          </div>
        </div>
        <div className={styles.choiceGrid}>
          {RESPONSE_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <button className={styles.choiceCard} disabled={disabled} key={option.id} onClick={() => setResponse(option.id)} type="button">
                <span><Icon size={20} aria-hidden="true" /> <span className={styles.choiceTitle}>{option.title}</span></span>
                <span className={styles.choiceDescription}>{option.description}</span>
              </button>
            );
          })}
        </div>
        {disabled ? <p className={styles.notice}>A response has already been recorded. Contact {organizationName} Facilities if it needs to be amended.</p> : null}
      </section>
    );
  }

  const chosen = RESPONSE_OPTIONS.find((option) => option.id === response)!;
  return (
    <section className={styles.card} aria-labelledby="response-details-title">
      <div className={styles.cardHeader}>
        <div>
          <span className={styles.eyebrow}>Your response</span>
          <h2 className={styles.cardTitle} id="response-details-title">{chosen.title}</h2>
        </div>
        <button className={styles.secondaryButton} disabled={submitting} onClick={() => setResponse(null)} type="button">Change</button>
      </div>
      <form className={styles.form} onSubmit={submitResponse}>
        <label className={styles.label}>Your name <span className={styles.required} aria-hidden="true">*</span>
          <input autoComplete="name" className={styles.input} maxLength={100} onChange={(event) => setResponderName(event.target.value)} required value={responderName} />
        </label>
        {response === "proposed_date" ? (
          <label className={styles.label}>Proposed arrival <span className={styles.required} aria-hidden="true">*</span>
            <input className={styles.input} onChange={(event) => setProposedArrival(event.target.value)} required type="datetime-local" value={proposedArrival} />
          </label>
        ) : null}
        {response !== "accepted" ? (
          <label className={styles.label}>
            {response === "question" ? "Question" : response === "declined" ? "Reason for declining" : "Scheduling note"}
            <textarea className={styles.textarea} maxLength={1000} onChange={(event) => setDetail(event.target.value)} required={response === "question" || response === "declined"} value={detail} />
          </label>
        ) : null}
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        <div className={styles.actions}>
          <button className={response === "declined" ? styles.dangerButton : styles.button} disabled={submitting} type="submit">
            {submitting ? "Sending…" : `Send: ${chosen.title}`}
          </button>
        </div>
      </form>
    </section>
  );
}
