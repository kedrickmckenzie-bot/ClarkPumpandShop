import { loadOperatorSession } from "@/app/app/_data/operator-loader";
import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import styles from "./communications.module.css";
export async function WorkFiles({ workOrderId }: { workOrderId: string }) {
  const session = await loadOperatorSession(), repository = await getServerOpsRepository();
  if (!await repository.getWorkOrderDetail(session, workOrderId)) return null;
  const files = await repository.listFilesForEntity(session.organizationId, "work_order", workOrderId);
  if (!files.length) return null;
  return <details className={`${styles.workspace} ${styles.panel}`}><summary>Files & photos · {files.length}</summary><ul>{files.map(file => <li key={file.id}><a href={`/api/ops/work-orders/${encodeURIComponent(workOrderId)}/files/${encodeURIComponent(file.id)}`}>{file.originalName}</a></li>)}</ul></details>;
}
