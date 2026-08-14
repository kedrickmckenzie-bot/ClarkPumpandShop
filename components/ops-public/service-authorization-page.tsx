import Link from "next/link";
import { ArrowRight, Building2, CalendarDays, FileCheck2, MapPin, Phone } from "lucide-react";
import type { ServiceAuthorizationView } from "./contracts";
import { formatPublicDateTime, PublicFrame } from "./public-ui";
import { VendorResponseForm } from "./vendor-response-form";
import styles from "./public-workflows.module.css";

export function ServiceAuthorizationPage({ token, authorization }: { token: string; authorization: ServiceAuthorizationView }) {
  const hasFinalResponse = authorization.status === "accepted" || authorization.status === "declined";
  return (
    <PublicFrame organizationName={authorization.organizationName} context="Work Order / Service Authorization" mode={authorization.mode}>
      <div className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Authorized work issued to {authorization.vendorName}</span>
          <h1 className={styles.title}>{authorization.operatorWorkOrderNumber}</h1>
          <p className={styles.lede}>{authorization.store.name} · Store {authorization.store.number}</p>
        </div>
        <span className={styles.priority}>{authorization.priority}</span>
      </div>

      <div className={styles.layout}>
        <div className={styles.stack}>
          <section className={styles.card} aria-labelledby="service-request-title">
            <div className={styles.cardHeader}>
              <div>
                <span className={styles.eyebrow}>Customer-authorized service</span>
                <h2 className={styles.cardTitle} id="service-request-title">This is a work order, not a bid request</h2>
              </div>
              <FileCheck2 aria-hidden="true" color="#0d6b62" size={24} />
            </div>
            <div className={styles.callout}>
              <strong>Your company was selected for this work</strong>
              <p>Review and accept the service authorization before scheduling or beginning work. Technician visit and check-in tools are available for this authorized service.</p>
            </div>
            <p className={styles.problem}>{authorization.service.problem}</p>
            <div className={styles.callout} style={{ marginTop: "1rem" }}>
              <strong>Authorized scope</strong>
              <p>{authorization.service.requestedWork}</p>
            </div>
            <div className={styles.detailGrid} style={{ marginTop: "1.2rem" }}>
              <div className={styles.detail}><span className={styles.detailLabel}>Category</span><p className={styles.detailValue}>{authorization.service.category ?? "To be classified"}</p></div>
              <div className={styles.detail}><span className={styles.detailLabel}>Equipment</span><p className={styles.detailValue}>{authorization.service.asset ?? "Not required for this work"}</p></div>
              <div className={styles.detail}><span className={styles.detailLabel}>Issued</span><p className={styles.detailValue}>{formatPublicDateTime(authorization.issuedAt)}</p></div>
              <div className={styles.detail}><span className={styles.detailLabel}>Revision</span><p className={styles.detailValue}>Revision {authorization.revision}</p></div>
            </div>
          </section>

          {authorization.priorResponse ? (
            <section className={styles.notice} aria-label="Recorded vendor response">
              <strong>{authorization.priorResponse.label}</strong>
              <p className={styles.helper}>Received {formatPublicDateTime(authorization.priorResponse.receivedAt)}{authorization.priorResponse.detail ? ` · ${authorization.priorResponse.detail}` : ""}</p>
            </section>
          ) : null}
          <VendorResponseForm disabled={hasFinalResponse} opened={authorization.opened} token={token} />
        </div>

        <aside className={styles.stack} aria-label="Service authorization details">
          <section className={styles.card}>
            <div className={styles.cardHeader}><h2 className={styles.cardTitle}>Store access</h2><Building2 aria-hidden="true" color="#0d6b62" size={22} /></div>
            <div className={styles.stack}>
              <div className={styles.detail}><span className={styles.detailLabel}>Location</span><p className={styles.detailValue}><MapPin aria-hidden="true" size={16} /> {authorization.store.address}</p></div>
              {authorization.store.phone ? <div className={styles.detail}><span className={styles.detailLabel}>Store phone</span><p className={styles.detailValue}><Phone aria-hidden="true" size={16} /> {authorization.store.phone}</p></div> : null}
              {authorization.service.accessNotes ? <div className={styles.detail}><span className={styles.detailLabel}>Access notes</span><p className={styles.detailValue}>{authorization.service.accessNotes}</p></div> : null}
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Authorization & billing</h2>
            <div className={styles.stack} style={{ marginTop: "1rem" }}>
              <div className={styles.detail}><span className={styles.detailLabel}>Authorization limit</span><p className={styles.detailValue}>{authorization.authorization.notToExceedLabel ?? "No limit stated"}</p></div>
              <div className={styles.detail}><span className={styles.detailLabel}>Billing reference</span><p className={styles.detailValue}>{authorization.authorization.billingInstruction}</p></div>
              <div className={styles.detail}><span className={styles.detailLabel}>Issued by</span><p className={styles.detailValue}>{authorization.authorization.requestedBy}</p></div>
            </div>
          </section>

          {authorization.technicianVisitUrl ? (
            <section className={styles.card}>
              <CalendarDays aria-hidden="true" color="#0d6b62" size={24} />
              <h2 className={styles.cardTitle} style={{ marginTop: "0.65rem" }}>Technician check-in and checkout</h2>
              <p className={styles.muted} style={{ marginTop: "0.35rem" }}>This visit action is available because the separate work order authorizes onsite service. Start or finish the store visit from any phone; no vendor account is required.</p>
              <Link className={styles.textLink} href={authorization.technicianVisitUrl} style={{ marginTop: "0.85rem" }}>Open technician check-in / checkout <ArrowRight aria-hidden="true" size={16} /></Link>
            </section>
          ) : null}

          <section className={styles.notice}>
            <strong>Need help?</strong>
            <p className={styles.helper}>{authorization.organizationSupport}</p>
          </section>
        </aside>
      </div>
    </PublicFrame>
  );
}
