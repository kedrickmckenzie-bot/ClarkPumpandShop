import styles from "./owner-brief.module.css";

export interface HeldWorkActionsModel {
  workOrderId: string;
  permitted: boolean;
  eligible: boolean;
  categoryLabel?: string;
  storeTimeZone: string;
  deadlineInputValue: string;
  hold?: {
    status: "active" | "claimed" | "review_required" | "completed" | "cancelled";
    posture: "complete_using_professional_judgment" | "look_and_report";
    deadlineLabel: string;
    deadlineInputValue: string;
    internalReviewThreshold?: string;
    claimedVendorName?: string;
  };
}

function postureLabel(posture: HeldWorkActionsModel["hold"] extends infer T
  ? T extends { posture: infer P } ? P : never
  : never) {
  return posture === "look_and_report" ? "Look and report back" : "Complete using professional judgment";
}

export function HeldWorkActions({ model }: { model: HeldWorkActionsModel }) {
  if (!model.permitted && !model.hold) return null;
  const hold = model.hold;
  const openHold = hold && ["active", "review_required"].includes(hold.status);
  const stateTitle = hold?.status === "claimed"
    ? "A vendor is reviewing this work onsite"
    : hold?.status === "review_required"
      ? "Vendor findings need manager review"
      : hold?.status === "completed"
        ? "Completed during another visit"
        : openHold
          ? "Approved for a future visit"
          : "Handle this on a future visit";

  return (
    <section id="future-visit-hold" className={styles.brief} aria-labelledby="future-visit-hold-heading">
      <header className={styles.header}>
        <p className={styles.eyebrow}>Avoid a separate service trip</p>
        <h2 id="future-visit-hold-heading">{stateTitle}</h2>
      </header>
      {hold ? (
        <dl className={styles.factsRow}>
          <div><dt>Vendor instruction</dt><dd>{postureLabel(hold.posture)}</dd></div>
          <div><dt>Review deadline</dt><dd>{hold.deadlineLabel}</dd></div>
          <div><dt>Service category</dt><dd>{model.categoryLabel ?? "Choose a category first"}</dd></div>
          {hold.internalReviewThreshold ? <div><dt>Internal invoice-review signal</dt><dd>{hold.internalReviewThreshold}</dd><small>Never shown to the technician; not a price or authorization.</small></div> : null}
        </dl>
      ) : (
        <p className={styles.decisionDetail}>Approve this low-priority work now. When a vendor in a matching service category is already onsite, they may choose whether they can address it. No estimate or manager reply is required during the visit.</p>
      )}
      {hold?.status === "claimed" ? (
        <p className={styles.allClear}>{hold.claimedVendorName ?? "The selected vendor"} claimed this item during an active visit. Its outcome will be recorded at checkout.</p>
      ) : null}
      {hold?.status === "completed" ? (
        <p className={styles.allClear}>The visit outcome is preserved on this work order. No further held-work action is needed.</p>
      ) : null}
      {model.permitted && model.eligible && hold?.status !== "claimed" && hold?.status !== "completed" ? (
        <div className={styles.moneyRow}>
          <form action={`/api/ops/work-orders/${encodeURIComponent(model.workOrderId)}/visit-hold`} method="post" className={styles.moneyCell}>
            <input type="hidden" name="operation" value="place" />
            <span className={styles.moneyLabel}>{openHold ? "Update the held-work instructions" : "Approve for a matching visit"}</span>
            <label>
              <span>What may the vendor do?</span>
              <select name="posture" defaultValue={hold?.posture ?? "complete_using_professional_judgment"}>
                <option value="complete_using_professional_judgment">Complete using professional judgment</option>
                <option value="look_and_report">Look and report back</option>
              </select>
            </label>
            <label>
              <span>Review by</span>
              <input type="datetime-local" name="deadlineAt" required defaultValue={hold?.deadlineInputValue ?? model.deadlineInputValue} />
              <small>Store-local time ({model.storeTimeZone}). The work returns to manager review if it is not handled by this date.</small>
            </label>
            <label>
              <span>Internal invoice-review threshold <small>Optional</small></span>
              <input type="number" name="internalReviewThreshold" min="0" step="0.01" inputMode="decimal" placeholder="Not shown to the vendor" defaultValue={hold?.internalReviewThreshold?.replace(/[^0-9.]/g, "")} />
              <small>A later review signal only—not a vendor-visible NTE or an approved price.</small>
            </label>
            <button type="submit">{openHold ? "Save held-work changes" : "Approve for a future visit"}</button>
          </form>
          {openHold ? (
            <form action={`/api/ops/work-orders/${encodeURIComponent(model.workOrderId)}/visit-hold`} method="post" className={styles.moneyCell}>
              <input type="hidden" name="operation" value="release" />
              <span className={styles.moneyLabel}>Send it through the normal service path</span>
              <strong>Release the hold</strong>
              <span className={styles.moneyNote}>The work stays open and returns to facilities for vendor selection. Nothing is deleted.</span>
              <button type="submit" className={styles.secondaryAction}>Release hold</button>
            </form>
          ) : null}
        </div>
      ) : !model.eligible && !hold ? (
        <p className={styles.errorNotice}>This option becomes available after the work has a service category and manager-approved status.</p>
      ) : null}
    </section>
  );
}
