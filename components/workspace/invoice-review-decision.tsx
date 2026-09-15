"use client";
import { useState } from "react";
import styles from "./invoice-record-workspace.module.css";

export function InvoiceReviewDecision({ invoiceId, flagId, version, currency }: { invoiceId: string; flagId: string; version: number; currency: string }) {
  const [decision, setDecision] = useState("accept_as_billed");
  return <form className={styles.form} action={`/api/ops/invoices/${encodeURIComponent(invoiceId)}/exceptions/${encodeURIComponent(flagId)}`} method="post">
    <input type="hidden" name="expectedInvoiceVersion" value={version} />
    <label>Decision<select name="decision" value={decision} onChange={event => setDecision(event.target.value)}><option value="accept_as_billed">Accept as billed</option><option value="waive_flag">Waive flag</option><option value="deduct">Record a deduction</option></select></label>
    {decision === "deduct" ? <label>Deduction amount ({currency})<input name="deductionAmount" inputMode="decimal" required placeholder="125.00" /></label> : null}
    <label>Reason<input name="reason" required maxLength={2000} /></label>
    <p>{decision === "deduct" ? "A deduction lowers the approved amount once all flags are resolved." : "Resolving the last flag approves the billed amount, less recorded deductions."} No payment is sent.</p>
    <button type="submit">Save review decision</button>
  </form>;
}
