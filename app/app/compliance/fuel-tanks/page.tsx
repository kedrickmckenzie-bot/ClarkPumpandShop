import type { Metadata } from "next";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { loadOperatorSession } from "@/app/app/_data/operator-loader";
import { RecordForm } from "@/components/ops/record-form";
import { SearchPicker } from "@/components/ops/search-picker";
import ComplianceWorkspace from "@/components/workspace/compliance-workspace";
import { ComplianceTabs } from "@/components/workspace/refrigerant-compliance";
import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import { formatOperationsDate } from "@/lib/ops/local-time";
import { UST_CLASS_LABELS, operatorGaps, type UstOperatorClass } from "@/lib/ops/ust";
import styles from "@/components/workspace/compliance.module.css";

export const metadata: Metadata = { title: "Fuel tank compliance" };
type Query = { view?: string; offset?: string; store?: string; notice?: string; error?: string; show?: string; q?: string; from?: string };
const PAGE = 25;

/** Underground fuel tanks: who the trained A/B/C operators are at each store, and every tank check. */
export default async function FuelTanksPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const session = await loadOperatorSession(), repository = await getServerOpsRepository();
  // Every store in scope, read a page at a time, so gaps are counted across the whole network.
  const loadStores = async () => {
    const all: Awaited<ReturnType<typeof repository.searchStores>>["items"] = [];
    for (let offset = 0; offset < 5_000; offset += 100) {
      const page = await repository.searchStores(session, "", { limit: 100, offset });
      all.push(...page.items);
      if (page.items.length < 100) break;
    }
    return all;
  };
  const [allStores, operators] = await Promise.all([loadStores(), repository.listUstOperators(session)]);
  const stores = { items: allStores };
  const today = new Date().toISOString().slice(0, 10);
  const gaps = operatorGaps(operators, today);
  const missingStores = stores.items.filter((store) => gaps.missing(store.id).length);
  const soon = new Set([...gaps.expired, ...gaps.expiringSoon].map((row) => row.storeId));
  const needsWork = stores.items.filter((store) => gaps.missing(store.id).length || soon.has(store.id));
  // Stores needing attention come first; "All stores" pages through the rest. Search by number or name.
  const show = query.show === "all" ? "all" : "gaps";
  const search = (query.q ?? "").trim().toLowerCase().slice(0, 60);
  const listed = (show === "all" ? stores.items : needsWork).filter((store) => !search || store.storeNumber.toLowerCase().includes(search) || store.name.toLowerCase().includes(search));
  const from = Math.min(Math.max(0, Math.floor(Number(query.from) || 0)), Math.max(0, listed.length - 1));
  const shown = listed.slice(from, from + PAGE);
  const listHref = (values: Record<string, string | undefined>) => `/app/compliance/fuel-tanks?${new URLSearchParams(Object.entries({ show, q: search || undefined, ...values }).filter((entry): entry is [string, string] => Boolean(entry[1])))}#operators`;
  const edit = ["facilities", "regional"].includes(session.role);
  const fmt = (day: string) => formatOperationsDate(`${day}T12:00:00Z`, "UTC");
  return (
    <div className={styles.page}>
      <header className={styles.header}><div><h1>Compliance</h1><p>Underground fuel tanks (EPA UST rule). Your state may add its own rules.</p><small>{session.scopeLabel}</small></div></header>
      <ComplianceTabs active="fuel-tanks" />
      {query.notice ? <p role="status" className={styles.notice}>{query.notice}</p> : null}
      {query.error ? <p role="alert" className={styles.notice}>{query.error}</p> : null}
      <div className={styles.metrics}>
        <a className={styles.metric} href="#operators">Stores missing an operator<strong>{missingStores.length}</strong></a>
        <a className={styles.metric} href="#operators">Operator training expired<strong>{gaps.expired.length}</strong></a>
        <a className={styles.metric} href="#operators">Expiring in 60 days<strong>{gaps.expiringSoon.length}</strong></a>
      </div>
      <section className={styles.panel} id="operators" aria-labelledby="operators-title">
        <h2 id="operators-title">Trained tank operators</h2>
        <p>Each store needs a Class A, B and C operator. Class C is usually the store staff who respond to alarms and spills.</p>
        <form className={styles.filters} action="/app/compliance/fuel-tanks#operators" method="get">
          <nav className={styles.filters} aria-label="Which stores">
            <a href={listHref({ show: "gaps", from: undefined })} aria-current={show === "gaps" ? "page" : undefined}>Needs attention · {needsWork.length}</a>
            <a href={listHref({ show: "all", from: undefined })} aria-current={show === "all" ? "page" : undefined}>All stores · {stores.items.length}</a>
          </nav>
          <input type="hidden" name="show" value={show} />
          <label>Find a store<input name="q" defaultValue={search} placeholder="Store number or name" /></label>
          <button type="submit">Find</button>
        </form>
        <div className={styles.scroll}>
          <table className={`${styles.table} ${styles.operatingTable}`}>
            <thead><tr><th>Store</th>{(["A", "B", "C"] as const).map((operatorClass) => <th key={operatorClass}>{UST_CLASS_LABELS[operatorClass]}</th>)}</tr></thead>
            <tbody>{shown.length ? null : <tr><td colSpan={4}>{show === "gaps" && !search ? "Every store has a trained A, B and C operator." : "No stores match."}</td></tr>}{shown.map((store) => (
              <tr key={store.id}>
                <td data-label="Store"><Link href={`/app/stores/${encodeURIComponent(store.id)}`}>Store {store.storeNumber}</Link><p><small>{store.name}</small></p></td>
                {(["A", "B", "C"] as UstOperatorClass[]).map((operatorClass) => {
                  const people = operators.filter((row) => row.storeId === store.id && row.operatorClass === operatorClass);
                  return <td key={operatorClass} data-label={`Class ${operatorClass}`}>
                    {people.length ? people.map((person) => {
                      const expired = person.expiresOn && person.expiresOn < today;
                      return <div key={person.id}>
                        <strong>{person.name}</strong>
                        {person.expiresOn ? <p><small className={expired ? styles.danger : undefined}>{expired ? "Training expired" : "Training expires"} {fmt(person.expiresOn)}</small></p> : null}
                        {edit ? <RecordForm action="/api/ops/ust-operators" offerSavedWork={false}><input type="hidden" name="action" value="remove" /><input type="hidden" name="operatorId" value={person.id} /><button type="submit" className={styles.textButton}>Remove</button></RecordForm> : null}
                      </div>;
                    }) : <span className={`${styles.tag} ${styles.danger}`}>Missing</span>}
                  </td>;
                })}
              </tr>
            ))}</tbody>
          </table>
        </div>
        {listed.length > PAGE ? (
          <nav className={styles.bar} aria-label="Pages">
            {from > 0 ? <a href={listHref({ from: String(Math.max(0, from - PAGE)) })}>Previous</a> : <span />}
            <span>{from + 1}–{from + shown.length} of {listed.length}</span>
            {from + PAGE < listed.length ? <a href={listHref({ from: String(from + PAGE) })}>Next</a> : <span />}
          </nav>
        ) : null}
        {edit ? (
          <details>
            <summary>Add a tank operator</summary>
            <RecordForm action="/api/ops/ust-operators" offerSavedWork={false} className={styles.form}>
              <input type="hidden" name="action" value="add" />
              <input type="hidden" name="key" value={randomUUID()} />
              <div className={styles.pair}>
                <SearchPicker name="storeId" label="Store" required placeholder="Type a store number or name" options={stores.items.map((store) => ({ value: store.id, label: `Store ${store.storeNumber} · ${store.name}` }))} />
                <label>Class<select name="operatorClass" required defaultValue="C">{(["A", "B", "C"] as const).map((operatorClass) => <option key={operatorClass} value={operatorClass}>{UST_CLASS_LABELS[operatorClass]}</option>)}</select></label>
              </div>
              <div className={styles.pair}>
                <label>Name<input name="name" required maxLength={120} /></label>
                <label>Certificate # <small>optional</small><input name="certificateNumber" maxLength={60} /></label>
              </div>
              <div className={styles.pair}>
                <label>Trained on <small>optional</small><input type="date" name="trainedOn" /></label>
                <label>Training expires <small>optional; some states require retraining</small><input type="date" name="expiresOn" /></label>
              </div>
              <button type="submit">Save operator</button>
            </RecordForm>
          </details>
        ) : null}
      </section>
      <ComplianceWorkspace searchParams={Promise.resolve({ ...query, notice: undefined, error: undefined })} program="ust" />
      <p className={styles.muted}>The app keeps records and reminders. It doesn&apos;t replace your tank monitor or file anything with your state.</p>
    </div>
  );
}
