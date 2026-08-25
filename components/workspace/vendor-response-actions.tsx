import Link from "next/link";
import styles from "./owner-brief.module.css";

export interface VendorResponseActionsModel {
  responseId: string;
  kind: "accepted" | "declined" | "proposed_date" | "question";
  responderName: string;
  proposedAt?: string;
  message?: string;
  respondedAt: string;
  workOrderId: string;
}

function ActionForms({ model }: { model: VendorResponseActionsModel }) {
  const common = (
    <>
      <input type="hidden" name="vendorResponseId" value={model.responseId} />
      <input type="hidden" name="returnTo" value={`/app/work-orders/${model.workOrderId}?view=service`} />
    </>
  );
  if (model.kind === "proposed_date") {
    return (
      <div className={styles.moneyRow}>
        <form action="/api/ops/vendor-response" method="post" className={styles.moneyCell}>
          {common}
          <input type="hidden" name="decision" value="accept_proposed_date" />
          <span className={styles.moneyLabel}>Accept the proposed date</span>
          <strong>{model.proposedAt ? new Date(model.proposedAt).toLocaleString("en-US") : "Proposed time missing"}</strong>
          <button type="submit">Accept proposed date</button>
        </form>
        <form action="/api/ops/vendor-response" method="post" className={styles.moneyCell}>
          {common}
          <input type="hidden" name="decision" value="counter_proposed_date" />
          <span className={styles.moneyLabel}>Counter with another date/time</span>
          <input type="datetime-local" name="scheduledFor" required />
          <button type="submit">Send counterproposal</button>
        </form>
      </div>
    );
  }
  if (model.kind === "question") {
    return (
      <form action="/api/ops/vendor-response" method="post" className={styles.moneyCell}>
        {common}
        <input type="hidden" name="decision" value="reply_to_question" />
        <span className={styles.moneyLabel}>Reply to the vendor question</span>
        <textarea name="message" rows={2} required placeholder="Your answer to the vendor…" />
        <button type="submit">Send reply</button>
      </form>
    );
  }
  return null;
}

export function VendorResponseActions({ model }: { model: VendorResponseActionsModel }) {
  return (
    <section className={styles.brief} aria-labelledby="vendor-response-heading">
      <header className={styles.header}>
        <p className={styles.eyebrow}>{model.responderName} responded</p>
        <h2 id="vendor-response-heading">
          {model.kind === "proposed_date" ? "Date proposed"
            : model.kind === "question" ? "Question pending"
              : model.kind === "declined" ? "Authorization declined"
                : "Vendor accepted"}
        </h2>
      </header>
      {model.message ? <p className={styles.decisionDetail}>“{model.message}”</p> : null}
      {model.kind === "declined" ? (
        <div className={styles.moneyRow}>
          <Link className={styles.moneyCell} href={`/app/work-orders/${model.workOrderId}?view=service`}>
            <span className={styles.moneyLabel}>Recover from the decline</span>
            <strong>Select another provider or invite bids</strong>
            <span className={styles.moneyNote}>Choose a different approved vendor, or open the bid request panel on this case</span>
          </Link>
        </div>
      ) : (
        <ActionForms model={model} />
      )}
    </section>
  );
}
