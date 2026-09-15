import Link from "next/link";

import { domainLabel } from "@/lib/product/domain-label";
import type { Invoice, OpsFixture, WarrantyCase } from "@/lib/ops/types";
import { formatOperationsDate } from "@/lib/ops/local-time";
import styles from "./warranty-finance-workspace.module.css";

const money=(amount:number,currency:string)=>new Intl.NumberFormat("en-US",{style:"currency",currency}).format(amount/100);
const date=(value:string|undefined)=>value?formatOperationsDate(value):"—";
const label = domainLabel;

export function WarrantyQueueWorkspace({fixture,cases}:{fixture:OpsFixture;cases:WarrantyCase[]}){
  const exposure=fixture.valueEvents.filter((event)=>cases.some((item)=>item.id===event.warrantyCaseId)&&event.category==="identified_exposure").reduce((sum,event)=>sum+event.amount.amountMinor,0);
  return <div className={styles.page}><header className={styles.header}><div><p className={styles.eyebrow}>Spend & planning · Warranty safeguards</p><h1>Warranty center</h1><p>Review possible warranty coverage using prior repairs and the terms that applied.</p></div></header><section className={styles.metrics}><div className={styles.metric}><span>Open cases</span><strong>{cases.filter((item)=>!item.closedAt).length}</strong></div><div className={styles.metric}><span>Diagnosis required</span><strong>{cases.filter((item)=>item.diagnosisRequired).length}</strong></div><div className={styles.metric}><span>Invoice holds</span><strong>{cases.filter((item)=>item.invoiceHold).length}</strong></div><div className={styles.metric}><span>Identified exposure</span><strong>{money(exposure,"USD")}</strong></div></section><p className={styles.notice}><strong>Coverage alert, not a charge decision.</strong> Amounts under review are separate from confirmed credits or deductions. Review the diagnosis before deciding who is responsible.</p><section className={styles.panel}><div className={styles.panelHeader}><div><h2>Cases requiring evidence review</h2><p>Exact source records remain available for every detection.</p></div></div><div className={styles.tableWrap}>{cases.length?<table className={styles.table}><thead><tr><th>Case</th><th>Work Order / Store</th><th>Confidence</th><th>Coverage</th><th>Routing</th><th>Charge / hold</th></tr></thead><tbody>{cases.map((item)=>{const workOrder=fixture.workOrders.find((row)=>row.id===item.workOrderId);const store=fixture.stores.find((row)=>row.id===workOrder?.storeId);return <tr key={item.id}><td><Link href={`/app/warranties/${item.id}`}>Open warranty case</Link><div className={styles.lineMeta}>{label(item.status)}</div></td><td><Link href={`/app/work-orders/${item.workOrderId}`}>{workOrder?.number}</Link><div className={styles.lineMeta}>Store {store?.storeNumber} · {store?.name}</div></td><td><span className={item.confidence==="high"?styles.goodPill:styles.riskPill}>{item.confidence}</span><div className={styles.lineMeta}>{item.diagnosisRequired?"Diagnosis required":"Diagnosis recorded"}</div></td><td>{label(item.coverageDecision)}</td><td>{label(item.routingRule)}</td><td>{label(item.customerChargeStatus)}<div className={styles.lineMeta}>{item.invoiceHold?"Invoice held":"No warranty hold"}</div></td></tr>})}</tbody></table>:<p className={styles.empty}>No warranty cases are in this scope.</p>}</div></section></div>;
}

export { WarrantyCaseWorkspace } from "./warranty-case-workspace";

