"use client";
import { useRef, useState, type FormEvent } from "react";
import styles from "./invoice-intake-workspace.module.css";
const categories = ["labor", "part", "travel", "diagnostic", "equipment_rental", "disposal", "permit", "tax", "other_fee"];
export function InvoiceIntakeForm({ workOrderId, vendorId, contractVersionId }: { workOrderId: string; vendorId: string; contractVersionId?: string }) {
  const [count, setCount] = useState(1);
  const [error, setError] = useState(""), [saving, setSaving] = useState(false), pending = useRef(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true; setSaving(true); setError("");
    try {
      const response = await fetch("/api/ops/invoices", { method: "POST", body: new FormData(event.currentTarget) });
      if (response.ok && response.redirected && new URL(response.url).origin === window.location.origin) { window.location.assign(response.url); return; }
      const result: unknown = await response.json().catch(() => null);
      setError(result && typeof result === "object" && "error" in result && typeof result.error === "string" ? result.error : "Invoice could not be saved. Try again.");
    } catch { setError("Connection lost. Check the invoice list before trying again."); }
    pending.current = false; setSaving(false);
  }
  return <form action="/api/ops/invoices" method="post" encType="multipart/form-data" className={styles.form} onSubmit={save}>
    {error ? <p role="alert">{error}</p> : null}
    <input type="hidden" name="workOrderId" value={workOrderId} /><input type="hidden" name="vendorId" value={vendorId} /><input type="hidden" name="contractVersionId" value={contractVersionId ?? ""} /><input type="hidden" name="lineCount" value={count} />
    <div className={styles.fields}><label>Vendor invoice number<input name="vendorInvoiceNumber" required maxLength={160} /></label><label>Invoice date<input name="invoiceDate" type="date" required /></label><label>Currency<input name="currency" defaultValue="USD" minLength={3} maxLength={3} pattern="[A-Za-z]{3}" required /></label></div>
    <label>Invoice file (optional)<input name="invoiceFile" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" /><span>PDF or image · up to 15 MB</span></label>
    <h3>Invoice items</h3>{Array.from({ length: count }, (_, i) => i + 1).map(n => <fieldset key={n} className={styles.item}><legend>Item {n}</legend><label>Type<select name={`line${n}Category`} defaultValue={n === 1 ? "labor" : "part"}>{categories.map(c => <option key={c} value={c}>{c.replaceAll("_", " ")}</option>)}</select></label><label>Description<input name={`line${n}Description`} maxLength={500} required /></label><label>Amount<input name={`line${n}Amount`} inputMode="decimal" placeholder="0.00" required /></label></fieldset>)}
    <div className={styles.actions}>{count < 100 ? <button type="button" onClick={() => setCount(n => n + 1)}>Add item</button> : null}{count > 1 ? <button type="button" onClick={() => setCount(n => n - 1)}>Remove last item</button> : null}</div>
    <div className={styles.submit}><button type="submit" disabled={saving}>{saving ? "Saving…" : "Save invoice for review"}</button><span>Matching work does not approve or send payment.</span></div>
  </form>;
}
