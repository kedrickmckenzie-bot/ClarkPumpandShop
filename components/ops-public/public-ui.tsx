import Link from "next/link";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, LockKeyhole } from "lucide-react";
import type {
  PublicActionReceipt,
  PublicRuntimeMode,
  StoreIssueReceipt,
  TechnicianCheckInReceipt,
  TechnicianCheckOutReceipt,
} from "./contracts";
import { productFullName, productPresentation } from "@/lib/product/presentation";
import styles from "./public-workflows.module.css";

export function formatPublicDateTime(value: string, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone,
  }).format(new Date(value));
}

export function formatPublicDate(value: string, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  }).format(new Date(value));
}

export function PublicFrame({
  organizationName,
  context,
  mode,
  backHref,
  backLabel = "Back to store options",
  children,
}: {
  organizationName: string;
  context: string;
  mode: PublicRuntimeMode;
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.page}>
      <a className={styles.skipLink} href="#public-main">Skip to main content</a>
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <div className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true">{productPresentation.identity.monogram}</span>
            <div className={styles.brandCopy}>
              <p className={styles.brandName}>{organizationName}</p>
              <p className={styles.brandContext}>{context}</p>
            </div>
          </div>
          <span className={styles.secureLabel}><LockKeyhole size={15} aria-hidden="true" /> Secure action link</span>
        </div>
      </header>
      <main className={styles.main} id="public-main">
        {mode === "demo" ? <span className={styles.modeBadge}>Demonstration environment</span> : null}
        {backHref ? <Link className={styles.workflowBackLink} href={backHref}><ArrowLeft aria-hidden="true" size={17} />{backLabel}</Link> : null}
        {children}
        <footer className={styles.footer}>
          <p>Powered by {productPresentation.identity.workingName} · Service accountability for multi-location operators</p>
          <p>Location is captured only at check-in or checkout when enabled. No continuous tracking.</p>
        </footer>
      </main>
    </div>
  );
}

export function PublicLinkUnavailable({ kind = "link" }: { kind?: "link" | "service authorization" | "store link" | "bid request" }) {
  return (
    <PublicFrame organizationName={productFullName} context="Secure public workflow" mode="live">
      <section className={styles.errorCard} aria-labelledby="unavailable-title">
        <AlertTriangle size={30} aria-hidden="true" />
        <h1 className={styles.sectionTitle} id="unavailable-title">This {kind} is unavailable</h1>
        <p className={styles.muted}>
          It may be incomplete, expired, revoked, or already replaced. Ask the operator that sent it for a new secure link.
        </p>
      </section>
    </PublicFrame>
  );
}

