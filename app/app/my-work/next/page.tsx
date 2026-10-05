import Link from "next/link";
import { getOpsRequestContext } from "@/lib/server/ops-request-context";
import { internalDispatchScope } from "@/lib/server/internal-dispatch-context";
import { RecordForm } from "@/components/ops/record-form";
import { orderedStops, dispatchJob } from "@/lib/ops/dispatch-board";
import { civilDate } from "@/lib/ops/dispatch-calendar";
import { jobShortName } from "@/lib/ops/short-name";
import styles from "@/components/workspace/internal-dispatch.module.css";

export default async function NextStatus() {
  const c = await getOpsRequestContext(["technician"]),
    r = c.repository,
    scope = await internalDispatchScope(r, c.session),
    member = c.session.membershipId!;
  const org = await r.getOrganization(scope.organizationId),
    today = civilDate(new Date().toISOString(), org!.timeZone);
  const [page, current] = await Promise.all([
    r.listWorkOrders(scope, {
      internalOnly: true,
      internalMembershipId: member,
      scheduleView: "today",
      scheduleFrom: today,
      statuses: ["approved", "issued", "accepted", "scheduled"],
      dispatchReadiness: "ready",
      excludeHeld: true,
      limit: 100,
      dispatchPlanOrder: true,
    }),
    r.getTechnicianStatus(scope.organizationId, member),
  ]);
  const jobs = orderedStops(page.items.map((row) => dispatchJob(row))).filter(
      (j) => !j.hasOpenFollowUp,
    ),
    next = jobs[0],
    others = jobs.filter((j) => j.id !== next?.id),
    storeId = next?.storeId ?? scope.storeIds?.[0];
  const revision = (
    <input name="expectedRevision" type="hidden" value={current?.revision ?? 0} />
  );
  return (
    <section className={styles.workspace}>
      <h1>What&apos;s next?</h1>
      <p>Let your team know. This is optional.</p>
      {storeId ? (
        <RecordForm action="/api/ops/technician-status" className={styles.nextForm}>
          {revision}
          <input name="storeId" type="hidden" value={storeId} />
          {next ? (
            <>
              <input type="hidden" name="workOrderId" value={next.id} />
              <button className={`${styles.btn} ${styles.btnPrimary} ${styles.nextMain}`} name="status" value="heading" type="submit">
                Heading to next job
                <span>{next.storeNumber} · {jobShortName(next)}</span>
              </button>
            </>
          ) : null}
          <div className={styles.nextOthers}>
            <button className={`${styles.btn} ${styles.btnSecondary}`} name="status" value="parts" type="submit">
              Getting parts first
            </button>
            <button className={`${styles.btn} ${styles.btnSecondary}`} name="status" value="break" type="submit">
              Taking a break
            </button>
            <button className={`${styles.btn} ${styles.btnSecondary}`} name="status" value="done" type="submit">
              Done for the day
            </button>
          </div>
        </RecordForm>
      ) : (
        <p>No stores are currently available in your scope.</p>
      )}
      <details className={styles.nextDifferent}>
        <summary className={`${styles.btn} ${styles.btnSecondary}`}>Going to a different job</summary>
        {others.map((job) => (
          <RecordForm key={job.id} action="/api/ops/technician-status" className={styles.nextForm}>
            {revision}
            <input name="storeId" type="hidden" value={job.storeId} />
            <input name="workOrderId" type="hidden" value={job.id} />
            <button className={`${styles.btn} ${styles.btnSecondary} ${styles.nextJob}`} name="status" value="heading" type="submit">
              {job.storeNumber} · {jobShortName(job)}
            </button>
          </RecordForm>
        ))}
        {others.length === 0 ? (
          <p>
            No other ready jobs today.{" "}
            <Link href="/app/my-work?view=upcoming">See upcoming work</Link>
          </p>
        ) : null}
      </details>
      <p>
        <Link href="/app/my-work">Skip for now</Link>
      </p>
    </section>
  );
}
