"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./work-prices.module.css";
export function WorkPriceForm({ workOrderId, version, scope, vendors, currency }: { workOrderId: string; version: number; scope: string; vendors: {id:string;name:string}[]; currency:string }) {
  const [kind, setKind] = useState("repair"), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [key] = useState(() => crypto.randomUUID()); const router = useRouter();
  return <form className={styles.form} onSubmit={async event => {
    event.preventDefault(); if (busy) return; setBusy(true); setError("");
    const data = new FormData(event.currentTarget); data.set("submissionKey", key); data.set("expectedVersion", String(version));
    try { const response = await fetch("/api/ops/work-orders/" + workOrderId + "/prices", {method:"POST",body:data});
      const result = await response.json() as {error?: string}; if (!response.ok) { setError(result.error ?? "Could not save. Try again."); return; }
      router.push("/app/work-orders/" + workOrderId + "?view=overview&notice=Price+saved#work-prices"); router.refresh();
    } catch { setError("Could not save. Try again."); } finally { setBusy(false); }
  }}>
    <label>Price for<select name="kind" value={kind} onChange={event => setKind(event.target.value)}><option value="repair">Repair</option><option value="replace">Replace</option></select></label>
    <label>Price ({currency})<input name="amount" inputMode="decimal" required placeholder="0.00" /></label><input name="currency" type="hidden" value={currency}/>
    <label>Vendor<select name="vendorId" required defaultValue=""><option value="" disabled>Choose</option>{vendors.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
    <label>Covers<select name="scopeKind" key={kind} required defaultValue={kind === "repair" ? "job" : ""}><option value="" disabled>Choose</option><option value="job">This job</option><option value="part">One part</option><option value="whole">Whole unit + setup</option></select></label>
    <label className={styles.wide}>Work<input name="scope" defaultValue={scope} required maxLength={2000}/></label>
    {error ? <p role="alert" className={styles.wide}>{error}</p> : null}
    <button disabled={busy}>{busy ? "Saving…" : "Save price"}</button>
  </form>;
}
