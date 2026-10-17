import { FileLinks } from "@/components/workspace/file-links";
import { loadOperatorSession } from "@/app/app/_data/operator-loader";
import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import styles from "./communications.module.css";

const SHARE_ROLES = new Set(["facilities", "regional", "store_manager", "executive"]);

/** The job's files and the store's report photos. Managers choose which photos the outside vendor sees on its job link. */
export async function WorkFiles({ workOrderId, notice }: { workOrderId: string; notice?: string }) {
  const session = await loadOperatorSession(), repository = await getServerOpsRepository();
  const detail = await repository.getWorkOrderDetail(session, workOrderId);
  if (!detail) return null;
  const org = session.organizationId, requestId = detail.request?.id;
  const [own, reported, ownVisibility, reportedVisibility, assignment] = await Promise.all([
    repository.listFilesForEntity(org, "work_order", workOrderId),
    requestId ? repository.listFilesForEntity(org, "request", requestId) : [],
    repository.listEntityFileVisibility(org, "work_order", workOrderId),
    requestId ? repository.listEntityFileVisibility(org, "request", requestId) : [],
    repository.getLatestServiceAssignment(org, workOrderId),
  ]);
  const files = [...reported, ...own.filter(file => !reported.some(r => r.id === file.id))];
  if (!files.length) return null;
  const visibility = new Map([...reportedVisibility, ...ownVisibility].map(row => [row.fileId, row.visibility]));
  const vendorJob = assignment?.kind === "outside_vendor", canShare = vendorJob && SHARE_ROLES.has(session.role);
  const sharedCount = files.filter(file => visibility.get(file.id) === "vendor_shared" && file.contentType.startsWith("image/")).length;
  const base = `/api/ops/work-orders/${encodeURIComponent(workOrderId)}/files`;
  return <details id="job-files" open={Boolean(notice) || undefined} className={`${styles.workspace} ${styles.panel}`}>
    <summary>Files & photos · {files.length}{vendorJob && sharedCount ? ` · ${sharedCount} shown to vendor` : ""}</summary>
    {notice ? <p role="status" className={styles.fileNotice}>{notice === "shared" ? "Photo shown to the vendor." : "Photo hidden from the vendor."}</p> : null}
    <ul className={styles.fileList}>{files.map(file => {
      const shared = visibility.get(file.id) === "vendor_shared", photo = file.contentType.startsWith("image/");
      const fromReport = reported.some(r => r.id === file.id);
      return <li key={file.id}>
        <span><FileLinks file={file} href={`${base}/${encodeURIComponent(file.id)}`} />{fromReport ? <small> · From the store&apos;s report</small> : null}</span>
        {vendorJob && photo ? canShare
          ? <form method="post" action={`${base}/${encodeURIComponent(file.id)}/sharing`} className={styles.shareForm}>
              <input type="hidden" name="shared" value={shared ? "false" : "true"} />
              <span className={shared ? styles.sharedTag : styles.privateTag}>{shared ? "Vendor can see" : "Team only"}</span>
              <button type="submit">{shared ? "Hide from vendor" : "Show to vendor"}</button>
            </form>
          : <span className={shared ? styles.sharedTag : styles.privateTag}>{shared ? "Vendor can see" : "Team only"}</span>
        : null}
      </li>;
    })}</ul>
  </details>;
}
