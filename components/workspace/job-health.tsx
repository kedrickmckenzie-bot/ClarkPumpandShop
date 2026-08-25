import type { JobRun } from "@/lib/ops/types";
import styles from "./job-health.module.css";

export interface JobHealthModel {
  generatedAt: string;
  runs: JobRun[];
  outboxCounts: Array<{ status: string; count: number }>;
}

const jobLabels: Record<string, string> = {
  sla_escalation: "SLA escalation",
  pm_recurrence: "PM recurrence",
};

export function JobHealthSection({ model }: { model: JobHealthModel }) {
  return (
    <section className={styles.health} aria-labelledby="job-health-heading">
      <h2 id="job-health-heading">Background jobs</h2>
      <p className={styles.note}>
        Every cycle is recorded per organization and slot, so a repeated schedule can never double-execute. Outbox depth shows undelivered platform events.
      </p>
      <div className={styles.outboxRow}>
        {model.outboxCounts.length === 0 ? (
          <span className={styles.pill}>Outbox empty</span>
        ) : (
          model.outboxCounts.map((entry) => (
            <span key={entry.status} className={`${styles.pill} ${entry.status === "failed" ? styles.pillCritical : entry.status === "pending" ? styles.pillInfo : styles.pillNeutral}`}>
              {entry.status}: {entry.count}
            </span>
          ))
        )}
      </div>
      {model.runs.length === 0 ? (
        <p className={styles.empty}>No background job has run yet for this organization. Cycles execute on their configured schedule.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Job</th>
              <th scope="col">Slot</th>
              <th scope="col">Status</th>
              <th scope="col">Processed</th>
              <th scope="col">Failed</th>
              <th scope="col">Started</th>
            </tr>
          </thead>
          <tbody>
            {model.runs.map((run) => (
              <tr key={run.id}>
                <td>{jobLabels[run.jobType] ?? run.jobType}</td>
                <td>{run.slotKey}</td>
                <td className={run.status === "failed" ? styles.criticalText : run.status === "succeeded" ? styles.positiveText : undefined}>{run.status}</td>
                <td>{run.processedCount}</td>
                <td>{run.failedCount}</td>
                <td>{run.startedAt.replace("T", " ").slice(0, 19)}Z</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
