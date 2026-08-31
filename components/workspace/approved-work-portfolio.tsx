import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Layers3,
  MapPin,
  Store as StoreIcon,
} from "lucide-react";
import type {
  ApprovedWorkPortfolioViewModel,
  ApprovedWorkReviewState,
} from "@/app/app/_data/approved-work-presenter";
import styles from "./approved-work-portfolio.module.css";

function reviewClass(state: ApprovedWorkReviewState) {
  if (state === "overdue") return styles.overdue;
  if (state === "due_soon") return styles.dueSoon;
  return styles.later;
}

function plural(value: number, singular: string, pluralForm = `${singular}s`) {
  return `${value} ${value === 1 ? singular : pluralForm}`;
}

export function ApprovedWorkPortfolio({ model }: { model: ApprovedWorkPortfolioViewModel }) {
  const firstSendHref = model.storeRows.find((row) => row.sendTogetherHref)?.sendTogetherHref;
  return (
    <section className={styles.portfolio} aria-labelledby="approved-work-portfolio-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Approved for next suitable visit</p>
          <h2 id="approved-work-portfolio-title">Control small approved jobs without losing them in the backlog</h2>
          <span>
            {model.canSendTogether
              ? "Work stays organized by store until a manager sends it or a vendor already onsite chooses it. Nothing is assigned automatically."
              : "Work stays organized by store so the responsible team can review it before the deadline. Nothing is assigned automatically."}
          </span>
        </div>
        {model.canSendTogether && firstSendHref ? (
          <Link className={styles.headerAction} href={firstSendHref}>
            Send approved jobs together <ArrowRight aria-hidden="true" size={16} />
          </Link>
        ) : null}
      </header>

      <div className={styles.summary} aria-label="Approved work summary">
        <div className={styles.summaryStatic}>
          <span><ClipboardList aria-hidden="true" size={17} />Approved jobs</span>
          <strong>{model.totalItems}</strong>
          <small>{plural(model.storeCount, "store")} in the current scope</small>
        </div>
        <Link href={model.summaryLinks.multipleStores}>
          <span><Layers3 aria-hidden="true" size={17} />Stores with 2+ approved jobs</span>
          <strong>{model.multiItemStoreCount}</strong>
          <small>{model.canSendTogether ? "Review by store before sending" : "Review the stores with the largest backlog"}</small>
        </Link>
        <Link className={model.reviewSoonCount ? styles.warningMetric : undefined} href={model.summaryLinks.reviewSoon}>
          <span><CalendarClock aria-hidden="true" size={17} />Review within 30 days</span>
          <strong>{model.reviewSoonCount}</strong>
          <small>{model.overdueCount ? `${plural(model.overdueCount, "job")} overdue` : "No jobs overdue"}</small>
        </Link>
        <Link className={model.confirmedOpportunityItemCount ? styles.opportunityMetric : undefined} href={model.summaryLinks.confirmedOpportunities}>
          <span><CheckCircle2 aria-hidden="true" size={17} />Jobs with confirmed visits</span>
          <strong>{model.confirmedOpportunityItemCount}</strong>
          <small>{plural(model.confirmedOpportunityMatchCount, "job-to-visit match", "job-to-visit matches")} across {plural(model.confirmedOpportunityStoreCount, "store")}</small>
        </Link>
      </div>

      {model.storeRows.length ? (
        <div className={styles.tableScroller} id="approved-work-stores">
          <table>
            <caption>
              Active approvals only. A confirmed visit match means the store and service area align; it is an opportunity to review, not an assignment.
            </caption>
            <thead>
              <tr>
                <th>Store</th>
                <th>Approved jobs</th>
                <th>Service areas</th>
                <th>Review if not handled by</th>
                <th>Next known opportunity</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {model.storeRows.map((row) => (
                <tr key={row.storeId}>
                  <td>
                    <Link className={styles.storeLink} href={row.storeHref}>
                      <span className={styles.storeIcon}><StoreIcon aria-hidden="true" size={17} /></span>
                      <span><strong>Store {row.storeNumber}</strong><small>{row.storeName} · {row.cityState}</small></span>
                    </Link>
                  </td>
                  <td>
                    <Link className={styles.countLink} href={row.reviewItemsHref}>
                      <strong>{row.itemCount}</strong>
                      <small>{row.itemCount === 1 ? "approved job" : "approved jobs"}</small>
                    </Link>
                  </td>
                  <td>
                    <div className={styles.serviceAreas}>
                      {row.serviceAreas.map((area) => (
                        <span key={area.key}>{area.label}{area.count > 1 ? ` · ${area.count}` : ""}</span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <span className={`${styles.reviewState} ${reviewClass(row.reviewState)}`}>{row.earliestReviewLabel}</span>
                  </td>
                  <td>
                    {row.nextConfirmedOpportunity ? (
                      <div className={styles.opportunity}>
                        <span><CalendarClock aria-hidden="true" size={15} />Confirmed visit to review</span>
                        <strong>{row.nextConfirmedOpportunity.startsAtLabel}</strong>
                        <small>{row.nextConfirmedOpportunity.vendorName} · {row.nextConfirmedOpportunity.relationshipLabel}</small>
                        <Link href={row.nextConfirmedOpportunity.visitHref}>Open confirmed visit</Link>
                      </div>
                    ) : (
                      <div className={styles.noOpportunity}>
                        <strong>No matching confirmed visit</strong>
                        <small>{model.canSendTogether ? "Keep available for a suitable onsite visit or send the jobs together." : "Keep available for a suitable onsite visit."}</small>
                      </div>
                    )}
                  </td>
                  <td>
                    <div className={styles.actions}>
                      {row.matchedItemCount && row.reviewMatchesHref ? (
                        <Link className={styles.primaryAction} href={row.reviewMatchesHref}>
                            Review {plural(row.confirmedMatchCount, "confirmed visit match", "confirmed visit matches")}
                            <ChevronDown aria-hidden="true" size={15} />
                        </Link>
                      ) : (
                        <Link className={styles.primaryAction} href={row.reviewItemsHref}>
                          Review jobs <ArrowRight aria-hidden="true" size={15} />
                        </Link>
                      )}
                      {row.sendTogetherHref ? <Link className={styles.secondaryAction} href={row.sendTogetherHref}>Send jobs together</Link> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.empty}>
          <span><CheckCircle2 aria-hidden="true" size={22} /></span>
          <div><h3>No work is waiting for a suitable visit</h3><p>Approved jobs will appear here when a manager decides they can wait instead of triggering a separate trip.</p></div>
        </div>
      )}

      <footer className={styles.footer}>
        <MapPin aria-hidden="true" size={16} />
        <span>
          Visit matches use recorded store and service-area facts only. The manager still reviews the work, and the vendor decides what it can complete.
        </span>
      </footer>

      {model.matchReview ? (
        <>
          <Link className={styles.dialogBackdrop} href={model.matchReview.closeHref} aria-label="Close confirmed visit review" />
          <section className={styles.matchDialog} role="dialog" aria-modal="true" aria-labelledby="confirmed-visit-review-title">
            <header className={styles.dialogHeader}>
              <div>
                <p>Confirmed visit review</p>
                <h3 id="confirmed-visit-review-title">{model.matchReview.storeLabel}</h3>
                <span>These are factual same-store, same-service-area opportunities. Review the records before adding any work.</span>
              </div>
              <Link href={model.matchReview.closeHref} aria-label="Close confirmed visit review">Close <b aria-hidden="true">×</b></Link>
            </header>
            <div className={styles.dialogBody}>
              {model.matchReview.items.flatMap((item) => item.confirmedVisits.map((visit) => (
                  <article key={`${item.workOrderId}:${visit.appointmentId}`} className={styles.matchCard}>
                    <div className={styles.matchJob}>
                      <small>Approved job</small>
                      <strong>{item.workOrderNumber} · {item.problem}</strong>
                      <span>{item.serviceAreaLabel} · {item.postureLabel}</span>
                      <span>{item.reviewByLabel}</span>
                    </div>
                    <div className={styles.matchVisit}>
                      <small>Confirmed visit</small>
                      <strong>{visit.startsAtLabel} · {visit.vendorName}</strong>
                      <span>{visit.scheduledWorkOrderNumber} · {visit.scheduledWorkProblem}</span>
                      <span>{visit.relationshipLabel}</span>
                    </div>
                    <footer>
                      <Link href={item.recordHref}>Open approved job</Link>
                      <Link href={visit.visitHref}>{visit.visitLinkLabel}</Link>
                      {visit.plannedForReview ? (
                        <span className={styles.matchPlanned}>Planned for vendor review</span>
                      ) : visit.planAction && visit.planReturnTo && visit.expectedHoldVersion !== undefined ? (
                        <form action={visit.planAction} method="post">
                          <input type="hidden" name="appointmentId" value={visit.appointmentId} />
                          <input type="hidden" name="expectedHoldVersion" value={visit.expectedHoldVersion} />
                          <input type="hidden" name="returnTo" value={visit.planReturnTo} />
                          <button className={styles.matchHandoff} type="submit">Plan for vendor review</button>
                        </form>
                      ) : null}
                    </footer>
                  </article>
                ))) }
            </div>
            <footer className={styles.dialogFooter}>
              <span>Planning marks the job for the vendor to review at this appointment. It does not assign the job or change the confirmed visit. The technician chooses onsite whether to add it.</span>
              <Link href={model.matchReview.closeHref}>Done reviewing</Link>
            </footer>
          </section>
        </>
      ) : null}
    </section>
  );
}
