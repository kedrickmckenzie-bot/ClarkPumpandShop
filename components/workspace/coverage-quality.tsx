import Link from "next/link";
import type { ClosedLoopCoverageResult, DataQualityReport } from "@/lib/ops/coverage-quality";
import styles from "./coverage-quality.module.css";

export interface CoverageQualityModel {
  coverage: ClosedLoopCoverageResult;
  quality: DataQualityReport;
}

const missingLabels: Record<string, string> = {
  outcome_recorded: "No visit outcome on record",
  verification_verified: "Vendor claim not verified internally",
  cost_recorded: "No recorded cost evidence",
};

const entityHref: Record<string, (id: string) => string> = {
  work_order: (id) => `/app/work-orders/${id}`,
  invoice: (id) => `/app/invoices/${id}`,
  asset: (id) => `/app/equipment/${id}`,
};

export function CoverageQualitySection({ model }: { model: CoverageQualityModel }) {
  const { coverage, quality } = model;
  const rate = coverage.coverageRate == null ? null : Math.round(coverage.coverageRate * 100);
  return (
    <section className={styles.section} aria-labelledby="coverage-quality-heading">
      <h2 id="coverage-quality-heading">Operating record integrity</h2>
      <div className={styles.columns}>
        <div className={styles.block}>
          <h3>Jobs followed through to done</h3>
          {coverage.denominator === 0 ? (
            <p className={styles.empty}>No work orders have closed yet.</p>
          ) : (
            <>
              <p className={styles.bigNumber}>{rate}%</p>
              <p className={styles.subtext}>
                {coverage.numerator} of {coverage.denominator} closed work orders satisfy every completeness requirement of{" "}
                {coverage.policyVersion}.
              </p>
              <ul className={styles.reqList}>
                {coverage.requirements.map((requirement) => (
                  <li key={requirement.key}>
                    {requirement.label}: {requirement.satisfiedCount}
                  </li>
                ))}
              </ul>
              {coverage.incompleteWorkOrders.length > 0 ? (
                <div className={styles.gaps}>
                  <p className={styles.gapsTitle}>Closed with gaps ({coverage.incompleteWorkOrders.length})</p>
                  <ul>
                    {coverage.incompleteWorkOrders.slice(0, 5).map((row) => (
                      <li key={row.workOrderId}>
                        <Link href={`/app/work-orders/${row.workOrderId}`}>Open record</Link>
                        <span className={styles.gapList}>{row.missing.map((key) => missingLabels[key]).join(" · ")}</span>
                      </li>
                    ))}
                  </ul>
                  {coverage.incompleteWorkOrders.length > 5 ? (
                    <p className={styles.moreNote}>…and {coverage.incompleteWorkOrders.length - 5} more.</p>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className={styles.block}>
          <h3>Records that need cleanup</h3>
          <div className={styles.severityRow}>
            <span className={`${styles.pill} ${styles.pillHigh}`}>High: {quality.counts.high}</span>
            <span className={`${styles.pill} ${styles.pillMedium}`}>Medium: {quality.counts.medium}</span>
            <span className={`${styles.pill} ${styles.pillLow}`}>Low: {quality.counts.low}</span>
          </div>
          {quality.issues.length === 0 ? (
            <p className={styles.empty}>Every operational record currently passes its checks.</p>
          ) : (
            <ul className={styles.issueList}>
              {quality.issues.slice(0, 6).map((issue) => (
                <li key={`${issue.entityType}-${issue.entityId}-${issue.label}`}>
                  <Link href={entityHref[issue.entityType](issue.entityId)}>{issue.label}</Link>
                  <span className={styles.issueDetail}>{issue.detail}</span>
                </li>
              ))}
              {quality.issues.length > 6 ? <li className={styles.moreNote}>…and {quality.issues.length - 6} more.</li> : null}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
