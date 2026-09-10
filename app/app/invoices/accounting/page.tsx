import { notFound } from "next/navigation";
import { loadOperatorSession } from "../../_data/operator-loader";
import { OpsDomainError } from "@/lib/ops/commands";
import { AccountingDemoControl } from "@/components/ops/accounting-demo-control";
import Link from "next/link";
import { getOpsRequestContext } from "@/lib/server/ops-request-context";
import { accountingPayload, accountingSourceIdentity, requireAccountingAccess } from "@/lib/ops/accounting-import";
import { AccountingImportReview } from "@/components/ops/accounting-import-review";
import layout from "@/components/ops/accounting-workspace.module.css";
import styles from "@/components/ops/ops.module.css";

export default async function AccountingImportPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await loadOperatorSession();
  if (!["executive", "facilities", "finance"].includes(session.role)) notFound();
  const context = await getOpsRequestContext(["executive", "facilities", "finance"]);
  try { await requireAccountingAccess(context.repository, context.actor); } catch (error) { if (error instanceof OpsDomainError && error.code === "FORBIDDEN") notFound(); throw error; }
  const params = await searchParams;
  const organizationId = context.session.organizationId;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const sources = await context.repository.listAccountingInvoiceSources(organizationId, 26, (page - 1) * 25);
  const source = params.source ? await context.repository.getAccountingInvoiceSource(organizationId, params.source) : undefined;
  const history = source ? await context.repository.listAccountingInvoiceHistory(organizationId, source.id) : [];
  const sourcePayload = source ? accountingPayload(source) : undefined;
  const delivery = sourcePayload ? { ...sourcePayload.delivery, vendorId: sourcePayload.reviewedVendorId ?? sourcePayload.delivery.vendorId } : undefined;
  const scope = { organizationId };
  const [vendors, work] = await Promise.all([context.repository.listVendors(scope, undefined, { limit: 100 }), context.repository.listWorkOrders(scope, { search: params.q || delivery?.lines.find((line) => line.workOrderNumber)?.workOrderNumber || undefined, limit: 50 })]);
  const original = source && delivery?.kind === "credit" ? await context.repository.getAccountingInvoiceSource(organizationId, await accountingSourceIdentity(organizationId, source.connectionKey, source.companyKey, delivery.relatedExternalInvoiceId!)) : undefined;
  const originalInvoice = original?.invoiceId ? await context.repository.getInvoice(organizationId, original.invoiceId) : undefined;
  const invoices = originalInvoice ? [originalInvoice] : delivery?.vendorId ? await context.repository.findInvoicesByVendorReference(organizationId, delivery.vendorId, delivery.invoiceNumber) : [];
  const money = (amount: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount / 100);
  const state = { needs_review: "Needs a match or updated review", matched: "Linked to platform invoice", excluded: "Outside maintenance filter" };
  return <div className={layout.page}>
    <header><Link href="/app/invoices">Back to invoices</Link><h1>Invoices from accounting</h1><p>Review incoming maintenance invoices and link them to the work they cover.</p></header>
    {params.saved ? <p role="status" className={styles.controlSuccess}>{params.saved === "replayed" ? "This source version was already imported. No duplicate was created." : params.saved === "reviewed" ? "Invoice match saved." : "Accounting update imported."}</p> : null}
    <details className={styles.controlDisclosure}><summary>Demo import and connection details</summary><p>This test adapter uses fictional accounting records. No accounting system is connected. Selecting a customer’s accounting product is still required.</p>
      <AccountingDemoControl />
      <p>Run the numbered updates in order. Older source versions are rejected. Imported amounts and payment status come from accounting; repair confirmation stays separate.</p>
    </details>
    <section><h2>Recent accounting updates</h2>{sources.length ? <div className={layout.tableScroll}><table><caption>Maintenance invoice intake · latest version of each accounting record</caption><thead><tr><th>Invoice</th><th>Company</th><th>Amount</th><th>Review</th><th>Last updated from accounting</th></tr></thead><tbody>{sources.slice(0, 25).map((item) => { const record = accountingPayload(item).delivery; return <tr key={item.id}><td><Link href={`/app/invoices/accounting?source=${encodeURIComponent(item.id)}`}>{record.invoiceNumber}</Link>{record.kind === "credit" ? " · Credit" : ""}</td><td>{item.companyKey === "fictional-retail-company" ? "Fictional retail company" : item.companyKey}</td><td>{money(record.totalMinor, record.currency)}</td><td>{state[item.matchState]}</td><td>{new Date(accountingPayload(item).importedAt ?? item.updatedAt).toLocaleString("en-US")}</td></tr>; })}</tbody></table></div> : <p>No accounting invoices have arrived. Open the demo import to try the review journey.</p>}
      {page > 1 ? <Link href={`/app/invoices/accounting?page=${page - 1}`}>Previous updates</Link> : null}{sources.length > 25 ? <Link href={`/app/invoices/accounting?page=${page + 1}`}>More updates</Link> : null}
    </section>
    {source && delivery ? <section><h2>{delivery.invoiceNumber}</h2><p>{state[source.matchState]} · Source version {source.sourceRevision} · {delivery.voided ? "Voided in accounting" : delivery.paidMinor ? `${money(delivery.paidMinor, delivery.currency)} recorded as paid` : "No payment recorded"}</p>
      {source.invoiceId ? <p><Link href={`/app/invoices/${source.invoiceId}`}>Open the linked invoice and service evidence</Link></p> : null}
      {delivery.documentUrl ? <p><a href={delivery.documentUrl} rel="noreferrer">Open the original accounting document</a></p> : <p>No original document was supplied by the adapter.</p>}
      {accountingPayload(source).previousReview ? <p>Last review: {accountingPayload(source).previousReview!.actor} · {accountingPayload(source).previousReview!.reason}</p> : null}
      <details><summary>Accounting and review history ({history.length})</summary><ol>{history.map((event) => { const recorded = JSON.parse(event.payloadJson) as { after: import("@/lib/ops/types").AccountingInvoiceSource }; const previous = accountingPayload(recorded.after); return <li key={event.id}><strong>{event.eventType === "accounting.invoice_imported" ? "Accounting update" : "Review saved"} · version {recorded.after.sourceRevision}</strong><p>{money(previous.delivery.totalMinor, previous.delivery.currency)} · {previous.delivery.voided ? "Voided" : `${money(previous.delivery.paidMinor, previous.delivery.currency)} paid`} · {event.actorName}</p>{previous.previousReview ? <p>{previous.previousReview.reason}</p> : null}</li>; })}</ol></details>
      {source.matchState !== "excluded" ? <><form method="get" className={styles.controlForm}><input type="hidden" name="source" value={source.id} /><label className={styles.field}>Find work by store, work order, or problem<input name="q" defaultValue={params.q ?? ""} /></label><button className={styles.secondaryButton}>Find related work</button></form><p>Choose the matching work below. Search narrows the list; matches are never selected automatically.</p><details open={source.matchState === "needs_review"}><summary>{source.matchState === "matched" ? "Change linked work" : "Review and match this invoice"}</summary><AccountingImportReview key={`${source.id}:${source.version}:${params.q}`} sourceId={source.id} version={source.version} linkedInvoiceId={source.invoiceId} delivery={delivery} vendors={vendors.items} work={work.items} invoices={invoices} /></details></> : <p>This record is excluded from facilities invoice review and spending totals.</p>}
    </section> : null}
  </div>;
}
