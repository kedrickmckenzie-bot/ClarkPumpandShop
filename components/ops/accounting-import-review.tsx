"use client";
import { useRef, useState, type FormEvent } from "react";
import type { AccountingReviewModel } from "@/lib/ops/accounting-review-model";
import { accountingDraftAmounts, createAccountingDraft, recoverAccountingDraft, retainAccountingChoices } from "@/lib/ops/accounting-review-draft";
import styles from "./ops.module.css";
import layout from "./accounting-workspace.module.css";

export function AccountingImportReview({ initial }: { initial: AccountingReviewModel }) {
  const [model, setModel] = useState(initial);
  const [draft, setDraft] = useState(() => createAccountingDraft(initial));
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [latest, setLatest] = useState<AccountingReviewModel>();
  const [pending, setPending] = useState(false);
  const [searching, setSearching] = useState(false);
  const sequence = useRef(0);
  const amounts = accountingDraftAmounts(model, draft);
  const money = (minor: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: model.delivery.currency }).format(minor / 100);
  async function search(vendorId = draft.vendorId) {
    const current = ++sequence.current;
    setSearching(true);
    try {
      const response = await fetch(`/api/ops/accounting/review-options?${new URLSearchParams({ source: model.sourceId, q: query, vendor: vendorId })}`);
      const result = await response.json() as AccountingReviewModel & { error?: string };
      if (current !== sequence.current) return;
      if (!response.ok) throw new Error(result.error ?? "Search could not be loaded. Your draft is still here.");
      const next = result as AccountingReviewModel;
      setDraft((draft) => retainAccountingChoices(draft, next.work));
      if (next.version !== draft.version) { setLatest(next); setError("Accounting or another reviewer changed this invoice. Your draft is still here. Review the latest invoice before saving."); }
      else setModel(next);
    } catch (error) { if (current === sequence.current) setError(error instanceof Error ? error.message : "Search could not be loaded. Your draft is still here."); }
    finally { if (current === sequence.current) setSearching(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (latest) { setError("Review the latest invoice before saving this draft."); return; }
    if (model.delivery.kind === "bill" && amounts.some((amount) => !amount.valid)) { setError("Choose the work for every split and make each item's allocated amount equal its charge."); return; }
    setPending(true);
    const form = new FormData();
    for (const [key, value] of Object.entries({ sourceId: model.sourceId, expectedVersion: String(draft.version), vendorId: draft.vendorId, existingInvoiceId: draft.existingInvoiceId, reason: draft.reason, confirmDistinctInvoice: String(draft.distinct), splits: JSON.stringify(model.delivery.kind === "credit" ? [] : draft.splits) })) form.set(key, value);
    try {
      const response = await fetch("/api/ops/accounting/review", { method: "POST", body: form });
      if (!response.ok) {
        const body = await response.json() as { error?: string };
        setError(body.error ?? "The match could not be saved. Your draft is still here.");
        if (response.status === 409) await search();
        return;
      }
      window.location.assign(response.url);
    } catch { setError("The match could not be saved. Check your connection and try again; your draft is still here."); }
    finally { setPending(false); }
  }
  return <form onSubmit={submit} className={`${styles.controlForm} ${layout.reviewForm}`}>
    <label className={styles.field}>Vendor<select required value={draft.vendorId} onChange={(event) => { const vendorId = event.target.value; setDraft({ ...draft, vendorId, existingInvoiceId: model.linkedInvoiceId ?? "", distinct: false }); void search(vendorId); }}><option value="">Choose the vendor</option>{model.vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></label>
    {!model.linkedInvoiceId ? <label className={styles.field}>{model.delivery.kind === "credit" ? "Original invoice" : "Existing invoice, if already entered"}<select required={model.delivery.kind === "credit"} value={draft.existingInvoiceId} onChange={(event) => setDraft({ ...draft, existingInvoiceId: event.target.value })}><option value="">{model.delivery.kind === "credit" ? "Choose the original bill" : "Create an invoice after review"}</option>{model.invoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.vendorInvoiceNumber}</option>)}</select></label> : <p>Editing the linked invoice. This does not create another invoice.</p>}
    <div className={layout.search}><label className={styles.field}>Find work by store, work order, or problem<input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void search(); } }} /></label><button type="button" className={styles.secondaryButton} disabled={searching} onClick={() => void search()}>{searching ? "Searching…" : "Find related work"}</button></div>
    <p>Search updates the choices below. Selected work, amounts and notes stay in your draft.</p>
    {latest ? <section role="alert"><strong>This invoice changed during review.</strong>{latest.changeReasons.map((reason) => <p key={reason}>{reason}</p>)}<p>Latest source total: {new Intl.NumberFormat("en-US", { style: "currency", currency: latest.delivery.currency }).format(latest.delivery.totalMinor / 100)}. Removed items will leave the draft; retained splits still need your review.</p><button type="button" className={styles.secondaryButton} onClick={() => { setDraft(recoverAccountingDraft(draft, latest)); setModel(latest); setLatest(undefined); setError("Latest invoice loaded. Check every split before saving."); }}>Review latest invoice with my draft</button></section> : null}
    {model.delivery.kind === "bill" ? model.delivery.lines.map((line) => { const amount = amounts.find((row) => row.id === line.id)!; return <fieldset key={line.id}><legend>{line.description}</legend>
      <p className={layout.amounts}>Charge {money(amount.total)} · Allocated {money(amount.allocated)} · {amount.remaining < 0 ? `Over by ${money(-amount.remaining)}` : `Remaining ${money(amount.remaining)}`}</p>
      {draft.splits.map((split, index) => split.lineId === line.id ? <div className={layout.split} key={index}>
        <label className={styles.field}>Work order<select required value={split.workOrderId} onChange={(event) => setDraft({ ...draft, splits: draft.splits.map((item, position) => position === index ? { ...item, workOrderId: event.target.value } : item) })}><option value="">Choose work</option>{draft.choices.map((item) => <option key={item.id} value={item.id}>{item.number} · {item.storeLabel} — {item.problem}</option>)}</select></label>
        {split.workOrderId ? <a href={`/app/work-orders/${encodeURIComponent(split.workOrderId)}`} target="_blank" rel="noreferrer">Review selected work in a new tab</a> : null}
        <label className={styles.field}>Split amount<input type="number" min="0" step="0.01" required value={split.amount} onChange={(event) => setDraft({ ...draft, splits: draft.splits.map((item, position) => position === index ? { ...item, amount: event.target.value } : item) })} /></label>
        <button type="button" className={styles.secondaryButton} onClick={() => setDraft({ ...draft, splits: draft.splits.filter((_, position) => position !== index) })}>Remove split</button>
      </div> : null)}
      <button type="button" className={styles.secondaryButton} onClick={() => setDraft({ ...draft, splits: [...draft.splits, { lineId: line.id, workOrderId: "", amount: (Math.max(0, amount.remaining) / 100).toFixed(2) }] })}>Split between more work orders</button>
    </fieldset>; }) : <p>This links the accounting credit to its original invoice. It does not record savings or change the repair status.</p>}
    <label className={styles.field}>Review note<textarea required rows={2} maxLength={2000} value={draft.reason} onChange={(event) => setDraft({ ...draft, reason: event.target.value })} /></label>
    {!model.linkedInvoiceId && model.invoices.length > 0 && model.delivery.kind === "bill" ? <label><input type="checkbox" checked={draft.distinct} onChange={(event) => setDraft({ ...draft, distinct: event.target.checked })} /> I checked the existing invoices. This is a different bill from another accounting company.</label> : null}
    {error ? <p role="alert" className={styles.controlError}>{error}</p> : null}
    <p>Saving confirms the linked work. It does not approve payment.</p>
    <button className={styles.primaryButton} disabled={pending || searching || Boolean(latest) || model.delivery.voided || !model.delivery.maintenance} type="submit">{pending ? "Saving…" : "Save invoice match"}</button>
  </form>;
}
