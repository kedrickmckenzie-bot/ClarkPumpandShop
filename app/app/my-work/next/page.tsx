import Link from "next/link";
import { getOpsRequestContext } from "@/lib/server/ops-request-context";
import { internalDispatchScope } from "@/lib/server/internal-dispatch-context";
import { RecordForm } from "@/components/ops/record-form";
import { orderedStops, dispatchJob, dueLabel, type DispatchJob } from "@/lib/ops/dispatch-board";
import { civilDate } from "@/lib/ops/dispatch-calendar";
import { jobShortName } from "@/lib/ops/short-name";
import styles from "@/components/workspace/internal-dispatch.module.css";

export default async function NextStatus({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const saved = (await searchParams).saved === "1";
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
  const minutes = (m?: number) => !m ? undefined : m < 60 ? `about ${m} min` : `about ${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}`;
  // What a technician weighs before going: when it's due, how long it takes, which unit, and the full job one tap away.
  const facts = (job: DispatchJob) => [dueLabel(job, today, org!.timeZone), minutes(job.schedule?.durationMinutes ?? job.estimatedMinutes),
    job.assetName && !jobShortName(job).includes(job.assetName) ? job.assetName : undefined].filter(Boolean).join(" · ");
  const openJob = (job: DispatchJob) => <Link href={`/app/my-work/${encodeURIComponent(job.id)}`}>Open job</Link>;
  const revision = (
    <input name="expectedRevision" type="hidden" value={current?.revision ?? 0} />
  );
  return (
    <section className={styles.workspace}>
      {saved ? <p role="status" className={styles.savedNote}>✓ Result saved.</p> : null}
      <h1>What&apos;s next?</h1>
      <p>Let your team know. This is optional.</p>
      {storeId ? (
        <RecordForm action="/api/ops/technician-status" className={styles.nextForm}>
          {revision}
          <input name="storeId" type="hidden" value={storeId} />
          {next ? (
            <>
              <input type="hidden" name="workOrderId" value={next.id} />
              <div className={styles.nextUp}>
                <strong>Next up: Store {next.storeNumber} · {jobShortName(next)}</strong>
                <span>{facts(next)}{facts(next) ? " · " : ""}{openJob(next)}</span>
              </div>
              <button className={`${styles.btn} ${styles.btnPrimary} ${styles.nextMain}`} name="status" value="heading" type="submit">
                Heading there now
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
          <RecordForm key={job.id} action="/api/ops/technician-status" className={styles.nextOther}>
            {revision}
            <input name="storeId" type="hidden" value={job.storeId} />
            <input name="workOrderId" type="hidden" value={job.id} />
            <div className={styles.nextInfo}>
              <strong>Store {job.storeNumber} · {jobShortName(job)}</strong>
              <span>{facts(job)}{facts(job) ? " · " : ""}{openJob(job)}</span>
            </div>
            <button className={`${styles.btn} ${styles.btnSecondary}`} name="status" value="heading" type="submit">
              Heading here
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
