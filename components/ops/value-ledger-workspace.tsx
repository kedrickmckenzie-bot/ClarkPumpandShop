import Link from "next/link";
import type { OpsFixture, ValueEvent, ValueEventCategory } from "@/lib/ops/types";
import { formatOperationsDateTime } from "@/lib/ops/local-time";
import styles from "./warranty-finance-workspace.module.css";

const categories: ValueEventCategory[] = ["realized_verified", "identified_exposure", "estimated_opportunity"];

function money(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount / 100);
}

function label(value: string) {
  return value.replaceAll("_", " ");
}

function supportingRecords(fixture: OpsFixture, event: ValueEvent) {
  if (event.invoiceLineId) {
    const line = fixture.invoiceLines.find((item) => item.id === event.invoiceLineId);
    const invoice = line ? fixture.invoices.find((item) => item.id === line.invoiceId) : undefined;
    if (invoice) {
      const relatedInvoices = event.eventType === "duplicate_document_fingerprint" && invoice.supportingFileId
        ? fixture.invoices.filter((item) => item.organizationId === event.organizationId && item.supportingFileId === invoice.supportingFileId)
        : [invoice];
      return relatedInvoices.map((item) => ({ href: `/app/invoices/${item.id}`, label: `Invoice ${item.vendorInvoiceNumber}` }));
    }
  }
  if (event.warrantyCaseId) return [{ href: `/app/warranties/${event.warrantyCaseId}`, label: "Warranty case" }];
  if (event.workOrderId) {
    const work = fixture.workOrders.find((item) => item.id === event.workOrderId);
    return [{ href: `/app/work-orders/${event.workOrderId}`, label: work?.number ?? "Work order" }];
  }
  if (event.assetId) {
    const asset = fixture.assets.find((item) => item.id === event.assetId);
    return [{ href: `/app/equipment/${event.assetId}`, label: asset?.assetTag ?? "Equipment" }];
  }
  return [{ href: "/app/reports", label: "Supporting report" }];
}

export function ValueLedgerWorkspace({
  fixture,
  events,
  allEvents,
  category,
}: {
  fixture: OpsFixture;
  events: ValueEvent[];
  allEvents: ValueEvent[];
  category?: ValueEventCategory;
}) {
  const organizationTimeZone = fixture.organizations.find((organization) => organization.id === events[0]?.organizationId)?.timeZone;
  const totals = new Map(categories.map((item) => [
    item,
    allEvents.filter((event) => event.category === item).reduce((sum, event) => sum + event.amount.amountMinor, 0),
  ]));
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Management proof · Source-linked economics</p>
          <h1>Value ledger</h1>
          <p>Every amount comes from a persisted event and opens its supporting operational or financial record. The three classes are deliberately never combined into one inflated savings number.</p>
        </div>
        <Link className={styles.secondaryButton} href="/app/reports">Reports</Link>
      </header>

      <section className={styles.metrics}>
        {categories.map((item) => <div className={styles.metric} key={item}>
          <span>{label(item)}</span>
          <strong>{money(totals.get(item) ?? 0, "USD")}</strong>
          <Link className={styles.sectionLink} href={`/app/reports/value?category=${item}`}>Open exact events</Link>
        </div>)}
      </section>

      <div className={styles.evidence}>
        <p className={styles.safe}><strong>Realized and verified</strong><span>Requires completed evidence or an explicit authorized final decision, such as a recorded invoice adjustment.</span></p>
        <p className={styles.notice}><strong>Identified exposure</strong><span>A reviewable risk or possible recovery. It is not a deduction, credit, or savings claim.</span></p>
        <p className={styles.fact}><small>Estimated opportunity</small><strong>Planning only</strong><span>Potential future benefit, such as a Service Run recommendation. Acceptance alone does not realize it.</span></p>
      </div>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>{category ? label(category) : "All source-linked Value Events"}</h2>
            <p>Internal controls keep one source decision from appearing more than once in the totals.</p>
          </div>
          {category ? <Link className={styles.sectionLink} href="/app/reports/value">Clear filter</Link> : null}
        </div>
        <div className={styles.tableWrap}>
          {events.length ? <table className={styles.table}>
            <thead><tr><th>Classification</th><th>Event</th><th>Amount</th><th>Source decision</th><th>Supporting records</th><th>When</th></tr></thead>
            <tbody>{events.map((event) => {
              const records = supportingRecords(fixture, event);
              return <tr key={event.id}>
                <td><span className={event.category === "realized_verified" ? styles.goodPill : event.category === "identified_exposure" ? styles.riskPill : styles.pill}>{label(event.category)}</span></td>
                <td>{label(event.eventType)}</td>
                <td>{money(event.amount.amountMinor, event.amount.currency)}</td>
                <td>{event.sourceDecision}</td>
                <td>{records.map((record) => <div key={record.href}><Link href={record.href}>{record.label}</Link></div>)}</td>
                <td>{formatOperationsDateTime(event.occurredAt, organizationTimeZone)}</td>
              </tr>;
            })}</tbody>
          </table> : <p className={styles.empty}>No Value Events match this class and scope.</p>}
        </div>
      </section>
    </div>
  );
}
