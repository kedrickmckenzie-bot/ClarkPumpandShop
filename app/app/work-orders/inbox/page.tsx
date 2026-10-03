import { sessionHasNoStores } from "@/components/ops/role-policy";
import { FileLinks } from "@/components/workspace/file-links";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadOperatorSession } from "../../_data/operator-loader";
import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import styles from "@/components/workspace/communications.module.css";

export default async function EmailInbox({searchParams}:{searchParams:Promise<{offset?:string;view?:string;notice?:string;error?:string}>}) {
  const session = await loadOperatorSession();
  if (session.role !== "facilities" || session.storeIds !== undefined || session.regionIds !== undefined || sessionHasNoStores(session)) notFound();
  const query = await searchParams;
  const offset = Math.floor(Math.max(0,Math.min(100000,Number(query.offset) || 0)));
  const repository = await getServerOpsRepository();
  const timeZone = (await repository.getOrganization(session.organizationId))?.timeZone ?? "UTC";
  const rows = await repository.listInboundEmails(session.organizationId,{offset,status:query.view === "all" ? undefined : "needs_review"});
  const emails = await Promise.all(rows.slice(0,25).map(async email => ({email,files:await repository.listFilesForEntity(session.organizationId,"inbound_email",email.id)})));
  const configured = Boolean(process.env.OPS_EMAIL_INGRESS_ORGANIZATION_ID === session.organizationId && ((process.env.OPS_EMAIL_INGRESS_SECRET?.length ?? 0) >= 32 || Boolean(process.env.OPS_RESEND_RECEIVING_SECRET && process.env.OPS_EMAIL_INBOX_ADDRESS && process.env.EMAIL_API_KEY)));
  return <div className={styles.workspace}>
    <header><Link href="/app/work-orders?status=open">← Work</Link><h1>Email inbox</h1><p>Review incoming messages and add them to the right work.</p></header>
    {query.error ? <p role="alert">{query.error}</p> : null}
    {query.notice ? <p role="status">{query.notice}</p> : null}
    <div className={styles.bar}><nav aria-label="Inbox views"><Link href="/app/work-orders/inbox">Needs review</Link><Link href="/app/work-orders/inbox?view=all">All email</Link></nav><span>{configured ? "Mailbox adapter configured" : "Mailbox not connected · Add email below"}</span></div>
    <details className={styles.panel}><summary>Add an email</summary><form action="/api/ops/email-intake" method="post" encType="multipart/form-data" className={styles.form}>
      <input type="hidden" name="messageKey" value={`manual-${crypto.randomUUID()}`}/>
      <label>From<input type="email" name="sender" required maxLength={254}/></label>
      <label>Subject<input name="subject" required maxLength={300}/></label>
      <label>Email text<textarea name="body" rows={5} required maxLength={30000}/></label>
      <label>Reported visit date <small>Optional; confirm it on the work record.</small><input name="reportedDate" maxLength={300} placeholder="e.g. Tuesday morning"/></label>
      <label>Attachments<input type="file" name="attachments" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.txt"/><small>Up to 5 files · 8 MB total</small></label><button type="submit">Save for review</button>
    </form></details>
    {!emails.length ? <section className={styles.panel}><h2>{query.view === "all" ? "No email yet" : "Inbox clear"}</h2><p>{query.view === "all" ? "Forwarded messages will appear here when your mailbox is connected." : "There are no messages waiting for review."}</p></section> : null}
    {emails.map(({email,files}) => <section key={email.id} className={styles.panel}>
      <header><h2>{email.subject || "No subject"}</h2><p>{email.sender} · {new Date(email.receivedAt).toLocaleString("en-US",{timeZone})}</p></header>
      <details><summary>Read email{files.length ? ` · ${files.length} attachments` : ""}</summary><p className={styles.body}>{email.body}</p>{email.reportedDate ? <p>Reported date: {email.reportedDate} · Unconfirmed</p> : null}<ul>{files.map(file => <li key={file.id}><FileLinks file={file} href={`/api/ops/email-intake/${email.id}/files/${file.id}`} /></li>)}</ul></details>
      {email.status === "needs_review" ? <form action="/api/ops/email-intake" method="post" className={styles.routing}>
        <input type="hidden" name="emailId" value={email.id}/>
        <label>Existing work order<input name="workNumber" placeholder="Work order number" maxLength={100}/></label><span>or</span>
        <label>New request at store<input name="storeNumber" placeholder="Store number" maxLength={50}/></label><button type="submit" name="action" value="link">Add to work</button><button type="submit" name="action" value="dismiss" formNoValidate>Dismiss</button>
      </form> : <p>{email.workOrderId ? <Link href={`/app/work-orders/${email.workOrderId}`}>Open work order →</Link> : email.requestId ? <Link href={`/app/requests/${email.requestId}`}>Open request →</Link> : "Dismissed"}</p>}
    </section>)}
    <nav className={styles.bar} aria-label="Email pages">{offset > 0 ? <Link href={`?view=${query.view === "all" ? "all" : "review"}&offset=${Math.max(0,offset-25)}`}>Previous</Link> : <span/>}{rows.length > 25 ? <Link href={`?view=${query.view === "all" ? "all" : "review"}&offset=${offset+25}`}>Next</Link> : null}</nav>
  </div>;
}
