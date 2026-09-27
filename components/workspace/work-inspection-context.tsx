import { masterDocuments } from "@/lib/ops/compliance-documents";
import Link from "next/link";
import { loadOperatorSession } from "@/app/app/_data/operator-loader";
import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import styles from "./communications.module.css";

export async function WorkInspectionContext({workOrderId}:{workOrderId:string}) {
  const session=await loadOperatorSession(),repository=await getServerOpsRepository();
  if(!await repository.getWorkOrderDetail(session,workOrderId))return null;
  const inspection=await repository.inspectionForWork(session.organizationId,workOrderId);
  if(!inspection)return null;
  const schedule=await repository.getComplianceSchedule(session.organizationId,inspection.scheduleId);
  const forms=masterDocuments(inspection);
  return <section className={`${styles.workspace} ${styles.panel}`}><h2>{inspection.correctiveWorkOrderId===workOrderId ? "Inspection finding" : "Compliance inspection"}</h2><p><Link href={`/app/compliance/${inspection.id}`}>{schedule?.name ?? "View inspection"} · Due {inspection.dueDate}</Link></p><h3>Instructions & blank forms</h3>{forms.length?<ul>{forms.map(f=><li key={f.id}><a href={`/api/ops/compliance/${inspection.id}/files/${f.id}`}>{f.originalName}</a></li>)}</ul>:<p>No blank forms attached.</p>}<p>Review the result and required evidence on the inspection record.</p></section>;
}