export function InvoiceQueueWorkspace({ fixture, invoices, page: requestedPage = "1", view = "all" }: { fixture: OpsFixture; invoices: Invoice[]; page?: string; view?: string }) {
  const invoiceIds = new Set(invoices.map((invoice) => invoice.id));
  const invoiceLines = fixture.invoiceLines.filter((line) => invoiceIds.has(line.invoiceId));
  const invoiceLineById = new Map(invoiceLines.map((line) => [line.id, line]));
  const openExceptions = fixture.invoiceExceptions.filter(
    (exception) => invoiceIds.has(exception.invoiceId) && exception.status === "open",
  );
  const reviewInvoiceIds = new Set(openExceptions.map((exception) => exception.invoiceId));
  const reviewInvoices = invoices.filter((invoice) => reviewInvoiceIds.has(invoice.id));
  const exposureEvents = fixture.valueEvents.filter(
    (event) => event.invoiceLineId && invoiceLineById.has(event.invoiceLineId) && event.category === "identified_exposure",
  );
  const exposure = exposureEvents.reduce((sum, event) => sum + event.amount.amountMinor, 0);
  const selected = view === "review" ? reviewInvoices : invoices;
  const ordered = [...selected].sort((a,b) => b.invoiceDate.localeCompare(a.invoiceDate) || a.id.localeCompare(b.id));
  const pages = Math.max(1, Math.ceil(ordered.length / 20));
  const parsedPage = Number(requestedPage);
  const page = Math.max(1, Math.min(pages, Number.isSafeInteger(parsedPage) ? parsedPage : 1));
  const shown = ordered.slice((page - 1) * 20, page * 20);
  const pageHref = (target: number) => `/app/invoices?view=${view === "review" ? "review" : "all"}&page=${target}#invoice-register`;
  return <div className={styles.page}>
    <header className={styles.header}><div><p className={styles.eyebrow}>Spend & planning · Invoice safeguards</p><h1>Invoice review</h1><p>See charges, linked work, and items to review.</p></div></header>
    <section className={`${styles.metrics} ${styles.invoiceMetrics}`} aria-label="Invoice review measures">
      <Link className={styles.metric} href="/app/invoices?view=all#invoice-register"><span>Invoices in scope</span><strong>{invoices.length}</strong></Link>
      <Link className={styles.metric} href="/app/invoices?view=review#invoice-register"><span>Invoices needing review</span><strong>{reviewInvoices.length}</strong></Link>
      <Link className={styles.metric} href="/app/invoices?view=review#invoice-register"><span>Open review flags</span><strong>{openExceptions.length}</strong></Link>
      <Link className={styles.metric} href="/app/invoices?view=review#invoice-register"><span>Identified exposure</span><strong>{money(exposure, "USD")}</strong></Link>
    </section>
    <p className={styles.notice}><strong>A flag is not a deduction.</strong> Review the work and terms. This app does not send payments.</p>

    <section className={styles.panel} id="invoice-register">
      <div className={styles.panelHeader}><div><h2>{view === "review" ? "Needs review" : "All invoices"}</h2><p></p></div><strong>{selected.length} invoice{selected.length === 1 ? "" : "s"}</strong></div>
      <div className={styles.tableWrap}><table className={`${styles.table} ${styles.invoiceRegister}`}><thead><tr><th>Invoice</th><th>Vendor</th><th>Total</th><th>Approved amount</th><th>Paid</th><th>Status</th><th>Record</th></tr></thead><tbody>{shown.map((invoice) => {
        const vendor = fixture.vendors.find((row) => row.id === invoice.vendorId);
        return <tr key={invoice.id}><td data-label="Invoice"><Link href={`/app/invoices/${invoice.id}`}>{invoice.vendorInvoiceNumber}</Link><div className={styles.lineMeta}>{date(invoice.invoiceDate)}</div></td><td data-label="Vendor">{vendor ? <Link className={styles.sectionLink} href={`/app/vendors/${vendor.id}`}>{vendor.name}</Link> : "Vendor unavailable"}</td><td data-label="Total">{money(invoice.total.amountMinor, invoice.total.currency)}</td><td data-label="Approved">{money(invoice.approvedForPayment.amountMinor, invoice.approvedForPayment.currency)}</td><td data-label="Paid">{money(invoice.paidAmount.amountMinor, invoice.paidAmount.currency)}</td><td data-label="Status"><span className={invoice.status === "exception" ? styles.riskPill : styles.pill}>{label(invoice.status)}</span></td><td data-label="Record"><Link className={styles.openRecord} href={`/app/invoices/${invoice.id}`}>Open invoice →</Link></td></tr>;
      })}</tbody></table></div>
    </section>
    <nav className={styles.invoicePages} aria-label="Invoice pages">{page > 1 ? <Link href={pageHref(page - 1)}>← Back</Link> : null}<span>Page {page} of {pages} · {selected.length} invoices</span>{page < pages ? <Link href={pageHref(page + 1)}>Next →</Link> : null}</nav>
  </div>;
}