export function ServerReceipt({
  receipt,
  restartHref,
  restartLabel,
  timeZone,
}: {
  receipt: PublicActionReceipt | TechnicianCheckInReceipt | TechnicianCheckOutReceipt | StoreIssueReceipt;
  restartHref?: string;
  restartLabel?: string;
  timeZone?: string;
}) {
  const checkIn = "checkedInAt" in receipt ? receipt : undefined;
  const checkOut = "checkedOutAt" in receipt ? receipt : undefined;
  const issue = "requestNumber" in receipt ? receipt : undefined;
  return (
    <section className={styles.receipt} aria-live="polite" aria-labelledby="receipt-title">
      <span className={styles.receiptIcon} aria-hidden="true"><Check size={24} /></span>
      <h2 className={styles.receiptTitle} id="receipt-title">{receipt.heading}</h2>
      <p className={styles.receiptMessage}>{receipt.message}</p>
      <div className={styles.receiptGrid}>
        {checkIn ? (
          <>
            <div className={styles.receiptDetail}><span className={styles.detailLabel}>Technician</span><p className={styles.detailValue}>{checkIn.technicianName}</p></div>
            <div className={styles.receiptDetail}><span className={styles.detailLabel}>Vendor</span><p className={styles.detailValue}>{checkIn.vendorName}</p></div>
            <div className={styles.receiptDetail}><span className={styles.detailLabel}>Checked in</span><p className={styles.detailValue}>{formatPublicDateTime(checkIn.checkedInAt, timeZone)}</p></div>
            <div className={`${styles.receiptDetail} ${checkIn.workOrders.length > 1 ? styles.detailWide : ""}`}><span className={styles.detailLabel}>{checkIn.workOrders.length === 1 ? "Work order" : "Work orders"}</span><p className={styles.detailValue}>{checkIn.workOrders.length ? checkIn.workOrders.map((workOrder) => workOrder.number).join(" · ") : "No work order provided"}</p></div>
            <div className={styles.receiptDetail}><span className={styles.detailLabel}>Crew</span><p className={styles.detailValue}>{checkIn.crewCount} {checkIn.crewCount === 1 ? "person" : "people"}{checkIn.additionalTechnicianNames.length ? ` · ${checkIn.additionalTechnicianNames.join(", ")}` : ""}</p></div>
            {checkIn.vehicleIdentifier ? <div className={styles.receiptDetail}><span className={styles.detailLabel}>Vehicle</span><p className={styles.detailValue}>{checkIn.vehicleIdentifier}</p></div> : null}
            {checkIn.arrivalNote ? <div className={`${styles.receiptDetail} ${styles.detailWide}`}><span className={styles.detailLabel}>Arrival note</span><p className={styles.detailValue}>{checkIn.arrivalNote}</p></div> : null}
            <div className={styles.receiptDetail}><span className={styles.detailLabel}>Secure checkout link</span><p className={styles.detailValue}>Available until {formatPublicDateTime(checkIn.checkoutExpiresAt, timeZone)}</p></div>
            <div className={`${styles.receiptDetail} ${styles.detailWide}`}><span className={styles.detailLabel}>Location evidence</span><p className={styles.detailValue}>{checkIn.location.label}</p></div>
          </>
        ) : null}
        {checkOut ? (
          <>
            <div className={styles.receiptDetail}><span className={styles.detailLabel}>Checked out</span><p className={styles.detailValue}>{formatPublicDateTime(checkOut.checkedOutAt, timeZone)}</p></div>
            <div className={`${styles.receiptDetail} ${checkOut.workOrderOutcomes.length > 1 ? styles.detailWide : ""}`}><span className={styles.detailLabel}>Outcome</span><p className={styles.detailValue}>{checkOut.outcomeLabel}</p>{checkOut.workOrderOutcomes.map((workOrder) => <p className={styles.helper} key={workOrder.id}><strong>{workOrder.number}</strong> · {workOrder.outcomeLabel}{workOrder.followUpLabel ? ` · ${workOrder.followUpLabel}` : ""}</p>)}</div>
            <div className={styles.receiptDetail}><span className={styles.detailLabel}>Files received</span><p className={styles.detailValue}>{checkOut.evidenceReceived}</p>{checkOut.evidenceStorageLabel ? <p className={styles.helper}>{checkOut.evidenceStorageLabel}</p> : null}</div>
            <div className={styles.receiptDetail}><span className={styles.detailLabel}>Observed onsite window</span><p className={styles.detailValue}>{checkOut.observedDurationLabel}</p></div>
            <div className={`${styles.receiptDetail} ${styles.detailWide}`}><span className={styles.detailLabel}>Location evidence</span><p className={styles.detailValue}>{checkOut.location.label}</p></div>
            {checkOut.followUpLabel ? <div className={`${styles.callout} ${styles.detailWide}`}><strong>Follow-up created</strong><p>{checkOut.followUpLabel}</p></div> : null}
          </>
        ) : null}
        {issue ? (
          <>
            <div className={styles.receiptDetail}><span className={styles.detailLabel}>Request number</span><p className={styles.detailValue}>{issue.requestNumber}</p></div>
            <div className={styles.receiptDetail}><span className={styles.detailLabel}>Store</span><p className={styles.detailValue}>Store {issue.storeNumber}</p></div>
            {issue.evidenceStorageLabel ? <div className={styles.receiptDetail}><span className={styles.detailLabel}>Photos</span><p className={styles.detailValue}>{issue.evidenceStorageLabel}</p></div> : null}
            <div className={`${styles.receiptDetail} ${styles.detailWide}`}><span className={styles.detailLabel}>What happens next</span><p className={styles.detailValue}>{issue.nextStep}</p></div>
          </>
        ) : null}
      </div>
      {checkOut ? <p className={styles.disclaimer}>Observed onsite duration is approximate presence evidence. It is not certified labor time or automatic invoice proof.</p> : null}
      <p className={styles.receiptMeta}>Server receipt {receipt.receiptId} · received {formatPublicDateTime(receipt.receivedAt, timeZone)}</p>
      {restartHref && restartLabel ? <Link className={styles.textLink} href={restartHref}>{restartLabel} <ArrowRight size={16} aria-hidden="true" /></Link> : null}
    </section>
  );
}
