import Link from "next/link";
import type { loadInvoiceIntake } from "@/app/app/_data/invoice-intake-loader";
import { InvoiceIntakeForm } from "./invoice-intake-form";
import styles from "./invoice-intake-workspace.module.css";
type Model = Awaited<ReturnType<typeof loadInvoiceIntake>>;
export function InvoiceIntakeWorkspace(m: Model) {
  const href = (changes: Record<string, string | undefined>) => { const values = { work: m.work?.id, vendor: m.vendor?.id, agreement: m.agreement?.id, ...changes }; return `/app/invoices/new?${new URLSearchParams(Object.entries(values).filter((p): p is [string, string] => Boolean(p[1])))}`; };
  const title = m.kind === "work" ? "Choose the work order" : m.kind === "vendor" ? "Choose the invoice vendor" : m.kind === "agreement" ? "Choose an agreement" : "Invoice details";
  return <div className={styles.page}><header className={styles.header}><div><p>Invoice review</p><h1>Receive invoice</h1><p>{m.scopeLabel}</p></div><Link href="/app/invoices">Cancel</Link></header>
    {m.work ? <div className={styles.selection}><div><strong>{m.work.number} · Store {m.work.storeNumber}</strong><p>{m.work.problem}</p></div><Link href="/app/invoices/new">Change work</Link></div> : null}
    {m.vendor && m.kind !== "vendor" ? <div className={styles.selection}><strong>{m.vendor.name}</strong><Link href={href({ choose: "vendor", agreement: undefined })}>Change vendor</Link></div> : null}
    <section className={styles.surface}><h2>{title}</h2>
    {m.options && m.kind ? <><form className={styles.search} action="/app/invoices/new">{Object.entries({ work: m.work?.id, vendor: m.vendor?.id, choose: m.kind }).filter(([, v]) => v).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}<label>Search {m.kind === "work" ? "work orders" : m.kind === "vendor" ? "vendors" : "agreements"}<input name="q" defaultValue={m.search} placeholder={m.kind === "work" ? "Work order number, store or problem" : "Name or reference"} maxLength={160} /></label><button type="submit">Search</button></form>
      {m.kind === "agreement" ? <p><Link href={href({ agreement: undefined })}>Continue without an agreement</Link></p> : null}
      <ul className={styles.options}>{m.options.items.map(r => <li key={r.id}><Link href={m.kind === "work" ? href({ work: r.id, vendor: undefined, agreement: undefined }) : m.kind === "vendor" ? href({ vendor: r.id, agreement: undefined }) : href({ agreement: r.id })}><strong>{r.label}</strong><span>{r.detail}</span><span className={styles.choose}>Select →</span></Link></li>)}</ul>
      {!m.options.items.length ? <p>No matching {m.kind === "work" ? "work orders" : m.kind === "vendor" ? "vendors" : "agreements"}. {m.search ? "Try a shorter search." : ""}</p> : null}
      <nav className={styles.pagination} aria-label="Selection pages">{m.page > 1 ? <Link href={href({ choose: m.kind, q: m.search, page: String(m.page - 1) })}>← Back</Link> : null}<span>{m.options.items.length ? (m.page - 1) * 25 + 1 : 0}–{m.options.items.length ? (m.page - 1) * 25 + m.options.items.length : 0} of {m.options.totalCount}</span>{m.options.nextOffset !== undefined ? <Link href={href({ choose: m.kind, q: m.search, page: String(m.page + 1) })}>Next →</Link> : null}</nav>
    </> : m.work && m.vendor ? <><p className={styles.agreement}>{m.agreement?.label ?? "No agreement selected"} · <Link href={href({ choose: "agreement" })}>{m.agreement ? "Change" : "Add agreement (optional)"}</Link></p><InvoiceIntakeForm workOrderId={m.work.id} vendorId={m.vendor.id} contractVersionId={m.agreement?.id} /></> : null}
    </section></div>;
}
