"use client";
import { useState, type FormEvent } from "react";
import type { AccountingInvoiceDelivery } from "@/lib/ops/accounting-import";
import styles from "./ops.module.css";

export function AccountingImportReview({ sourceId, version, delivery, vendors, work, invoices, linkedInvoiceId }: {
  sourceId: string; version: number; linkedInvoiceId?: string; delivery: AccountingInvoiceDelivery;
  vendors: Array<{ id: string; name: string }>;
  work: Array<{ id: string; number: string; problem: string }>;
  invoices: Array<{ id: string; vendorInvoiceNumber: string }>;
}) {
  const [splits, setSplits] = useState(delivery.lines.map((line) => ({ lineId: line.id, workOrderId: "", amount: (line.amountMinor / 100).toFixed(2) })));
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setPending(true);
    const form = new FormData(event.currentTarget);
    form.set("splits", JSON.stringify(delivery.kind === "credit" ? [] : splits));
    try {
      const response = await fetch("/api/ops/accounting/review", { method: "POST", body: form });
      if (!response.ok) { const body = await response.json() as { error?: string }; throw new Error(body.error ?? "The match could not be saved."); }
      window.location.assign(response.url);
    } catch (error) { setError(error instanceof Error ? error.message : "Check your connection and try again."); setPending(false); }
  }
  return <form onSubmit={submit} className={styles.controlForm}>
    <input type="hidden" name="sourceId" value={sourceId} /><input type="hidden" name="expectedVersion" value={version} />
    <label className={styles.field}>Vendor<select name="vendorId" required defaultValue={delivery.vendorId ?? ""}><option value="">Choose the vendor</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></label>
    {linkedInvoiceId ? <input type="hidden" name="existingInvoiceId" value={linkedInvoiceId} /> : <label className={styles.field}>{delivery.kind === "credit" ? "Original invoice" : "Existing invoice, if already entered"}<select name="existingInvoiceId" required={delivery.kind === "credit"} defaultValue=""><option value="">{delivery.kind === "credit" ? "Choose the original bill" : "Create an invoice after review"}</option>{invoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.vendorInvoiceNumber}</option>)}</select></label>}
    {delivery.kind === "bill" ? delivery.lines.map((line) => <fieldset key={line.id}><legend>{line.description} · {(line.amountMinor / 100).toFixed(2)} {delivery.currency}</legend>
      {splits.map((split, index) => split.lineId === line.id ? <div className={styles.fieldGrid} key={index}>
        <label className={styles.field}>Work order<select required value={split.workOrderId} onChange={(event) => setSplits(splits.map((item, position) => position === index ? { ...item, workOrderId: event.target.value } : item))}><option value="">Choose work</option>{work.map((item) => <option key={item.id} value={item.id}>{item.number} — {item.problem}</option>)}</select></label>
        <label className={styles.field}>Amount<input type="number" min="0" step="0.01" required value={split.amount} onChange={(event) => setSplits(splits.map((item, position) => position === index ? { ...item, amount: event.target.value } : item))} /></label>
        <button type="button" className={styles.secondaryButton} onClick={() => setSplits(splits.filter((_, position) => position !== index))}>Remove split</button>
      </div> : null)}
      <button type="button" className={styles.secondaryButton} onClick={() => setSplits([...splits, { lineId: line.id, workOrderId: "", amount: "0.00" }])}>Split between more work orders</button>
    </fieldset>) : <p>This links the accounting credit to its original invoice. It does not record savings or change the repair status.</p>}
    <label className={styles.field}>Review note<textarea name="reason" required rows={2} maxLength={2000} /></label>
    {!linkedInvoiceId && invoices.length && delivery.kind === "bill" ? <label><input type="checkbox" name="confirmDistinctInvoice" value="true" /> I checked the existing invoices. This is a different bill from another accounting company.</label> : null}
    {error ? <p role="alert" className={styles.controlError}>{error}</p> : null}
    <p>Saving confirms the linked work. Accounting remains responsible for invoice amounts and payment status.</p>
    <button className={styles.primaryButton} disabled={pending} type="submit">{pending ? "Saving…" : "Save invoice match"}</button>
  </form>;
}
