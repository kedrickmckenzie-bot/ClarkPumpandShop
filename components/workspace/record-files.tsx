import { FileLinks } from "./file-links";
import { loadOperatorSession } from "@/app/app/_data/operator-loader";
import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import { recordFiles, type FileRecordKind } from "@/lib/server/record-files";
import styles from "./communications.module.css";
export async function RecordFiles({ kind, id }: { kind: FileRecordKind; id: string }) {
  const session = await loadOperatorSession(), repository = await getServerOpsRepository();
  const files = await recordFiles(repository, session, kind, id);
  return <section className={`${styles.workspace} ${styles.panel}`} id="attached-documents"><h2>{kind === "invoice" ? "Invoice document" : "Documents & photos"}</h2>{files.length ? <ul>{files.map(file => {
    const href = `/api/ops/records/${kind}/${encodeURIComponent(id)}/files/${encodeURIComponent(file.id)}`;
    return <li key={file.id}><FileLinks file={file} href={href} /></li>;
  })}</ul> : <p>No {kind === "invoice" ? "invoice document" : "files"} attached.</p>}</section>;
}
