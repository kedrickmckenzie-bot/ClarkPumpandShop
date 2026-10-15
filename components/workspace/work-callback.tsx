import Link from "next/link";
import { RecordForm } from "@/components/ops/record-form";
import { loadOperatorSession } from "@/app/app/_data/operator-loader";
import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import { formatOperationsDate } from "@/lib/ops/local-time";
import { callbackCandidate, isLinked, repairSummary, type RepairSummary, type WorkCallback } from "@/lib/ops/work-callbacks";
import styles from "./work-callback.module.css";

const day = (iso?: string) => iso ? formatOperationsDate(iso.slice(0, 10)) : undefined;
const workHref = (id: string) => `/app/work-orders/${encodeURIComponent(id)}`;
const CHECK_LABEL = { verified: "Store confirmed the fix", rejected: "Store said it wasn't fixed", inconclusive: "Check was inconclusive" } as const;

/** One line about the earlier job: number, when, who and what they did, so the person rarely needs to open it. */
function LastTime({ summary }: { summary: RepairSummary }) {
  return (
    <dl className={styles.lastTime}>
      <div><dt>Problem then</dt><dd>{summary.problem}</dd></div>
      <div><dt>What they did</dt><dd>{summary.did ?? "No note recorded at checkout"}</dd></div>
      <div><dt>Finished</dt><dd>{[day(summary.completedAt), summary.doneBy, summary.check ? CHECK_LABEL[summary.check] : undefined].filter(Boolean).join(" · ")}</dd></div>
    </dl>
  );
}

/**
 * Callback context on a work order: the strip linking a callback to its earlier job (and back), the close-out choice
 * for managers, the "Is this a callback?" prompt on recently repaired equipment, and "Call vendor back" on a
 * finished job.
 */
export async function WorkCallbackContext({ workOrderId }: { workOrderId: string }) {
  const session = await loadOperatorSession(), repository = await getServerOpsRepository();
  const work = await repository.getWorkOrder(session.organizationId, workOrderId);
  if (!work || session.role === "technician") return null;
  const links = await repository.listWorkCallbacks(session.organizationId, [workOrderId]);
  const asCallback = links.find((row) => row.workOrderId === workOrderId && row.status !== "not_callback");
  const callbacks = links.filter((row) => row.originalWorkOrderId === workOrderId && row.status !== "not_callback");
  const manager = session.role === "facilities" || session.role === "regional";
  const canAnswer = manager || session.role === "store_manager";
  const finished = Boolean(work.resolvedAt ?? work.closedAt) && work.status !== "cancelled";
  const [original, candidate, callbackJobs] = await Promise.all([
    asCallback ? repairSummary(repository, session.organizationId, asCallback.originalWorkOrderId) : null,
    !asCallback && canAnswer && work.status !== "cancelled" ? callbackCandidate(repository, session.organizationId, work, links) : undefined,
    Promise.all(callbacks.map(async (row) => ({ row, job: await repository.getWorkOrder(session.organizationId, row.workOrderId) }))),
  ]);
  const vendorId = (await repository.getLatestServiceAssignment(session.organizationId, workOrderId))?.vendorId;
  const callBackHref = `/app/work-orders/new?${new URLSearchParams({ callbackOf: work.id, store: work.storeId, ...(work.assetId ? { asset: work.assetId } : {}), ...(work.componentId ? { component: work.componentId } : {}), ...(vendorId ? { vendor: vendorId } : {}), problem: `Callback for ${work.number}: ${work.problem}`.slice(0, 500) })}`;
  if (!asCallback && !candidate && !callbacks.length && !(manager && finished)) return null;

  return (
    <section className={styles.panel} id="callback" aria-label="Callback">
      {asCallback && original ? (
        <div className={styles.block}>
          <p className={styles.head}>
            <span className={styles.tag}>Callback</span> for <Link href={workHref(original.id)}>{original.number}</Link>
            <StatusChip row={asCallback} />
          </p>
          <LastTime summary={original} />
          {asCallback.status === "new_work" && asCallback.reason ? <p className={styles.note}>New billable work: {asCallback.reason} · {asCallback.resolvedByName}, {day(asCallback.resolvedAt)}</p> : null}
          {asCallback.status === "no_charge" ? <p className={styles.note}>Closed out as no charge · {asCallback.resolvedByName}, {day(asCallback.resolvedAt)}</p> : null}
          {manager ? <CloseOut row={asCallback} /> : null}
        </div>
      ) : null}

      {candidate ? (
        <div className={styles.block}>
          <p className={styles.head}>Same equipment was fixed {Math.max(0, Math.round((Date.parse(work.createdAt) - Date.parse(candidate.completedAt!)) / 86_400_000))} days before this job: <Link href={workHref(candidate.id)}>{candidate.number}</Link></p>
          <LastTime summary={candidate} />
          <div className={styles.actions}>
            <span>Is this a callback for that job?</span>
            <Answer workOrderId={work.id} originalId={candidate.id} action="link" label="Yes, link it" primary />
            <Answer workOrderId={work.id} originalId={candidate.id} action="not_callback" label="No, new problem" />
          </div>
        </div>
      ) : null}

      {callbacks.length ? (
        <div className={styles.block}>
          <p className={styles.head}>{callbacks.length === 1 ? "1 callback" : `${callbacks.length} callbacks`} on this job</p>
          <ul className={styles.list}>{callbackJobs.map(({ row, job }) => job ? (
            <li key={row.id}><Link href={workHref(job.id)}>{job.number}</Link> · {day(job.createdAt)} · {job.problem} <StatusChip row={row} /></li>
          ) : null)}</ul>
        </div>
      ) : null}

      {manager && finished && !asCallback ? <p className={styles.callBack}><Link className={styles.button} href={callBackHref}>Call vendor back</Link><small>Creates a linked callback job, expected no charge</small></p> : null}
    </section>
  );
}

