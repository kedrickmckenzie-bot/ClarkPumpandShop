"use client";

import { useState, type FormEvent } from "react";
import type { WorkOrderControlViewModel } from "./data-contract";
import styles from "./ops.module.css";

/** Uses the same audited command as the full work controls. A reported update is not visit evidence. */
export function WorkOrderQuickUpdate({ model, canComplete = false, canAddNote = false }: { model: WorkOrderControlViewModel; canComplete?: boolean; canAddNote?: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [kind, setKind] = useState("note");
  const [source, setSource] = useState("Phone");
  if (!model.available || (!model.permitted && !canAddNote) || model.isTerminal) return null;
  const presets = [
    { value: "note", label: "Add a note", status: model.status, next: model.nextAction },
    ...(model.permitted ? [{ value: "callback", label: "Follow up later", status: model.status, next: "Follow up on the latest update" }] : []),
    ...(model.permitted && model.statusOptions.some(option => option.value === "waiting_on_parts") ? [{ value: "parts", label: "Waiting on parts", status: "waiting_on_parts", next: "Confirm parts arrival and return visit" }] : []),
    ...(canComplete && model.permitted ? [{ value: "done", label: "Problem fixed — close work", status: "closed", next: "No further action" }] : []),
  ];
  const selected = presets.find(preset => preset.value === kind) ?? presets[0];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    data.set("note", `${source} update (entered manually): ${data.get("note")}`);
    setPending(true); setError(undefined);
    try {
      const response = await fetch(kind === "note" ? `/api/ops/work-orders/${model.workOrderId}/notes` : model.submitAction, { method: "POST", body: data, credentials: "same-origin" });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? "Could not save. Try again.");
      }
      window.location.assign(response.url);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save. Try again."); setPending(false); }
  }
  return <section id="add-update" className={styles.controlPanel} aria-labelledby="quick-update-title">
    <details className={styles.controlDisclosure}>
      <summary className={styles.controlDisclosureSummary}><strong id="quick-update-title">Add update</strong><span>Phone call, email or follow-up</span></summary>
      <form action={model.submitAction} method="post" onSubmit={submit} className={styles.controlForm}>
        <input type="hidden" name="operation" value={kind === "done" ? "manual_close" : "update"} />
        <input type="hidden" name="expectedVersion" value={model.expectedVersion} />
        <input type="hidden" name="expectedStatus" value={model.expectedStatus} />
        <input type="hidden" name="status" value={selected.status} />
        <input type="hidden" name="priority" value={model.priority} />
        <input type="hidden" name="returnTo" value={`/app/work-orders/${model.workOrderId}?updated=control#recent-updates`} />
        <div className={styles.fieldGrid}>
          <label className={styles.field}><span>What changed?</span><select value={kind} onChange={event => setKind(event.target.value)}>{presets.map(preset => <option key={preset.value} value={preset.value}>{preset.label}</option>)}</select></label>
          <label className={styles.field}><span>Received by</span><select value={source} onChange={event => setSource(event.target.value)}>{["Phone", "Email", "In person"].map(value => <option key={value}>{value}</option>)}</select></label>
        </div>
        <label className={styles.field}><span>Update</span><textarea name="note" required minLength={3} maxLength={1800} rows={2} placeholder="Who did you speak with, and what did they say?" /></label>
        {kind === "done" ? <>
          <input type="hidden" name="completionSource" value={source === "Phone" ? "phone" : source === "Email" ? "email" : "in_person"} />
          <label className={styles.field}><span>Who confirmed it is fixed?</span><input name="confirmedBy" required maxLength={200} placeholder="Name and role" /></label>
          <label><input type="checkbox" name="resultConfirmed" required /> The problem is resolved and no further work is needed.</label>
          <small>Closes the work with a manual confirmation. No visit times are recorded.</small>
        </> : kind !== "note" ? <details className={styles.controlDisclosure} open key={kind}>
          <summary className={styles.controlDisclosureSummary}>Next action and follow-up date</summary>
          <div className={styles.fieldGrid}>
            <label className={styles.field}><span>Who follows up?</span><input name="accountableParty" readOnly required defaultValue={model.accountableParty} /></label>
            <label className={styles.field}><span>Follow up by</span><input name="dueAt" type="datetime-local" required defaultValue={model.dueInputValue} /></label>
          </div>
          <label className={styles.field}><span>Next action</span><input name="nextAction" required maxLength={500} defaultValue={selected.next} /></label>
          <input type="hidden" name="escalationTo" value={model.escalationTo ?? "Facilities director"} />
        </details> : null}
        {error ? <p role="alert" className={styles.controlError}>{error}</p> : null}
        <div className={styles.formFooter}><small>Saved with your name and the time.</small><button type="submit" disabled={pending} className={styles.primaryButton}>{pending ? "Saving…" : "Save update"}</button></div>
      </form>
    </details>
  </section>;
}
