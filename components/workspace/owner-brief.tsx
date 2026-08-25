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
  replacement_review: "Replacement review",
  approval: "Approval waiting",
  escalated_task: "Escalated",
};

export function OwnerBriefSection({ model }: { model: OwnerBrief }) {
  const obligations = model.pmCompliance.obligations;
  const obligationSummary = [
    `Completed on time or early: ${obligations.completedOnTimeOrEarly}`,
    `Completed late: ${obligations.completedLate}`,
    `Missed: ${obligations.missed}`,
    `Finished without a timing record: ${obligations.finishedWithoutTimingRecord}`,
    `Still open inside the completion window: ${obligations.openInWindow}`,
    `Waived: ${obligations.waived}`,
    `Not yet scheduled: ${obligations.notYetScheduled}`,
  ].join(" · ");
  return (
    <section className={styles.brief} aria-labelledby="owner-brief-heading">
      <header className={styles.header}>
        <p className={styles.eyebrow}>Owner brief</p>
        <h2 id="owner-brief-heading">The last 30 days, in plain language</h2>
      </header>

      <div className={styles.moneyRow}>
        <Link className={styles.moneyCell} href={model.drillThrough.recordedSpendHref}>
          <span className={styles.moneyLabel}>Recorded work spend</span>
          <strong>{usd(model.money.recordedSpendMinor)}</strong>
          <span className={styles.moneyNote}>{model.money.currency} · cost lines with service dates in the period — open every cost line</span>
        </Link>
        <Link className={styles.moneyCell} href={model.drillThrough.invoiceReviewHref}>
          <span className={styles.moneyLabel}>Invoices under review</span>
          <strong className={styles.warningText}>{usd(model.money.invoiceReviewAmountMinor)}</strong>
          <span className={styles.moneyNote}>{model.money.invoiceReviewCount} invoice{model.money.invoiceReviewCount === 1 ? "" : "s"} with open review flags, each counted once at its full total{model.money.otherIdentifiedExposureMinor > 0 ? ` · other exposure ${usd(model.money.otherIdentifiedExposureMinor)}` : ""}</span>
        </Link>
        <Link className={styles.moneyCell} href={model.drillThrough.recordedSpendHref}>
          <span className={styles.moneyLabel}>Verified savings recovered</span>
          <strong className={styles.positiveText}>{usd(model.money.realizedVerifiedMinor)}</strong>
          <span className={styles.moneyNote}>Deductions, credits, and warranty recoveries backed by source records</span>
        </Link>
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
            <Link href={model.drillThrough.pmComplianceHref}>
              {model.pmCompliance.denominator > 0
                ? `${Math.round((model.pmCompliance.numerator / model.pmCompliance.denominator) * 100)}% (${model.pmCompliance.numerator} of ${model.pmCompliance.denominator})`
                : "No PM obligations were due in this period"}
            </Link>
            <small>{model.pmCompliance.method}</small>
            <small>{obligationSummary}</small>
          </dd>
        </div>
        <div>
          <dt>Work orders</dt>
          <dd>
            <Link href={model.drillThrough.activeWorkOrdersHref}>
              {model.headline.openedWorkOrders} opened · {model.headline.activeWorkOrders} active
            </Link>
            <small>{model.workOrderDefinition}</small>
            <small>Active means not yet resolved or closed.</small>
          </dd>
        </div>
        <div>
          <dt>Escalations active</dt>
          <dd>
            <Link href={model.drillThrough.escalationsHref}>{model.headline.escalationsActive}</Link>
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
                <th scope="col">Work orders opened in period</th>
                <th scope="col">Recorded spend in period</th>
              </tr>
            </thead>
            <tbody>
              {model.storeLines.map((line) => (
                <tr key={line.storeId}>
                  <td>
                    <Link href={`/app/stores/${line.storeId}`}>{line.storeNumber} · {line.storeName}</Link>
                  </td>
                  <td>{line.workOrdersOpenedInPeriod}</td>
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
