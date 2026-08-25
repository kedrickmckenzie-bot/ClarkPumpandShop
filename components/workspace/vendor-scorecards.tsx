import Link from "next/link";
import type { VendorScorecard } from "@/lib/ops/vendor-scorecards";
import styles from "./vendor-scorecards.module.css";

const usd = (minor: number) => `$${Math.round(minor / 100).toLocaleString("en-US")}`;

interface VendorVerdict {
  tone: "good" | "watch" | "attention" | "new";
  headline: string;
  detail: string;
}

function verdictFor(card: VendorScorecard): VendorVerdict {
  if (card.openInvoiceExceptionCount > 0) {
    return {
      tone: "attention",
      headline: "Billing under review",
      detail: `${card.openInvoiceExceptionCount} invoice ${card.openInvoiceExceptionCount === 1 ? "flag" : "flags"} (${usd(card.openInvoiceExceptionAmountMinor)}) waiting for a decision before payment.`,
    };
  }
  if (card.responsesDeclined > 0) {
    return {
      tone: "watch",
      headline: "Declined work recently",
      detail: `Turned down ${card.responsesDeclined} of ${card.responsesTotal} job ${card.responsesTotal === 1 ? "request" : "requests"} — worth a conversation before the next big dispatch.`,
    };
  }
  if (card.openFollowUpCount > 0) {
    return {
      tone: "watch",
      headline: "Has open callbacks",
      detail: `${card.openFollowUpCount} ${card.openFollowUpCount === 1 ? "job" : "jobs"} still has a callback owed from a previous visit.`,
    };
  }
  if (card.visitsCompleted >= 10) {
    return { tone: "good", headline: "Reliable", detail: "Accepts every dispatch, finishes site visits, and billing is clean." };
  }
  return { tone: "new", headline: "Building history", detail: "Not enough completed jobs yet to judge fairly." };
}

const toneLabel: Record<VendorVerdict["tone"], string> = {
  good: "Reliable",
  watch: "Watch",
  attention: "Attention",
  new: "New",
};

export function VendorScorecardsSection({ scorecards }: { scorecards: VendorScorecard[] }) {
  if (scorecards.length === 0) return null;
  return (
    <section className={styles.section} aria-labelledby="vendor-scorecards-heading">
      <header className={styles.header}>
        <h2 id="vendor-scorecards-heading">How your vendors are doing</h2>
        <p className={styles.note}>
          Judged only by what happened on real jobs — did they show up, did the work hold up, and is their billing clean. Select a vendor to open every work order they have touched.
        </p>
      </header>
      <div className={styles.grid}>
        {scorecards.map((card) => {
          const verdict = verdictFor(card);
          return (
            <article key={card.vendorId} className={`${styles.card} ${styles[`tone_${verdict.tone}`]}`}>
              <div className={styles.cardHead}>
                <h3>{card.vendorName}</h3>
                <span className={`${styles.badge} ${styles[`badge_${verdict.tone}`]}`}>{toneLabel[verdict.tone]}</span>
              </div>
              <p className={styles.verdict}>{verdict.headline}</p>
              <p className={styles.detail}>{verdict.detail}</p>
              <dl className={styles.facts}>
                <div>
                  <dt>Jobs handled</dt>
                  <dd>{card.workOrdersAssigned}</dd>
                </div>
                <div>
                  <dt>Visits finished</dt>
                  <dd>{card.visitsCompleted}</dd>
                </div>
                <div>
                  <dt>Open callbacks</dt>
                  <dd className={card.openFollowUpCount > 0 ? styles.warnNumber : undefined}>{card.openFollowUpCount}</dd>
                </div>
              </dl>
              <div className={styles.actions}>
                <Link className={styles.drillLink} href={`/app/work-orders?vendor=${card.vendorId}`}>
                  See their work orders →
                </Link>
                {card.openInvoiceExceptionCount > 0 ? (
                  <Link className={styles.drillLink} href="/app/invoices">
                    Review invoice flags →
                  </Link>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
