import Link from "next/link";
import { domainLabel } from "@/lib/product/domain-label";
import { formatOperationsDate } from "@/lib/ops/local-time";
import type { InvoiceQueuePage, InvoiceQueueView, InvoiceQueueRow } from "@/lib/ops/invoice-queue-query";
import type { Money } from "@/lib/ops/types";
import styles from "./invoice-queue-workspace.module.css";

const money = (m: Money) => new Intl.NumberFormat("en-US", { style: "currency", currency: m.currency }).format(m.amountMinor / 100);
const titles = { all: "All invoices", review: "Needs review", flags: "Open review flags", exposure: "Amounts flagged" };
export function InvoiceQueueWorkspace({ result, view = "all", page = 1, currency = "USD", search = "", scopeLabel, canReceive = false, canReadAccounting = false }: { result: InvoiceQueuePage; view?: InvoiceQueueView; page?: number; currency?: string; search?: string; scopeLabel: string; canReceive?: boolean; canReadAccounting?: boolean }) {
  const href = (view: InvoiceQueueView, page = 1) => { const q = new URLSearchParams({ view }); if (search) q.set("q", search); if (currency !== "USD") q.set("currency", currency); if (page > 1) q.set("page", String(page)); return `/app/invoices?${q}#invoice-register`; };
  const sourceHref = (r: InvoiceQueueRow) => view === "flags" ? `/app/invoices/${encodeURIComponent(r.invoiceId)}?section=flags&flag=${encodeURIComponent(r.id)}` : view === "exposure" ? `/app/invoices/${encodeURIComponent(r.invoiceId)}?section=matches&line=${encodeURIComponent(r.lineId!)}` : `/app/invoices/${encodeURIComponent(r.invoiceId)}`;
  const isSource = view === "flags" || view === "exposure", pages = Math.max(1, Math.ceil(result.totalCount / 25));
  return <div className={styles.page}>
    <header className={styles.header}><div><p className={styles.eyebrow}>Spend & planning</p><h1>Invoice review</h1><p>{scopeLabel}{search ? ` · Search: ${search}` : ""}</p></div><div className={styles.actions}>{canReadAccounting ? <Link href="/app/invoices/accounting">From accounting</Link> : null}{canReceive ? <Link className={styles.primary} href="/app/invoices/new">Receive invoice</Link> : null}</div></header>
    <div className={styles.metrics} aria-label="Invoice review measures">
      <Link href={href("all")} aria-current={view === "all" ? "page" : undefined}><span>Invoices in scope</span><strong>{result.counts.invoices}</strong><span>All invoices →</span></Link>
      <Link href={href("review")} aria-current={view === "review" ? "page" : undefined}><span>Needs review</span><strong>{result.counts.review}</strong><span>Invoices with open flags →</span></Link>
      <Link href={href("flags")} aria-current={view === "flags" ? "page" : undefined}><span>Open review flags</span><strong>{result.counts.flags}</strong><span>View flags →</span></Link>
      <Link href={href("exposure")} aria-current={view === "exposure" ? "page" : undefined}><span>Amounts flagged · {currency}</span><strong>{money(result.exposureAmount)}</strong><span>{result.counts.exposure} recorded {result.counts.exposure === 1 ? "entry" : "entries"} →</span></Link>
    </div>
    <form className={styles.search} action="/app/invoices"><input type="hidden" name="view" value={view} /><label>Search invoices<input name="q" defaultValue={search} placeholder="Invoice number or vendor" maxLength={160} /></label>{view === "exposure" ? <label>Amount currency<input name="currency" defaultValue={currency} minLength={3} maxLength={3} pattern="[A-Za-z]{3}" required /></label> : <input type="hidden" name="currency" value={currency} />}<button type="submit">Search</button>{search ? <Link href={`/app/invoices?view=${view}&currency=${currency}`}>Clear search</Link> : null}</form>
    {view === "exposure" ? <p className={styles.note}>Recorded amounts that were flagged, including past reviews. These are not confirmed savings or deductions.</p> : null}
    <section className={styles.surface} id="invoice-register"><header><h2>{titles[view]}</h2><span>{result.rows.length ? (page - 1) * 25 + 1 : 0}–{result.rows.length ? (page - 1) * 25 + result.rows.length : 0} of {result.totalCount}</span></header>
      {result.rows.length ? <div className={styles.tableWrap}><table><caption>{titles[view]}</caption><thead><tr><th>Invoice / vendor</th><th>{isSource ? "Review record" : "Status"}</th><th>{isSource ? "Flagged amount" : "Invoice total"}</th>{!isSource ? <><th>Approved amount</th><th>Recorded paid</th></> : null}</tr></thead><tbody>{result.rows.map(r => <tr key={r.id}>
        <td data-label="Invoice"><Link href={sourceHref(r)}>{r.number}</Link><span>{r.vendorId ? <Link href={`/app/vendors/${encodeURIComponent(r.vendorId)}`}>{r.vendorName}</Link> : "Vendor unavailable"}</span>{!isSource ? <span>{formatOperationsDate(r.date)}</span> : null}</td>
        <td data-label={isSource ? "Review record" : "Status"}>{isSource ? <><strong>{domainLabel(r.label!)}</strong><p>{r.detail}</p><span>{formatOperationsDate(r.date)}</span>{r.workId ? <Link href={`/app/work-orders/${encodeURIComponent(r.workId)}`}>Open work order</Link> : null}</> : <>{domainLabel(r.status)}{r.openFlags ? <span><Link href={`/app/invoices/${encodeURIComponent(r.invoiceId)}?section=flags&open=yes`}>{r.openFlags} open {r.openFlags === 1 ? "flag" : "flags"}</Link></span> : null}</>}</td>
        <td data-label={isSource ? "Flagged amount" : "Invoice total"}>{money(r.amount)}<span>{r.amount.currency}</span></td>{!isSource ? <><td data-label="Approved amount">{money(r.approved!)}</td><td data-label="Recorded paid">{money(r.paid!)}</td></> : null}
      </tr>)}</tbody></table></div> : <p className={styles.empty}>No {titles[view].toLowerCase()} in this view.{search ? " Try another invoice number or vendor." : ""}</p>}
    </section><nav className={styles.pagination} aria-label="Invoice pages">{page > 1 ? <Link href={href(view, page - 1)}>← Back</Link> : null}<span>Page {page} of {pages}</span>{result.nextOffset !== undefined ? <Link href={href(view, page + 1)}>Next →</Link> : null}</nav>
  </div>;
}
