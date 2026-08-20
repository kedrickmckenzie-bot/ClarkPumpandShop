import { CalendarClock, ClipboardCheck, MapPinned, Route, ShieldCheck } from "lucide-react";
import type { ServiceRunPublicView } from "@/lib/ops/service-run-presenter";
import { formatPublicDateTime, PublicFrame } from "./public-ui";
import { ServiceRunResponseForm } from "./service-run-response-form";
import styles from "./public-workflows.module.css";

export function ServiceRunResponsePage({ token, view }: { token: string; view: ServiceRunPublicView }) {
  return (
    <PublicFrame organizationName={view.organizationName} context="Vendor Service Run" mode="demo">
      <div className={styles.hero}>
        <div><span className={styles.eyebrow}>Proposed for {view.vendorName}</span><h1 className={styles.title}>Service Run recommendation</h1><p className={styles.lede}>{view.stops.length} route stops · {view.stops.reduce((sum, stop) => sum + stop.workOrders.length, 0)} Work Orders</p></div>
        <span className={styles.statusPill}>Awaiting your response</span>
      </div>
      <div className={styles.layout}>
        <div className={styles.stack}>
          <section className={styles.card} aria-labelledby="recommendation-title">
            <div className={styles.cardHeader}><div><span className={styles.eyebrow}>Explainable recommendation</span><h2 className={styles.cardTitle} id="recommendation-title">Why these obligations are grouped</h2></div><Route aria-hidden="true" color="#0d6b62" size={24} /></div>
            <p className={styles.problem}>{view.recommendationExplanation}</p>
            <div className={styles.detailGrid} style={{ marginTop: "1.2rem" }}>
              <div className={styles.detail}><span className={styles.detailLabel}>Proposed window</span><p className={styles.detailValue}>{formatPublicDateTime(view.proposedStartsAt)} – {formatPublicDateTime(view.proposedEndsAt)}</p></div>
              <div className={styles.detail}><span className={styles.detailLabel}>Respond by</span><p className={styles.detailValue}>{formatPublicDateTime(view.responseDueAt)}</p></div>
              <div className={styles.detail}><span className={styles.detailLabel}>Protected route use</span><p className={styles.detailValue}>{view.capacityUsedMinutes} minutes</p></div>
              <div className={styles.detail}><span className={styles.detailLabel}>Estimated presence</span><p className={styles.detailValue}>{view.estimatedDriveMinutes} travel · {view.estimatedServiceMinutes} service/buffer</p></div>
            </div>
          </section>
          {view.stops.map((stop) => (
            <section className={styles.card} key={stop.id} aria-labelledby={`stop-${stop.id}`}>
              <div className={styles.cardHeader}><div><span className={styles.eyebrow}>Stop {stop.sequence}</span><h2 className={styles.cardTitle} id={`stop-${stop.id}`}>{stop.storeLabel}</h2></div><MapPinned aria-hidden="true" color="#0d6b62" size={24} /></div>
              <div className={styles.detailGrid}>
                <div className={styles.detail}><span className={styles.detailLabel}>Proposed arrival</span><p className={styles.detailValue}>{formatPublicDateTime(stop.proposedArrivalAt)}</p></div>
                <div className={styles.detail}><span className={styles.detailLabel}>Planned time</span><p className={styles.detailValue}>{stop.driveMinutes} travel · {stop.serviceMinutes} onsite/buffer</p></div>
                <div className={`${styles.detail} ${styles.detailWide}`}><span className={styles.detailLabel}>Access</span><p className={styles.detailValue}>{stop.accessRequirements ?? "No special access requirement recorded"}</p></div>
              </div>
              {stop.workOrders.map((workOrder) => <div className={styles.callout} style={{ marginTop: ".8rem" }} key={workOrder.id}><strong>{workOrder.number} · {workOrder.kind}</strong><p>{workOrder.problem}</p><p className={styles.helper}>{workOrder.durationMinutes} expected service minutes{workOrder.dueWindow ? " · protected PM due window retained" : ""}</p></div>)}
            </section>
          ))}
          <ServiceRunResponseForm token={token} view={view} />
        </div>
        <aside className={styles.stack} aria-label="Service Run safeguards">
          <section className={styles.card}><div className={styles.cardHeader}><h2 className={styles.cardTitle}>Governing contract</h2><ShieldCheck aria-hidden="true" color="#0d6b62" size={23} /></div><p className={styles.detailValue}>{view.contract.sourceReference} · Version {view.contract.version}</p><p className={styles.helper}>The exact Contract Version remains attached to the Run and its Work Orders.</p></section>
          <section className={styles.card}><div className={styles.cardHeader}><h2 className={styles.cardTitle}>Required qualifications</h2><ClipboardCheck aria-hidden="true" color="#0d6b62" size={23} /></div>{view.qualifications.map((qualification) => <p className={styles.helper} key={qualification}>✓ {qualification.replaceAll(":", " · ")}</p>)}</section>
          <section className={styles.card}><div className={styles.cardHeader}><h2 className={styles.cardTitle}>Value classification</h2><CalendarClock aria-hidden="true" color="#0d6b62" size={23} /></div><p className={styles.detailValue}>{view.estimatedOpportunityLabel} estimated opportunity</p><p className={styles.helper}>This is not realized savings. It becomes verified only after Vendor acceptance, combined visits, addressed Work Orders, and invoice or contract evidence.</p></section>
        </aside>
      </div>
    </PublicFrame>
  );
}
