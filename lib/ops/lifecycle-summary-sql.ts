import type { OrganizationScope } from "./repository";
import type { OpsSqlDriver, SqlRow } from "./sql-driver";
import type { Asset, AssetReplacementOverride, LifecycleRecommendation, ReplacementBenchmark, ReplacementEvent, ReplacementProfile, WorkOrder } from "./types";
import { scopeWhere } from "./sql-scope";
import { createLifecycleSummary, equipmentHistoryStart } from "./lifecycle-summary";

export interface LifecycleRecordReaders {
  asset(row: SqlRow): Asset; work(row: SqlRow): WorkOrder;
  profile(row: SqlRow): ReplacementProfile; benchmark(row: SqlRow): ReplacementBenchmark;
  override(row: SqlRow): AssetReplacementOverride; decision(row: SqlRow): LifecycleRecommendation;
  event(row: SqlRow): ReplacementEvent;
}

/** Reads current inputs in 100-asset batches; never returns work, price or decision histories. */
export async function queryDashboardLifecycle(driver: OpsSqlDriver, scope: OrganizationScope, asOf: string, readers: LifecycleRecordReaders) {
  const summary = createLifecycleSummary(asOf);
  const binary = driver.dialect === "postgres" ? 'COLLATE "C"' : "COLLATE BINARY";
  let cursor: string | undefined;
  for (;;) {
    const params: unknown[] = [];
    const where = scopeWhere(scope, "s", params);
    if (cursor) params.push(cursor);
    const page = await driver.query({ sql: `SELECT a.* FROM ops_assets a JOIN ops_stores s ON s.organization_id=a.organization_id AND s.id=a.store_id WHERE ${where} ${cursor ? `AND a.id ${binary}>?` : ""} ORDER BY a.id ${binary} LIMIT 101`, params });
    const assets = page.rows.slice(0, 100).map(readers.asset);
    if (!assets.length) break;
    const ids = assets.map(asset => asset.id);
    const batchParams = [scope.organizationId, ...ids];
    const batch = `WITH batch AS (SELECT a.* FROM ops_assets a WHERE a.organization_id=? AND a.id IN (${ids.map(() => "?").join(",")}))`;
    const latest = (table: string, alias: string, predicate: string, order: string) => `(SELECT ${alias}.id FROM ${table} ${alias} WHERE ${alias}.organization_id=a.organization_id AND ${predicate} ORDER BY ${order},${alias}.id ${binary} DESC LIMIT 1)`;
    const [work, profiles, benchmarks, overrides, costs] = await Promise.all([
      driver.query({ sql: `${batch} SELECT w.*,a.id AS selected_asset_id FROM batch a JOIN ops_work_orders w ON w.organization_id=a.organization_id AND w.id=${latest("ops_work_orders", "x", "x.asset_id=a.id AND x.store_id=a.store_id AND x.priority<>'planned' AND x.status NOT IN ('closed','cancelled','completed_pending_review','resolved') AND x.repair_estimate_amount_minor IS NOT NULL", "x.created_at DESC")}`, params: batchParams }),
      driver.query({ sql: `${batch} SELECT p.*,a.id AS selected_asset_id FROM batch a JOIN ops_replacement_profiles p ON p.organization_id=a.organization_id AND p.id=a.replacement_profile_id AND p.active=?`, params: [...batchParams, driver.dialect === "postgres" ? true : 1] }),
      driver.query({ sql: `${batch} SELECT b.*,a.id AS selected_asset_id FROM batch a JOIN ops_replacement_benchmarks b ON b.organization_id=a.organization_id AND b.id=${latest("ops_replacement_benchmarks", "x", "x.profile_id=a.replacement_profile_id AND x.status='published'", "x.effective_at DESC,x.created_at DESC")}`, params: batchParams }),
      driver.query({ sql: `${batch} SELECT o.*,a.id AS selected_asset_id FROM batch a JOIN ops_asset_replacement_overrides o ON o.organization_id=a.organization_id AND o.id=${latest("ops_asset_replacement_overrides", "x", "x.asset_id=a.id AND x.status='active'", "x.effective_at DESC,x.created_at DESC")}`, params: batchParams }),
      driver.query({ sql: `${batch} SELECT a.id AS selected_asset_id,SUM(c.amount_minor) AS amount_minor FROM batch a JOIN ops_work_orders w ON w.organization_id=a.organization_id AND w.store_id=a.store_id AND w.asset_id=a.id JOIN ops_cost_lines c ON c.organization_id=w.organization_id AND c.work_order_id=w.id WHERE c.currency='USD' GROUP BY a.id`, params: batchParams }),
    ]);
    const keyed = (rows: SqlRow[]) => new Map(rows.map(row => [String(row.selected_asset_id), row]));
    const w = keyed(work.rows), p = keyed(profiles.rows), b = keyed(benchmarks.rows), o = keyed(overrides.rows), c = keyed(costs.rows);
    for (const asset of assets) summary.add({ asset, work: w.has(asset.id) ? readers.work(w.get(asset.id)!) : undefined, profile: p.has(asset.id) ? readers.profile(p.get(asset.id)!) : undefined, benchmark: b.has(asset.id) ? readers.benchmark(b.get(asset.id)!) : undefined, override: o.has(asset.id) ? readers.override(o.get(asset.id)!) : undefined, recordedCostMinor: Number(c.get(asset.id)?.amount_minor ?? 0) });
    if (page.rows.length <= 100) break;
    cursor = assets.at(-1)!.id;
  }
  const candidate = summary.candidate;
  if (!candidate?.input.work) return summary.finish();
  const { asset, work } = candidate.input;
  const params: unknown[] = [];
  const where = scopeWhere(scope, "s", params);
  params.push(asset.id, work!.id);
  const source = `WITH candidate AS (SELECT a.id AS asset_id,a.organization_id,a.store_id,w.id AS work_id FROM ops_assets a JOIN ops_stores s ON s.organization_id=a.organization_id AND s.id=a.store_id JOIN ops_work_orders w ON w.organization_id=a.organization_id AND w.asset_id=a.id AND w.store_id=a.store_id WHERE ${where} AND a.id=? AND w.id=?)`;
  const eventSource = "FROM candidate c JOIN ops_replacement_events e ON e.organization_id=c.organization_id AND e.asset_id=c.asset_id AND e.work_order_id=c.work_id WHERE e.status<>'cancelled'";
  const [decisions, decisionEvents, priceEvents, selected, reported, costs] = await Promise.all([
    driver.query({ sql: `${source} SELECT d.* FROM candidate c JOIN ops_lifecycle_recommendations d ON d.organization_id=c.organization_id AND d.asset_id=c.asset_id ORDER BY d.version DESC,d.decided_at DESC,d.id ${binary} DESC LIMIT 1`, params }),
    driver.query({ sql: `${source} SELECT e.* ${eventSource} ORDER BY CASE WHEN e.status='completed' THEN 0 ELSE 1 END,e.approved_at DESC,e.id ${binary} DESC LIMIT 1`, params }),
    driver.query({ sql: `${source} SELECT e.* ${eventSource} ORDER BY e.approved_at DESC,e.id ${binary} DESC LIMIT 1`, params }),
    driver.query({ sql: `${source} SELECT p.amount_minor,p.currency FROM candidate c JOIN ops_work_order_estimate_requests r ON r.organization_id=c.organization_id AND r.work_order_id=c.work_id JOIN ops_vendor_estimate_proposals p ON p.organization_id=r.organization_id AND p.request_id=r.id AND p.work_order_id=c.work_id AND p.vendor_id=r.vendor_id WHERE r.decision_kind='replacement_quote' AND r.status='selected' ORDER BY p.revision DESC,p.submitted_at DESC,p.id ${binary} DESC LIMIT 1`, params }),
    driver.query({ sql: `${source} SELECT p.amount_minor,p.currency FROM candidate c JOIN ops_work_prices p ON p.organization_id=c.organization_id AND p.work_order_id=c.work_id WHERE p.kind='replace' AND p.scope_kind='whole' ORDER BY p.recorded_at DESC,p.id ${binary} DESC LIMIT 1`, params }),
    driver.query({ sql: `${source} SELECT l.currency,SUM(l.amount_minor) AS amount_minor FROM candidate c JOIN ops_work_orders w ON w.organization_id=c.organization_id AND w.store_id=c.store_id AND w.asset_id=c.asset_id JOIN ops_cost_lines l ON l.organization_id=w.organization_id AND l.work_order_id=w.id WHERE substr(CAST(l.service_date AS TEXT),1,10)>=? AND substr(CAST(l.service_date AS TEXT),1,10)<=? GROUP BY l.currency ORDER BY l.currency`, params: [...params, equipmentHistoryStart(asOf), asOf.slice(0, 10)] }),
  ]);
  const money = (row: SqlRow) => ({ amountMinor: Number(row.amount_minor), currency: String(row.currency) });
  return summary.finish({ decision: decisions.rows[0] ? readers.decision(decisions.rows[0]) : undefined, decisionEvent: decisionEvents.rows[0] ? readers.event(decisionEvents.rows[0]) : undefined, priceEvent: priceEvents.rows[0] ? readers.event(priceEvents.rows[0]) : undefined, selectedPrice: selected.rows[0] ? money(selected.rows[0]) : undefined, reportedPrice: reported.rows[0] ? money(reported.rows[0]) : undefined, recordedCosts: costs.rows.map(money) });
}
