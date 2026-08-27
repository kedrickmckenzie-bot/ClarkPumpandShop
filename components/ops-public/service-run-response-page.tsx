import { CalendarClock, ClipboardCheck, MapPinned, Route, ShieldCheck } from "lucide-react";
import type { ServiceRunPublicView } from "@/lib/ops/service-run-presenter";
import { formatPublicDateTime, PublicFrame } from "./public-ui";
import { formatOperationsDate } from "@/lib/ops/local-time";
import { ServiceRunResponseForm } from "./service-run-response-form";
import styles from "./public-workflows.module.css";

function formatPublicDate(value: string | undefined, timeZone?: string) {
  if (!value) return "No date recorded";
  return formatOperationsDate(value, timeZone);
}

export function ServiceRunResponsePage({ token, view }: { token: string; view: ServiceRunPublicView }) {
  const isStoreSweep = view.planningKind === "store_sweep";
  const jobCount = view.stops.reduce((sum, stop) => sum + stop.workOrders.length, 0);
  return (
    <PublicFrame organizationName={view.organizationName} context={isStoreSweep ? "Approved work" : "Vendor Service Run"} mode="demo">
      <div className={styles.hero}>
        <div><span className={styles.eyebrow}>For {view.vendorName}</span><h1 className={styles.title}>{isStoreSweep ? `${jobCount} approved ${jobCount === 1 ? "job" : "jobs"} at ${view.stops[0]?.storeLabel ?? "one store"}` : "Service Run recommendation"}</h1><p className={styles.lede}>{isStoreSweep ? "Review the work and tell the customer when your company plans to visit." : `${view.stops.length} route stops · ${jobCount} Work Orders`}</p></div>
        <span className={styles.statusPill}>Awaiting your response</span>
      </div>
      <div className={styles.layout}>
        <div className={styles.stack}>
          <section className={styles.card} aria-labelledby="recommendation-title">
            <div className={styles.cardHeader}><div><span className={styles.eyebrow}>{isStoreSweep ? "Work summary" : "Explainable recommendation"}</span><h2 className={styles.cardTitle} id="recommendation-title">{isStoreSweep ? "Approved jobs sent together" : "Why these obligations are grouped"}</h2></div><Route aria-hidden="true" color="#0d6b62" size={24} /></div>
            <p className={styles.problem}>{view.recommendationExplanation}</p>
            <div className={styles.detailGrid} style={{ marginTop: "1.2rem" }}>
              <div className={styles.detail}><span className={styles.detailLabel}>{isStoreSweep ? "Requested completion by" : "Proposed visit"}</span><p className={styles.detailValue}>{isStoreSweep ? formatPublicDate(view.neededByAt, view.timeZone) : `${formatPublicDateTime(view.proposedStartsAt, view.timeZone)} – ${formatPublicDateTime(view.proposedEndsAt, view.timeZone)}`}</p></div>
              <div className={styles.detail}><span className={styles.detailLabel}>Respond by</span><p className={styles.detailValue}>{formatPublicDateTime(view.responseDueAt, view.timeZone)}</p></div>
              {isStoreSweep ? <><div className={styles.detail}><span className={styles.detailLabel}>Approved jobs</span><p className={styles.detailValue}>{jobCount}</p></div><div className={styles.detail}><span className={styles.detailLabel}>Visit schedule</span><p className={styles.detailValue}>Chosen by your company</p></div></> : <><div className={styles.detail}><span className={styles.detailLabel}>Protected route use</span><p className={styles.detailValue}>{view.capacityUsedMinutes} minutes</p></div><div className={styles.detail}><span className={styles.detailLabel}>Estimated presence</span><p className={styles.detailValue}>{view.estimatedDriveMinutes} travel · {view.estimatedServiceMinutes} service/buffer</p></div></>}
            </div>
          </section>
          {view.stops.map((stop) => (
            <section className={styles.card} key={stop.id} aria-labelledby={`stop-${stop.id}`}>
              <div className={styles.cardHeader}><div><span className={styles.eyebrow}>{isStoreSweep ? "Store" : `Stop ${stop.sequence}`}</span><h2 className={styles.cardTitle} id={`stop-${stop.id}`}>{stop.storeLabel}</h2></div><MapPinned aria-hidden="true" color="#0d6b62" size={24} /></div>
              <div className={styles.detailGrid}>
                {isStoreSweep ? <div className={styles.detail}><span className={styles.detailLabel}>Scheduling</span><p className={styles.detailValue}>Your company chooses the date, crew, route, and time onsite.</p></div> : <><div className={styles.detail}><span className={styles.detailLabel}>Proposed arrival</span><p className={styles.detailValue}>{formatPublicDateTime(stop.proposedArrivalAt, view.timeZone)}</p></div><div className={styles.detail}><span className={styles.detailLabel}>Planned time</span><p className={styles.detailValue}>{stop.driveMinutes} travel · {stop.serviceMinutes} onsite/buffer</p></div></>}
                <div className={`${styles.detail} ${styles.detailWide}`}><span className={styles.detailLabel}>Access</span><p className={styles.detailValue}>{stop.accessRequirements ?? "No special access requirement recorded"}</p></div>
              </div>
              {stop.workOrders.map((workOrder) => <div className={styles.callout} style={{ marginTop: ".8rem" }} key={workOrder.id}><strong>{workOrder.number} · {isStoreSweep ? "Approved job" : workOrder.kind}</strong><p>{workOrder.problem}</p><p className={styles.helper}>{isStoreSweep ? "This job keeps its own work-order number, result, and billing reference." : `${workOrder.durationMinutes} expected service minutes`}{workOrder.dueWindow ? " · preventive-maintenance window retained" : ""}</p></div>)}
            </section>
          ))}
          <ServiceRunResponseForm token={token} view={view} />
        </div>
        <aside className={styles.stack} aria-label={isStoreSweep ? "Visit details" : "Service Run safeguards"}>
          <section className={styles.card}><div className={styles.cardHeader}><h2 className={styles.cardTitle}>{isStoreSweep ? "Vendor work terms" : "Governing contract"}</h2><ShieldCheck aria-hidden="true" color="#0d6b62" size={23} /></div><p className={styles.detailValue}>{view.contract.sourceReference} · Version {view.contract.version}</p><p className={styles.helper}>{isStoreSweep ? "These customer records stay attached to every job in this visit." : "The exact Contract Version remains attached to the Run and its Work Orders."}</p></section>
          <section className={styles.card}><div className={styles.cardHeader}><h2 className={styles.cardTitle}>{isStoreSweep ? "Service areas" : "Required qualifications"}</h2><ClipboardCheck aria-hidden="true" color="#0d6b62" size={23} /></div>{view.qualifications.map((qualification) => <p className={styles.helper} key={qualification}>✓ {qualification.replaceAll("_", " ").replaceAll(":", " · ")}</p>)}</section>
          <section className={styles.card}><div className={styles.cardHeader}><h2 className={styles.cardTitle}>{isStoreSweep ? "What stays separate" : "Value classification"}</h2><CalendarClock aria-hidden="true" color="#0d6b62" size={23} /></div>{isStoreSweep ? <><p className={styles.detailValue}>Each job keeps its own number and result.</p><p className={styles.helper}>The customer is not claiming a savings amount just because these jobs are planned for one visit.</p></> : <><p className={styles.detailValue}>{view.estimatedOpportunityLabel} estimated opportunity</p><p className={styles.helper}>This is not realized savings. It becomes verified only after Vendor acceptance, combined visits, addressed Work Orders, and invoice or contract evidence.</p></>}</section>
        </aside>
      </div>
    </PublicFrame>
  );
}
