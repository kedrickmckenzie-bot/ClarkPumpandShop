"use client";

import { useOptionalWorkConfirmation } from "./optional-work-confirmation";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import styles from "./ops.module.css";
import handoffStyles from "./vendor-handoff.module.css";

/** Preserve entered fields on a rejected save and prevent duplicate clicks. */
export function RecordForm({ action, children, className, offerSavedWork = true, attachmentLimit }: { action: string; children: ReactNode; className?: string; offerSavedWork?: boolean; attachmentLimit?: { files: number; bytes: number } }) {
  const optionalWork = useOptionalWorkConfirmation();
  const [handoff, setHandoff] = useState<{publicPath:string;notice:string;workOrderNumber:string;recordPath:string}|null>(null);
  const [copied,setCopied]=useState(false);
  const [error, setError] = useState("");
  const [dateWarnings, setDateWarnings] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const message = useRef<HTMLDivElement>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    const form = event.currentTarget;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const data = new FormData(form);
    if (submitter instanceof HTMLButtonElement && submitter.name) data.set(submitter.name, submitter.value);
    setPending(true);
    setError("");
    try {
      if (attachmentLimit) {
        const files = [...data.values()].filter((value): value is File => value instanceof File && value.size > 0);
        if (files.length > attachmentLimit.files || files.reduce((total, file) => total + file.size, 0) > attachmentLimit.bytes) {
          throw new Error(`Attach up to ${attachmentLimit.files} files, ${attachmentLimit.bytes / (1024 * 1024)} MB total. Your notes are still here.`);
        }
      }
      const extras = offerSavedWork ? await optionalWork.confirm(action, data) : [];
      if (extras === null) { submitting.current = false; setPending(false); return; }
      extras.forEach(id=>data.append("offeredWorkId",id));
      const response = await fetch(action, { method: "POST", body: data });
      if (response.redirected && response.ok) {
        window.location.assign(response.url);
        return;
      }
      const result = await response.json().catch(() => null) as { error?: string | { message?: string }; message?: string; details?: { kind: string; warnings: string[] }; handoff?: {publicPath:string;notice:string;workOrderNumber:string;recordPath:string} } | null;
      if(response.ok && result?.handoff){setHandoff(result.handoff);setPending(false);return;}
      if (result?.details?.kind === "schedule_warning") {
        setDateWarnings(result.details.warnings);
        submitting.current = false;
        setPending(false);
        requestAnimationFrame(() => message.current?.focus());
        return;
      }
      setError(typeof result?.error === "string" ? result.error : typeof result?.message === "string" ? result.message : typeof result?.error === "object" && typeof result.error?.message === "string" ? result.error.message : response.status === 413 ? "Files are too large for this save. Reduce the attachments and try again. Your notes are still here." : "Could not save. Check the details and try again.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not confirm the save. Check the record list before trying again. Your entries are still here.");
    }
    submitting.current = false;
    setPending(false);
    requestAnimationFrame(() => message.current?.focus());
  }
  if(handoff)return <section className={handoffStyles.panel} aria-label="Vendor handoff"><h2>{handoff.workOrderNumber} · Vendor link ready</h2><p role="status">{handoff.notice}</p><label>Vendor link<input readOnly value={new URL(handoff.publicPath,window.location.origin).toString()} onFocus={e=>e.currentTarget.select()}/></label><button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(new URL(handoff.publicPath,window.location.origin).toString());setCopied(true);}catch{setError("Select the link above and copy it.");}}}>{copied?"Copied":"Copy link"}</button>{error?<p role="alert">{error}</p>:null}<p>Share this link with the vendor’s dispatch team or technician.</p><a href={handoff.recordPath}>Return to work order →</a></section>;
  return <form className={className} action={action} method="post" onSubmit={submit} aria-busy={pending} data-has-date-warning={dateWarnings.length ? "true" : undefined}>
    {dateWarnings.length ? <div className={styles.formError} role="alert" tabIndex={-1} ref={message}><strong>Check this date</strong>{dateWarnings.map(warning => <p key={warning}>{warning}</p>)}<div className={styles.dateWarningActions}><button type="submit" name="keepConflicts" value="yes" disabled={pending}>Keep this date</button><button type="button" disabled={pending} onClick={event => { setDateWarnings([]); event.currentTarget.closest("form")?.querySelector<HTMLInputElement>('input[type="date"],input[type="datetime-local"]')?.focus(); }}>Pick another</button></div></div> : null}
    {error ? <div className={styles.formError} role="alert" tabIndex={-1} ref={message}><strong>Check before saving</strong><p>{error}</p></div> : null}
    <fieldset className={styles.formFields} disabled={pending}>{children}</fieldset>
    {optionalWork.modal}
    {pending ? <p role="status">Preparing…</p> : null}
  </form>;
}
