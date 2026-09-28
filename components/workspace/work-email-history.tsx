import { FileLinks } from "@/components/workspace/file-links";
import { loadOperatorSession } from "@/app/app/_data/operator-loader";
import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import styles from "./communications.module.css";
export async function WorkEmailHistory({workOrderId}:{workOrderId:string}) {
  const session=await loadOperatorSession();const repository=await getServerOpsRepository();
  if(!await repository.getWorkOrderDetail(session,workOrderId))return null;
  const rows=await repository.listInboundEmails(session.organizationId,{workOrderId});
  if(!rows.length)return null;
  const messages=await Promise.all(rows.slice(0,5).map(async email=>({email,files:await repository.listFilesForEntity(session.organizationId,"inbound_email",email.id)})));
  return <details className={`${styles.workspace} ${styles.panel}`}><summary>Recent email · {rows.length>5 ? "Latest 5" : rows.length}</summary>{messages.map(({email,files})=><section key={email.id}><h2>{email.subject}</h2><p>{email.sender}</p><p className={styles.body}>{email.body}</p>{email.reportedDate ? <p>Reported date: {email.reportedDate} · Unconfirmed</p> : null}<ul>{files.map(file=><li key={file.id}><FileLinks file={file} href={`/api/ops/email-intake/${email.id}/files/${file.id}`} /></li>)}</ul></section>)}</details>;
}
