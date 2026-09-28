import Link from "next/link";
import { storeWorkspaceContext } from "@/lib/server/store-workspace-context";
import styles from "./compliance.module.css";

export async function StoreOperatingContext({ id }: { id: string }) {
  const { session, repository } = await storeWorkspaceContext(id);
  const scope = { ...session, storeIds: [id] }, today = new Date().toISOString().slice(0, 10);
  const [inspections, warranties, vendors] = await Promise.all([
    repository.queryInspections(scope, { today, storeId: id, limit: 3 }),
    repository.listWarrantyDirectory(scope, { today, view: "active", limit: 3 }),
    repository.queryStoreVendors(scope, id, {}),
  ]);
  const base = `/app/stores/${encodeURIComponent(id)}`;
  return <section className={styles.panel} aria-labelledby="store-coverage-title">
    <h2 id="store-coverage-title">Compliance & coverage</h2>
    <dl className={styles.facts}>
      <div><dt>Compliance</dt><dd><Link href={`${base}/compliance?view=overdue`}>{inspections.summary.overdue} overdue</Link> · <Link href={`${base}/compliance?view=performed`}>{inspections.summary.performed} awaiting review</Link><p><Link href={`${base}/compliance?view=action_needed`}>{inspections.summary.action_needed} findings</Link></p></dd></div>
      <div><dt>Active warranties</dt><dd><Link href={`${base}/warranties?tab=coverage&view=active`}>{warranties.totalCount} active terms</Link>{warranties.items.map(w => <p key={w.id}><Link href={`/app/warranties/coverage/${w.id}`}>{w.assetName} · {w.component ?? "Whole equipment"} · {w.title}</Link></p>)}</dd></div>
      <div><dt>Vendors for this store</dt><dd><Link href={`${base}/vendors`}>View coverage & preferences</Link>{vendors.items.filter(v => v.covered).slice(0, 3).map(v => <p key={v.id}><Link href={`/app/vendors/${v.id}`}>{v.name}</Link>{v.preferenceKeys.length ? " · Preferred here" : ""}</p>)}</dd></div>
    </dl>
  </section>;
}
