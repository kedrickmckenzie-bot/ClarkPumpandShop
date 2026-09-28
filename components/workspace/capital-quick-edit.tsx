"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CapitalPlan } from "@/lib/ops/capital-planning";
import styles from "./compliance.module.css";

export function CapitalQuickEdit({ plan, returnTo }: { plan: CapitalPlan; returnTo: string }) {
  const router = useRouter(), [pending, setPending] = useState(false), [error, setError] = useState("");
  const initialAmount = plan.amountMinor === undefined ? "" : (plan.amountMinor / 100).toFixed(2);
  return <details><summary>Edit plan</summary><form className={styles.form} onSubmit={async event => {
    event.preventDefault(); setPending(true); setError("");
    const body = new FormData(event.currentTarget);
    if (String(body.get("amount")) === initialAmount && plan.version) body.set("sourceId", "keep-saved");
    try { const response = await fetch("/api/ops/capital-plans", { method: "POST", body }); const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error ?? "Could not save plan"); router.refresh(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Try again"); }
    finally { setPending(false); }
  }}>
    <input type="hidden" name="assetId" value={plan.assetId}/><input type="hidden" name="version" value={plan.version}/><input type="hidden" name="owner" value={plan.owner}/><input type="hidden" name="reason" value={plan.reason}/><input type="hidden" name="priority" value={plan.priority}/><input type="hidden" name="currency" value={plan.currency}/><input type="hidden" name="returnTo" value={returnTo}/>
    <label>Month or year<input placeholder="2027 or 2027-06" pattern="[0-9]{4}(-[0-9]{2})?" name="targetMonth" defaultValue={plan.targetMonth}/></label>
    <label>Estimated cost · {plan.currency}<input type="number" min="0" step="0.01" name="amount" defaultValue={initialAmount}/></label>
    <label>Planning status<select name="status" defaultValue={plan.status}><option value="considering">Considering</option><option value="planned">Planned</option><option value="approved">Budget approved</option><option value="completed">Completed</option></select></label>
    <small>Budget approval does not authorize work. Completed removes the plan from the forecast.</small>
    {error ? <p role="alert">{error}</p> : null}<button disabled={pending}>{pending ? "Saving…" : "Save plan"}</button>
  </form></details>;
}
