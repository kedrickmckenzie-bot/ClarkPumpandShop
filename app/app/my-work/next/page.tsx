import Link from "next/link";
import { getOpsRequestContext } from "@/lib/server/ops-request-context";
import { internalDispatchScope } from "@/lib/server/internal-dispatch-context";
import { RecordForm } from "@/components/ops/record-form";
import { orderedStops, dispatchJob } from "@/lib/ops/dispatch-board";
import { civilDate } from "@/lib/ops/dispatch-calendar";
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
    storeId = next?.storeId ?? scope.storeIds?.[0];
  return (
    <section className={styles.workspace}>
      <h1>What&apos;s next?</h1>
      <p>Share an optional update with your team.</p>
      {storeId ? (
        <RecordForm action="/api/ops/technician-status" className={styles.form}>
          <input
            name="expectedRevision"
            type="hidden"
            value={current?.revision ?? 0}
          />
          <input name="storeId" type="hidden" value={storeId} />
          {next ? (
            <>
              <input type="hidden" name="workOrderId" value={next.id} />
              <button name="status" value="heading" type="submit">
                Heading to next job · {next.storeNumber} · {next.problem}
              </button>
            </>
          ) : null}
          <button name="status" value="parts" type="submit">
            Getting parts first
          </button>
          <button name="status" value="break" type="submit">
            Taking a break
          </button>
          <a className={styles.btn} href="#different-job">
            Different job
          </a>
          <button name="status" value="done" type="submit">
            Done for the day
          </button>
        </RecordForm>
      ) : (
        <p>No stores are currently available in your scope.</p>
      )}
      <details id="different-job">
        <summary className={styles.btn}>Choose a different job</summary>
        {jobs
          .filter((j) => j.id !== next?.id)
          .map((job) => (
            <RecordForm
              key={job.id}
              action="/api/ops/technician-status"
              className={styles.form}
            >
              <input
                name="expectedRevision"
                type="hidden"
                value={current?.revision ?? 0}
              />
              <input name="storeId" type="hidden" value={job.storeId} />
              <input name="workOrderId" type="hidden" value={job.id} />
              <button name="status" value="heading" type="submit">
                Heading to {job.storeNumber} · {job.problem}
              </button>
            </RecordForm>
          ))}
        {jobs.length < 2 ? (
          <p>
            No other ready stops today.{" "}
            <Link href="/app/my-work?view=upcoming">View upcoming work</Link>
          </p>
        ) : null}
      </details>
      <Link className={styles.btn} href="/app/my-work">
        Skip for now
      </Link>
    </section>
  );
}
