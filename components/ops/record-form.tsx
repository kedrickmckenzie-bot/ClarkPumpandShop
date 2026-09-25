"use client";

import { useOptionalWorkConfirmation } from "./optional-work-confirmation";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import styles from "./ops.module.css";

/** Preserve entered fields on a rejected save and prevent duplicate clicks. */
export function RecordForm({ action, children, className, offerSavedWork = true }: { action: string; children: ReactNode; className?: string; offerSavedWork?: boolean }) {
  const optionalWork = useOptionalWorkConfirmation();
  const [error, setError] = useState("");
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
      const extras = offerSavedWork ? await optionalWork.confirm(action, data) : [];
      if (extras === null) { submitting.current = false; setPending(false); return; }
      extras.forEach(id=>data.append("offeredWorkId",id));
      const response = await fetch(action, { method: "POST", body: data });
      if (response.redirected && response.ok) {
        window.location.assign(response.url);
        return;
      }
      const result = await response.json().catch(() => null) as { error?: string | { message?: string }; message?: string } | null;
      setError(typeof result?.error === "string" ? result.error : typeof result?.message === "string" ? result.message : typeof result?.error === "object" && typeof result.error?.message === "string" ? result.error.message : "Could not save. Check the details and try again.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not confirm the save. Check the record list before trying again. Your entries are still here.");
    }
    submitting.current = false;
    setPending(false);
    requestAnimationFrame(() => message.current?.focus());
  }
  return <form className={className} action={action} method="post" onSubmit={submit} aria-busy={pending}>
    {error ? <div className={styles.formError} role="alert" tabIndex={-1} ref={message}><strong>Check before saving</strong><p>{error}</p></div> : null}
    <fieldset className={styles.formFields} disabled={pending}>{children}</fieldset>
    {optionalWork.modal}
    {pending ? <p role="status">Preparing…</p> : null}
  </form>;
}
