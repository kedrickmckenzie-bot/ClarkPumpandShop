import Link from "next/link";
import type { OwnerBrief } from "@/lib/ops/owner-brief";
import styles from "./owner-brief.module.css";

const usd = (minor: number) => `$${Math.round(minor / 100).toLocaleString("en-US")}`;

function hrefFor(drill: OwnerBrief["decisionsNeeded"][number]["drillThrough"]) {
  if (drill.type === "asset") return `/app/equipment/${drill.id}`;
  if (drill.type === "workflow_task") return `/app/action-center/${drill.id}`;
  return `/app/work-orders/${drill.id}`;
}

const decisionBadge: Record<OwnerBrief["decisionsNeeded"][number]["kind"], string> = {
  capital_review: "Capital decision",
  approval: "Approval waiting",
  escalated_task: "Escalated",
};

export function OwnerBriefSection({ model }: { model: OwnerBrief }) {
  return (
    <section className={styles.brief} aria-labelledby="owner-brief-heading">
      <header className={styles.header}>
        <p className={styles.eyebrow}>Owner brief</p>
        <h2 id="owner-brief-heading">The last 30 days, in plain language</h2>
      </header>

      <div className={styles.moneyRow}>
        <div className={styles.moneyCell}>
          <span className={styles.moneyLabel}>Recorded work spend</span>
          <strong>{usd(model.money.recordedSpendMinor)}</strong>
          <span className={styles.moneyNote}>{model.money.currency} · cost lines with service dates in the period</span>
        </div>
        <div className={styles.moneyCell}>
          <span className={styles.moneyLabel}>Identified exposure</span>
          <strong className={styles.warningText}>{usd(model.money.identifiedExposureMinor)}</strong>
          <span className={styles.moneyNote}>Invoice and warranty flags awaiting a human decision</span>
        </div>
        <div className={styles.moneyCell}>
          <span className={styles.moneyLabel}>Verified savings recovered</span>
          <strong className={styles.positiveText}>{usd(model.money.realizedVerifiedMinor)}</strong>
          <span className={styles.moneyNote}>Deductions, credits, and warranty recoveries backed by source records</span>
        </div>
        <div className={styles.moneyCell}>
          <span className={styles.moneyLabel}>Estimated opportunity</span>
          <strong>{usd(model.money.estimatedOpportunityMinor)}</strong>
          <span className={styles.moneyNote}>Not yet verified — never counted as realized</span>
        </div>
      </div>

      <dl className={styles.factsRow}>
        <div>
          <dt>PM compliance</dt>
          <dd>
            {model.pmCompliance.denominator > 0
              ? `${Math.round((model.pmCompliance.numerator / model.pmCompliance.denominator) * 100)}% (${model.pmCompliance.numerator} of ${model.pmCompliance.denominator})`
              : "No PM obligations were due in this period"}
            <small>{model.pmCompliance.method}</small>
          </dd>
        </div>
        <div>
          <dt>Work orders</dt>
          <dd>
            {model.headline.openedWorkOrders} opened · {model.headline.activeWorkOrders} active
            <small>Active means not yet resolved or closed.</small>
          </dd>
        </div>
        <div>
          <dt>Escalations active</dt>
          <dd>
            {model.headline.escalationsActive}
            <small>Each one has an accountable owner, a due time, and a destination.</small>
          </dd>
        </div>
      </dl>

      {model.decisionsNeeded.length > 0 ? (
        <div className={styles.decisionsBlock}>
          <h3>What needs you</h3>
          <ol className={styles.decisionList}>
            {model.decisionsNeeded.slice(0, 6).map((decision) => (
              <li key={`${decision.kind}-${decision.id}`}>
                <span className={`${styles.badge} ${decision.kind === "escalated_task" ? styles.badgeCritical : styles.badgeNeutral}`}>
                  {decisionBadge[decision.kind]}
                </span>
                <div>
                  <p className={styles.decisionLabel}>{decision.label}</p>
                  <p className={styles.decisionDetail}>{decision.detail}</p>
                  <Link className={styles.drillLink} href={hrefFor(decision.drillThrough)}>
                    Open the record
                  </Link>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <p className={styles.allClear}>Nothing is waiting on a decision from you.</p>
      )}

      {model.storeLines.length > 0 ? (
        <details className={styles.storeDetails}>
          <summary>Spend by store this period</summary>
          <table className={styles.storeTable}>
            <thead>
              <tr>
                <th scope="col">Store</th>
                <th scope="col">Work orders touched</th>
                <th scope="col">Recorded spend</th>
              </tr>
            </thead>
            <tbody>
              {model.storeLines.map((line) => (
                <tr key={line.storeId}>
                  <td>
                    <Link href={`/app/stores/${line.storeId}`}>{line.storeNumber} · {line.storeName}</Link>
                  </td>
                  <td>{line.workOrdersTouched}</td>
                  <td>{usd(line.recordedSpendMinor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ) : null}
    </section>
  );
}
