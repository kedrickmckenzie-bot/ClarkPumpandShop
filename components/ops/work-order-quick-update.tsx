"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import type { WorkOrderControlViewModel } from "./data-contract";
import styles from "./ops.module.css";

/** Uses the same audited command as the full work controls. A reported update is not visit evidence. */
/** `vendorReply`, when present, is offered as "From the vendor" so updates have one entry point. */
export function WorkOrderQuickUpdate({ model, canComplete = false, canAddNote = false, vendorReply }: { model: WorkOrderControlViewModel; canComplete?: boolean; canAddNote?: boolean; vendorReply?: ReactNode }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [kind, setKind] = useState("note");
  const [source, setSource] = useState("Phone");
  const [from, setFrom] = useState<"team" | "vendor">("team");
  if (!model.available || (!model.permitted && !canAddNote) || model.isTerminal) return null;
  const presets = [
    { value: "note", label: "Note / message received", status: model.status, next: model.nextAction },
    ...(model.permitted ? [{ value: "contacted", label: "Provider contacted", status: model.status, next: "Check for a provider response" }, { value: "callback", label: "Follow up later", status: model.status, next: "Follow up on the latest update" }] : []),
    ...(model.permitted && !["awaiting_approval", "resolved"].includes(model.status) ? [{ value: "parts", label: "Waiting on parts", status: "waiting_on_parts", next: "Confirm parts arrival and return visit" }] : []),
    ...(model.permitted && model.assignment && model.assignment.kind !== "choose_later" && ["approved", "issued", "accepted", "scheduled", "waiting_on_vendor", "waiting_on_parts", "in_progress"].includes(model.status) ? [{ value: "appointment", label: "Appointment confirmed", status: "scheduled", next: "Attend the confirmed service appointment" }] : []),
    ...(model.permitted && !["awaiting_approval", "resolved"].includes(model.status) ? [{ value: "unresolved", label: "Still broken / return work needed", status: model.status, next: "Arrange return work for the unresolved problem" }] : []),
    ...(canComplete && model.permitted ? [{ value: "done", label: "Problem fixed — close work", status: "closed", next: "No further action" }] : []),
  ];
  const selected = presets.find(preset => preset.value === kind) ?? presets[0];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    data.set("note", `${selected.label} · ${source} update (entered manually): ${data.get("note")}`);
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
      <summary className={styles.controlDisclosureSummary}><strong id="quick-update-title">Record update</strong><span>{vendorReply ? "Phone call, email, follow-up or vendor reply" : "Phone call, email or follow-up"}</span></summary>
      {vendorReply ? <fieldset className={styles.fieldGrid}><legend className={styles.formMeta}>Who is this update from?</legend>
        <label><input type="radio" name="update-from" checked={from === "team"} onChange={() => setFrom("team")} /> Our team or the store</label>
        <label><input type="radio" name="update-from" checked={from === "vendor"} onChange={() => setFrom("vendor")} /> The vendor (accepted, declined, new date or question)</label>
      </fieldset> : null}
      {vendorReply && from === "vendor" ? vendorReply : <form action={model.submitAction} method="post" onSubmit={submit} className={styles.controlForm}>
        <input type="hidden" name="operation" value={kind === "done" ? "manual_close" : ["appointment", "parts", "unresolved"].includes(kind) ? kind : "update"} />
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
        {kind === "appointment" ? <><input type="hidden" name="completionSource" value={source === "Phone" ? "phone" : source === "Email" ? "email" : "in_person"} /><label className={styles.field}><span>Confirmed by</span><input name="confirmedBy" required maxLength={200} placeholder="Provider contact" /></label></> : null}
        {kind === "done" ? <>
          <input type="hidden" name="completionSource" value={source === "Phone" ? "phone" : source === "Email" ? "email" : "in_person"} />
          <label className={styles.field}><span>Completed on</span><input type="date" name="performedDate" required max={new Date().toISOString().slice(0, 10)} defaultValue={new Date().toISOString().slice(0, 10)} /></label>
          <label className={styles.field}><span>Who confirmed it is fixed?</span><input name="confirmedBy" required maxLength={200} placeholder="Name and role" /></label>
          <label className={styles.field}><span>Files or photos (optional)</span><input type="file" name="attachments" multiple accept="application/pdf,image/jpeg,image/png,image/webp,text/plain" /><small>Up to 5 files, 8 MB total.</small></label>
          <label><input type="checkbox" name="resultConfirmed" required /> The problem is resolved and no further work is needed.</label>
          <small>Closes the work with a manual confirmation. Existing visit evidence stays on record.</small>
        </> : kind !== "note" ? <details className={styles.controlDisclosure} open key={kind}>
          <summary className={styles.controlDisclosureSummary}>Next action and follow-up date</summary>
          <div className={styles.fieldGrid}>
            <label className={styles.field}><span>Who follows up?</span><input name="accountableParty" readOnly required defaultValue={["parts", "unresolved"].includes(kind) && !model.followUps.some(item => item.status === "open" && item.nextAction === model.nextAction) ? model.internalAccountability.ownerName : model.accountableParty} /></label>
            <label className={styles.field}><span>{kind === "appointment" ? `Appointment · ${model.timeZone}` : "Follow up by"}</span><input name="dueAt" type="datetime-local" required defaultValue={model.dueInputValue} /></label>
          </div>
          <label className={styles.field}><span>Next action</span><input name="nextAction" readOnly={["appointment", "parts", "unresolved"].includes(kind)} required maxLength={500} defaultValue={selected.next} /></label>
          <input type="hidden" name="escalationTo" value={model.escalationTo ?? "Facilities director"} />
        </details> : null}
        {error ? <p role="alert" className={styles.controlError}>{error}</p> : null}
        <div className={styles.formFooter}><small>Saved with your name and the time.</small><button type="submit" disabled={pending} className={styles.primaryButton}>{pending ? "Saving…" : "Save update"}</button></div>
      </form>}
    </details>
  </section>;
}
