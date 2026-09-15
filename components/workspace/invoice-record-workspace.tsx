import Link from "next/link";
import { domainLabel } from "@/lib/product/domain-label";
import { formatOperationsDate } from "@/lib/ops/local-time";
import { invoiceRecordSections, type InvoiceRecordPage, type InvoiceRecordSection, type InvoiceRecordRow } from "@/lib/ops/invoice-record-query";
import type { Money } from "@/lib/ops/types";
import { InvoiceReviewDecision } from "./invoice-review-decision";
import styles from "./invoice-record-workspace.module.css";

const sectionLabels: Record<InvoiceRecordSection, string> = { items: "Invoice items", matches: "Work matches", evidence: "Service evidence", flags: "Review flags", history: "Review history" };
const amount = (value: Money) => new Intl.NumberFormat("en-US", { style: "currency", currency: value.currency }).format(value.amountMinor / 100);
const date = (value?: string) => value ? formatOperationsDate(value) : "Not recorded";
export function invoiceRecordHref(id: string, section: InvoiceRecordSection, page = 1, line?: string, match?: string, basis?: string, open = false) {
  const q = new URLSearchParams({ section }); if (page > 1) q.set("page", String(page)); if (line && section === "matches") q.set("line", line);
  if (match && section === "matches") q.set("match", match); if (basis) q.set("basis", basis); if (open) q.set("open", "yes");
  return `/app/invoices/${encodeURIComponent(id)}?${q}`;
}
function RelatedLinks({ row }: { row: InvoiceRecordRow }) {
  return <div className={styles.links}>
    {row.workId ? <Link href={`/app/work-orders/${encodeURIComponent(row.workId)}`}>{row.workNumber}</Link> : null}
    {row.storeId ? <Link href={`/app/stores/${encodeURIComponent(row.storeId)}`}>Store {row.storeNumber}</Link> : null}
    {row.visitId ? <Link href={`/app/visits/${encodeURIComponent(row.visitId)}?section=work-orders`}>Visit · {date(row.visitDate)}</Link> : row.kind === "match" ? <span>{row.unavailableVisit ? "Visit link unavailable" : "No visit linked"}</span> : null}
    {row.kind === "warranty" ? <Link href={`/app/warranties/${encodeURIComponent(row.id)}#diagnosis`}>Open warranty case</Link> : null}
    {row.kind === "accounting" ? <Link href={`/app/invoices/accounting?source=${encodeURIComponent(row.id)}`}>Open accounting source</Link> : null}
  </div>;
}
export function InvoiceRecordWorkspace({ result, section, page = 1, line, match, basis, open = false, scopeLabel, canDecide, decisionNote = "A company finance reviewer can record a decision.", updated = false }: {
  result: InvoiceRecordPage; section: InvoiceRecordSection; page?: number; line?: string; match?: string; basis?: "linked" | "unmatched"; open?: boolean; scopeLabel: string; canDecide: boolean; decisionNote?: string; updated?: boolean;
}) {
  const invoice = result.invoice!; const pages = Math.max(1, Math.ceil(result.totalCount / 25));
  return <div className={styles.page}>
    <header className={styles.header}><div><p className={styles.eyebrow}>Invoice review</p><h1>{invoice.number}</h1><p>{invoice.vendorId ? <Link href={`/app/vendors/${encodeURIComponent(invoice.vendorId)}`}>{invoice.vendorName}</Link> : "Vendor unavailable"} · {date(invoice.date)} · {domainLabel(invoice.status)}</p></div><Link className={styles.button} href="/app/invoices">Back to invoices</Link></header>
    <p className={styles.scope}>{scopeLabel}</p>
    {updated ? <p role="status" className={styles.notice}>Review decision saved.</p> : null}
    <div className={styles.totals} aria-label="Invoice amounts">
      <Link href={invoiceRecordHref(invoice.id, "items")}><span>Invoice total</span><strong>{amount(invoice.total)}</strong></Link>
      <Link href={invoiceRecordHref(invoice.id, "matches", 1, undefined, undefined, "linked")}><span>Linked invoice amount</span><strong>{amount(invoice.linked)}</strong></Link>
      <Link href={invoiceRecordHref(invoice.id, "items", 1, undefined, undefined, "unmatched")}><span>Unmatched invoice amount</span><strong>{amount(invoice.unmatched)}</strong></Link>
    </div>
    {!invoice.itemsReconcile ? <p className={styles.status}>Items do not add up to the invoice total. Review all items before matching.</p> : null}<p className={styles.status}>{invoice.reportingState === "excluded" ? "Excluded from linked invoice reporting." : invoice.reportingState === "needs_review" ? "Review item amounts and work matches." : "All invoice items are matched."}{invoice.openFlags ? <> <Link href={invoiceRecordHref(invoice.id, "flags", 1, undefined, undefined, undefined, true)}>{invoice.openFlags} open review {invoice.openFlags === 1 ? "flag" : "flags"}</Link></> : null}</p>
    <nav className={styles.tabs} aria-label="Invoice sections">{invoiceRecordSections.map(key => <Link key={key} aria-current={section === key ? "page" : undefined} href={invoiceRecordHref(invoice.id, key)}>{sectionLabels[key]} <span>{invoice.counts[key]}</span></Link>)}</nav>
    {section === "evidence" ? <div className={styles.context}><strong>Vendor agreement</strong><span>{invoice.agreement ?? (invoice.unavailableAgreement ? "Agreement link unavailable" : "No linked agreement")}</span><p>Visit evidence shows approximate presence. Review the work separately.</p></div> : null}
    {section === "history" ? <div className={styles.context}><p>Approved amount: <strong>{amount(invoice.approved)}</strong> · Recorded paid amount: <strong>{amount(invoice.paid)}</strong></p><p>This app does not send payments. Review flags do not count as confirmed savings.</p></div> : null}
    <section className={styles.surface} aria-labelledby="invoice-section-title"><header><div><h2 id="invoice-section-title">{open ? "Open review flags" : basis === "unmatched" ? "Unmatched item balances" : basis === "linked" ? "Confirmed linked amounts" : sectionLabels[section]}</h2>{line || match || basis || open ? <Link href={invoiceRecordHref(invoice.id, section)}>Show all {sectionLabels[section].toLowerCase()}</Link> : null}</div><span>{result.rows.length ? (page - 1) * 25 + 1 : 0}–{result.rows.length ? (page - 1) * 25 + result.rows.length : 0} of {result.totalCount}</span></header>
      {section === "flags" ? <div className={styles.flags}>{result.rows.map(row => <article key={`${row.kind}:${row.id}`} id={`flag-${row.id}`}><header><h3>{domainLabel(row.label)}</h3><strong>{row.amount ? amount(row.amount) : ""}</strong></header><p>{row.detail}</p><p className={styles.muted}>{domainLabel(row.status)} · Flagged {date(row.date)}</p>{row.actor ? <p>{row.actor}</p> : null}{row.status === "open" && canDecide ? <details><summary>Record decision</summary><InvoiceReviewDecision invoiceId={invoice.id} flagId={row.id} version={invoice.version} currency={invoice.total.currency} /></details> : row.status === "open" ? <p className={styles.muted}>{decisionNote}</p> : null}</article>)}</div> : <div className={styles.tableWrap}><table><caption>{sectionLabels[section]}</caption><thead><tr><th>{section === "items" ? "Item" : "Record"}</th><th>{section === "items" ? "Category / matches" : "Status / date"}</th><th>Amount</th></tr></thead><tbody>{result.rows.map(row => <tr key={`${row.kind}:${row.id}`} id={row.kind === "match" ? `allocation-${row.id}` : undefined}>
        <td data-label={section === "items" ? "Item" : "Record"}><strong>{row.lineNumber ? `#${row.lineNumber} · ` : ""}{row.kind === "match" ? row.detail : row.kind === "item" ? row.label : row.kind === "audit" ? row.label === "invoice.review_decided" ? "Review decision" : "Invoice update" : domainLabel(row.label)}</strong>{row.kind !== "item" && row.kind !== "match" ? <p>{row.detail}</p> : null}<RelatedLinks row={row} />{row.workStatus ? <small>Work status: {domainLabel(row.workStatus)}</small> : null}{row.actor ? <small>{row.actor}</small> : null}</td>
        <td data-label={section === "items" ? "Category / matches" : "Status / date"}>{section === "items" ? <><span>{domainLabel(row.detail)}</span><Link href={invoiceRecordHref(invoice.id, "matches", 1, row.id)}>{row.status}</Link></> : <><span>{domainLabel(row.status)}</span><small>{date(row.date)}</small></>}</td>
        <td data-label="Amount">{row.amount ? amount(row.amount) : "—"}</td>
      </tr>)}</tbody></table></div>}
      {!result.rows.length ? <p className={styles.empty}>{section === "history" ? "No review history in this view." : `No ${sectionLabels[section].toLowerCase()} in this view.`}</p> : null}
      {pages > 1 || page > 1 ? <nav className={styles.pagination} aria-label="Invoice source pages"><span>Page {page} of {pages}</span><div>{page > 1 ? <Link href={invoiceRecordHref(invoice.id, section, Math.min(page - 1, pages), line, match, basis, open)}>Previous</Link> : null}{page < pages ? <Link href={invoiceRecordHref(invoice.id, section, page + 1, line, match, basis, open)}>Next</Link> : null}</div></nav> : null}
    </section>
    <details className={styles.method}><summary>How amounts are counted</summary><p>Linked amounts use confirmed, positive allocations in the invoice currency. Items must reconcile to the invoice total, and matches cannot exceed their item. Other currencies remain visible on their source rows. When items do not reconcile, the unmatched invoice amount uses the invoice total. An open flag does not change the billed amount. Review decisions and accounting updates are recorded separately.</p><Link href={`/app/trends?metric=linked_invoice&currency=${invoice.total.currency}&invoice=${encodeURIComponent(invoice.id)}&period=6&view=records`}>View this invoice in Trends</Link></details>
  </div>;
}