function StatusChip({ row }: { row: WorkCallback }) {
  const label = row.status === "open" ? "Not closed out" : row.status === "no_charge" ? "No charge" : "Changed to new work";
  return <span className={`${styles.chip} ${isLinked(row) ? "" : styles.chipMuted}`}>{label}</span>;
}

function Answer({ workOrderId, originalId, action, label, primary = false }: { workOrderId: string; originalId: string; action: string; label: string; primary?: boolean }) {
  return (
    <RecordForm action={`/api/ops/work-orders/${encodeURIComponent(workOrderId)}/callback`} offerSavedWork={false} className={styles.inline}>
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="originalWorkOrderId" value={originalId} />
      <button type="submit" className={primary ? styles.button : styles.secondary}>{label}</button>
    </RecordForm>
  );
}

/** Close-out for managers: keep it a no-charge callback, or unlink it as new billable work with a reason. Can be changed later. */
function CloseOut({ row }: { row: WorkCallback }) {
  const action = `/api/ops/work-orders/${encodeURIComponent(row.workOrderId)}/callback`;
  const body = (
    <div className={styles.closeOut}>
      {row.status !== "no_charge" ? (
        <RecordForm action={action} offerSavedWork={false} className={styles.inline}>
          <input type="hidden" name="action" value="no_charge" />
          <button type="submit" className={styles.button}>Callback, no charge</button>
        </RecordForm>
      ) : null}
      {row.status !== "new_work" ? (
        <RecordForm action={action} offerSavedWork={false} className={styles.newWork}>
          <input type="hidden" name="action" value="new_work" />
          <input name="reason" required maxLength={300} placeholder="What made it new work? e.g. contactor failed, unrelated" aria-label="Why this is new billable work" />
          <button type="submit" className={styles.secondary}>New billable work</button>
        </RecordForm>
      ) : null}
    </div>
  );
  return row.status === "open"
    ? <div className={styles.actions}><span>Close out this callback:</span>{body}</div>
    : <details className={styles.change}><summary>Change</summary>{body}</details>;
}
