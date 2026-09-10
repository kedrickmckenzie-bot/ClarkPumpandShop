import Link from "next/link";
import { domainLabel as label } from "@/lib/product/domain-label";
import type { OpsFixture, ValueEvent, ValueEventCategory } from "@/lib/ops/types";
import { formatOperationsDateTime } from "@/lib/ops/local-time";
import styles from "./warranty-finance-workspace.module.css";

const categories: ValueEventCategory[] = ["realized_verified", "identified_exposure", "estimated_opportunity"];

function money(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount / 100);
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
  if (event.serviceRunId) return [{ href: `/app/service-runs/${event.serviceRunId}`, label: "Combined service visit review" }];
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
  const totalLabel = (category: ValueEventCategory) => {
    const currencies = new Map<string, number>();
    for (const event of allEvents.filter((event) => event.category === category)) currencies.set(event.amount.currency, (currencies.get(event.amount.currency) ?? 0) + event.amount.amountMinor);
    return currencies.size ? [...currencies].map(([currency, total]) => money(total, currency)).join(" · ") : "No recorded amount";
  };
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Financial review</p>
          <h1>Financial benefits and opportunities</h1>
          <p>Review confirmed benefits, possible recoveries, and planning estimates separately. Open each amount’s source to check the evidence.</p>
        </div>
        <Link className={styles.secondaryButton} href="/app/reports">Reports</Link>
      </header>

      <section className={styles.metrics}>
        {categories.map((item) => <div className={styles.metric} key={item}>
          <span>{label(item)}</span>
          <strong>{totalLabel(item)}</strong>
          <Link className={styles.sectionLink} href={`/app/reports/value?category=${item}`}>Review supporting records</Link>
        </div>)}
      </section>

      <div className={styles.evidence}>
        <p className={styles.safe}><strong>Confirmed financial benefits</strong><span>Requires evidence of an applied credit or other verified benefit. A requested deduction, deferred purchase, or expected avoided trip does not qualify.</span></p>
        <p className={styles.notice}><strong>Identified exposure</strong><span>A reviewable risk or possible recovery. It is not a deduction, credit, or savings claim.</span></p>
        <p className={styles.fact}><small>Estimated opportunity</small><strong>Planning only</strong><span>Forward-looking scenarios remain separate from realized value and require supporting evidence before they can become a savings claim.</span></p>
      </div>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>{category ? label(category) : "All financial benefits and opportunities"}</h2>
            <p>Each entry keeps its source and review history. Corrections remain visible.</p>
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
          </table> : <p className={styles.empty}>No financial entries match these filters.</p>}
        </div>
      </section>
    </div>
  );
}
