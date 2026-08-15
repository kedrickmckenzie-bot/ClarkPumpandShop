import { Building2, CircleDollarSign, FileSearch, MapPin, ShieldCheck } from "lucide-react";
import type { VendorEstimateView } from "./contracts";
import { formatPublicDateTime, PublicFrame } from "./public-ui";
import { VendorEstimateForm } from "./vendor-estimate-form";
import styles from "./public-workflows.module.css";

export function VendorEstimatePage({ token, estimate }: { token: string; estimate: VendorEstimateView }) {
  return (
    <PublicFrame organizationName={estimate.organizationName} context="Vendor Bid Request" mode={estimate.mode}>
      <div className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Bid requested from {estimate.vendorName}</span>
          <h1 className={styles.title}>{estimate.operatorWorkOrderNumber}</h1>
          <p className={styles.lede}>{estimate.store.name} · Store {estimate.store.number}</p>
        </div>
        <span className={styles.statusPill}>{estimate.statusLabel}</span>
      </div>

      <div className={styles.layout}>
        <div className={styles.stack}>
          <section className={styles.card} aria-labelledby="price-scope-title">
            <div className={styles.cardHeader}>
              <div><span className={styles.eyebrow}>{estimate.requestKindLabel}</span><h2 className={styles.cardTitle} id="price-scope-title">What the operator wants you to bid</h2></div>
              <FileSearch aria-hidden="true" color="#0d6b62" size={24} />
            </div>
            <p className={styles.problem}>{estimate.problem}</p>
            <div className={styles.callout} style={{ marginTop: "1rem" }}><strong>Bid scope</strong><p>{estimate.requestedScope}</p></div>
            <div className={styles.detailGrid} style={{ marginTop: "1.2rem" }}>
              <div className={styles.detail}><span className={styles.detailLabel}>Requested</span><p className={styles.detailValue}>{formatPublicDateTime(estimate.requestedAt)}</p></div>
              <div className={styles.detail}><span className={styles.detailLabel}>Bid due</span><p className={styles.detailValue}>{estimate.dueAt ? formatPublicDateTime(estimate.dueAt) : "No deadline stated"}</p></div>
            </div>
          </section>

          {estimate.latestProposal ? (
            <section className={styles.card} aria-labelledby="current-bid-title">
              <div className={styles.cardHeader}>
                <div><span className={styles.eyebrow}>Current bid</span><h2 className={styles.cardTitle} id="current-bid-title">Bid revision {estimate.latestProposal.revision}</h2></div>
                <CircleDollarSign aria-hidden="true" color="#0d6b62" size={24} />
              </div>
              <div className={styles.detailGrid}>
                <div className={styles.detail}><span className={styles.detailLabel}>Bid amount</span><p className={styles.detailValue}>{estimate.latestProposal.amountLabel}</p></div>
                <div className={styles.detail}><span className={styles.detailLabel}>Submitted</span><p className={styles.detailValue}>{formatPublicDateTime(estimate.latestProposal.submittedAt)}</p></div>
                <div className={`${styles.detail} ${styles.detailWide}`}><span className={styles.detailLabel}>Scope</span><p className={styles.detailValue}>{estimate.latestProposal.scope}</p></div>
                <div className={`${styles.detail} ${styles.detailWide}`}><span className={styles.detailLabel}>Exclusions</span><p className={styles.detailValue}>{estimate.latestProposal.exclusions ?? "None stated"}</p></div>
              </div>
            </section>
          ) : null}

          <VendorEstimateForm estimate={estimate} token={token} />
        </div>

        <aside className={styles.stack} aria-label="Bid-request context">
          <section className={styles.card}>
            <div className={styles.cardHeader}><h2 className={styles.cardTitle}>Store</h2><Building2 aria-hidden="true" color="#0d6b62" size={22} /></div>
            <div className={styles.detail}><span className={styles.detailLabel}>Location</span><p className={styles.detailValue}><MapPin aria-hidden="true" size={16} /> {estimate.store.address}</p></div>
          </section>
          <section className={styles.card}>
            <ShieldCheck aria-hidden="true" color="#0d6b62" size={24} />
            <h2 className={styles.cardTitle} style={{ marginTop: ".65rem" }}>{estimate.decisionKind === "replacement_quote" ? "This is a replacement quote, not a service assignment" : "This bid request is pricing only"}</h2>
            <p className={styles.muted} style={{ marginTop: ".45rem" }}>{estimate.decisionKind === "replacement_quote" ? "Your company is being asked to price equipment replacement for capital review. Do not travel to the store, check in, begin work, or bill against this request. Selection records a pricing decision only; any authorized installation work will arrive separately." : "Your company is not assigned or authorized by this request. Do not travel to the store, check in, begin service, or bill against it. If selected, you will receive a separate Work Order / Service Authorization tied to the same operator work-order number."}</p>
          </section>
          <section className={styles.notice}><strong>Need clarification?</strong><p className={styles.helper}>{estimate.organizationSupport}</p></section>
        </aside>
      </div>
    </PublicFrame>
  );
}
