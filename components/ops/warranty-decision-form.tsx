"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./warranty-finance-workspace.module.css";

export function WarrantyDecisionForm({ caseId, initialCoverage = "", diagnosis = "", hold = true, returnQueue }: { caseId: string; initialCoverage?: string; diagnosis?: string; hold?: boolean; returnQueue?: string }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  return <form className={styles.form} action={`/api/ops/warranties/${caseId}/decision`} method="post" onSubmit={async (event) => {
    event.preventDefault();
    if (saving) return;
    const form = event.currentTarget;
    setSaving(true); setError("");
    try {
      const response = await fetch(form.action, { method: "POST", body: new FormData(form) });
      if (!response.ok) {
        const result = await response.json().catch(() => ({})) as { error?: string | { message?: string }; message?: string };
        throw new Error(typeof result.error === "string" ? result.error : result.error?.message ?? result.message ?? "The decision could not be saved. Your entries are still here.");
      }
      router.push(`/app/warranties/${caseId}?${new URLSearchParams({ updated: "coverage", ...(returnQueue ? { reviewQueue: returnQueue } : {}) })}#diagnosis`);
      router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The decision could not be saved. Your entries are still here."); }
    finally { setSaving(false); }
  }}>
    {error ? <p role="alert">{error}</p> : null}
    {returnQueue ? <input type="hidden" name="reviewQueue" value={returnQueue} /> : null}
    <label>What did the technician find?<textarea name="diagnosis" required defaultValue={diagnosis} placeholder="Record the confirmed cause, who checked it, and when. A repeated complaint alone does not confirm the same failure." /></label>
    <label>What will the warranty pay for?<select name="coverageDecision" required defaultValue={initialCoverage}><option value="" disabled>Choose after reviewing the diagnosis and terms</option><option value="covered">All of this repair — covered by warranty</option><option value="split">Some of this repair — costs are shared</option><option value="not_covered">None of this repair — customer is responsible</option></select></label>
    <label>Why? Include which costs are covered and which are not.<textarea name="reason" required placeholder="For example: the replacement part is covered, but the contract excludes travel. Reference the term or vendor confirmation." /></label>
    <label>Keep the invoice on hold?<select name="invoiceHold" defaultValue={hold ? "retain" : "release"}><option value="retain">Yes — keep it on hold while this is sorted out</option><option value="release">No — release the warranty hold</option></select></label>
    <p>Saving records this warranty decision. It does not confirm that the equipment is fixed or approve payment.</p>
    <button className={styles.button} type="submit" disabled={saving}>{saving ? "Saving…" : "Save diagnosis and warranty decision"}</button>
  </form>;
}
