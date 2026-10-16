import Link from "next/link";
import { randomUUID } from "node:crypto";
import { OpsDomainError } from "@/lib/ops/errors";
import { civilDate } from "@/lib/ops/dispatch-calendar";
import { underWarranty } from "@/lib/ops/found-problem";
import { formatOperationsDate } from "@/lib/ops/local-time";
import { getOpsRequestContext } from "@/lib/server/ops-request-context";
import { internalDispatchScope } from "@/lib/server/internal-dispatch-context";
import { RecordForm } from "@/components/ops/record-form";
import styles from "@/components/workspace/internal-dispatch.module.css";

export const metadata = { title: "Found another problem" };
type Query = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.slice(0, 160);

/** A technician reports a problem found on site: pick the store, optionally the equipment, say what's wrong, then fix it or send it on. */
async function renderFound(query: Query) {
  const { repository, session } = await getOpsRequestContext(["technician"], "report_found_problem");
  const scope = await internalDispatchScope(repository, session);
  const organization = await repository.getOrganization(scope.organizationId);
  const today = civilDate(new Date().toISOString(), organization?.timeZone ?? "America/New_York");
  const storeId = one(query.store), assetId = one(query.asset), from = one(query.from);
  const back = from?.startsWith("/app/") ? from : "/app/my-work";
  const store = storeId ? await repository.getStoreDetail(scope, storeId) : null;

  if (!store) {
    // Step 1: which store. Searchable, 25 at a time, only stores this tech covers.
    const q = (one(query.q) ?? "").trim();
    const stores = await repository.searchStores(scope, q, { limit: 25 });
    return <div className={styles.workspace}>
      <header className={styles.jobHeader}><Link href={back}>← Back</Link><h1>Found another problem</h1><p>Which store?</p></header>
      <section className={styles.jobBody}>
        <form method="get" className={styles.form}><label>Store<input name="q" defaultValue={q} placeholder="Number, name, address or town" /></label>{from ? <input type="hidden" name="from" value={from} /> : null}<button className={`${styles.btn} ${styles.btnSecondary}`} type="submit">Search</button></form>
        {stores.items.length ? <ul className={styles.historyList}>{stores.items.map(s => <li key={s.id}><Link href={`/app/my-work/found?${new URLSearchParams({ store: s.id, ...(from ? { from } : {}) })}`}>Store {s.storeNumber} · {s.name}</Link><p>{s.formattedAddress}</p></li>)}</ul> : <p>No stores match. Try fewer letters.</p>}
      </section>
    </div>;
  }

  const assets = (await repository.listAssetsForStore(scope.organizationId, store.id)).filter(a => a.status !== "retired").sort((a, b) => a.name.localeCompare(b.name));
  const asset = assetId ? assets.find(a => a.id === assetId) : undefined;
  const warranty = asset ? await underWarranty({ repository }, scope.organizationId, store.id, asset.id, today) : undefined;
  const here = (changes: Record<string, string | undefined>) => `/app/my-work/found?${new URLSearchParams(Object.entries({ store: store.id, asset: asset?.id, from, ...changes }).filter((e): e is [string, string] => Boolean(e[1])))}`;
  return <div className={styles.workspace}>
    <header className={styles.jobHeader}><Link href={back}>← Back</Link><h1>Found another problem</h1><p>Store {store.storeNumber} · {store.name} · <Link href={`/app/my-work/found${from ? `?${new URLSearchParams({ from })}` : ""}`}>Change store</Link></p></header>
    <section className={styles.jobBody}>
      <h2 className={styles.subHeading}>Equipment <small className={styles.muted}>optional</small></h2>
      {asset ? <p><strong>{asset.name}</strong> · {asset.assetTag} · <Link href={here({ asset: undefined })}>Change</Link></p>
        : assets.length ? <details><summary className={`${styles.btn} ${styles.btnSecondary}`}>Pick the equipment</summary><ul className={styles.historyList}>{assets.map(a => <li key={a.id}><Link href={here({ asset: a.id })}>{a.name}</Link><p>{a.assetTag}</p></li>)}</ul></details>
        : <p className={styles.muted}>No equipment is listed at this store.</p>}
      {warranty ? <p className={styles.urgent} role="alert"><strong>Under warranty</strong> with {warranty.provider} until {formatOperationsDate(warranty.end)}. Don&apos;t repair it yourself. Send it to your manager.</p> : null}
      <RecordForm action="/api/ops/work-orders/found" offerSavedWork={false} className={styles.form} attachmentLimit={{ files: 5, bytes: 8 * 1024 * 1024 }}>
        <input type="hidden" name="storeId" value={store.id} />
        {asset ? <input type="hidden" name="assetId" value={asset.id} /> : null}
        <input type="hidden" name="submissionKey" value={randomUUID()} />
        <label>What&apos;s wrong?<textarea name="problem" required minLength={3} maxLength={500} placeholder="For example: ice machine is leaking onto the floor" /></label>
        <label>Photos <small className={styles.muted}>optional</small><input type="file" name="attachments" multiple accept="image/jpeg,image/png,image/webp" /></label>
        <div className={styles.jobActions}>
          {warranty ? null : <button className={`${styles.btn} ${styles.btnPrimary}`} type="submit" name="choice" value="fix_now">I&apos;ll fix it now</button>}
          <button className={`${styles.btn} ${warranty ? styles.btnPrimary : styles.btnSecondary}`} type="submit" name="choice" value="send">Send to my manager</button>
        </div>
      </RecordForm>
    </section>
  </div>;
}

export default async function FoundProblemPage({ searchParams }: { searchParams: Promise<Query> }) {
  try { return await renderFound(await searchParams); } catch (error) {
    if (!(error instanceof OpsDomainError) || error.code !== "FORBIDDEN") throw error;
    return <section><h1>Not available</h1><p>Only technicians can report a problem from here.</p><Link href="/app/my-work">← My work</Link></section>;
  }
}
