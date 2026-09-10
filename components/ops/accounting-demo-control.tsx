"use client";
import { useState, type FormEvent } from "react";
import styles from "./ops.module.css";

export function AccountingDemoControl() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setPending(true);
    try {
      const response = await fetch("/api/ops/accounting/demo", { method: "POST", body: new FormData(event.currentTarget) });
      if (!response.ok) { const body = await response.json() as { error?: string }; throw new Error(body.error ?? "The demo invoice could not be imported."); }
      window.location.assign(response.url);
    } catch (error) { setError(error instanceof Error ? error.message : "Check your connection and try again."); setPending(false); }
  }
  return <form onSubmit={submit} className={styles.controlForm}>
    <label className={styles.field}>Demonstration step<select name="step"><option value="new">1. Receive a maintenance bill</option><option value="replay">Receive the same version again</option><option value="uncertain">Receive a bill needing a match</option><option value="correction">2. Receive an amount correction</option><option value="payment">3. Receive payment status</option><option value="void">4. Receive a void</option><option value="credit">Receive a credit for the original bill</option><option value="merchandise">Filter out merchandise</option></select></label>
    {error ? <p className={styles.controlError} role="alert">Couldn’t import this invoice. {error}</p> : null}
    <button className={styles.secondaryButton} disabled={pending}>{pending ? "Importing…" : "Run demo import"}</button>
  </form>;
}
