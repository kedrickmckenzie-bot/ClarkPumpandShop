import type { OrganizationScope } from "./repository";
import type { OpsSqlDriver } from "./sql-driver";
import { scopeWhere } from "./sql-scope";
import { dashboardPageBounds, validateDashboardWindow, type DashboardWindow } from "./dashboard-query";
import type { EquipmentIssuePage, EquipmentIssueQuery } from "./equipment-issues";

/** Aggregate before joining costs; both the work count and cost coverage stay distinct. */
export async function queryEquipmentIssues(driver: OpsSqlDriver, scope: OrganizationScope, window: DashboardWindow, query: EquipmentIssueQuery = {}): Promise<EquipmentIssuePage> {
  validateDashboardWindow(window);
  const params: unknown[] = [];
  const scoped = scopeWhere(scope, "s", params);
  const { limit, offset } = dashboardPageBounds(query);
  params.push(window.costFrom, window.costTo, window.costFrom, window.costTo, window.currency, Math.max(1, Math.floor(query.minIssueCount ?? 1)), limit, offset);
  const result = await driver.query({ sql: `WITH issues AS (
    SELECT w.id, w.organization_id, a.id AS asset_id, a.name, a.asset_tag, s.id AS store_id, s.store_number, s.name AS store_name, w.created_at
    FROM ops_stores s JOIN ops_work_orders w ON w.organization_id=s.organization_id AND w.store_id=s.id
    JOIN ops_assets a ON a.organization_id=w.organization_id AND a.id=w.asset_id AND a.store_id=s.id
    WHERE ${scoped} AND w.status <> 'cancelled' AND w.priority <> 'planned'
      AND substr(CAST(w.created_at AS TEXT),1,10) >= ? AND substr(CAST(w.created_at AS TEXT),1,10) <= ?
      AND NOT EXISTS (SELECT 1 FROM ops_pm_occurrences p WHERE p.organization_id=w.organization_id AND p.work_order_id=w.id)
    ), costs AS (
      SELECT c.work_order_id, SUM(c.amount_minor) AS amount FROM ops_cost_lines c
      JOIN issues i ON i.organization_id=c.organization_id AND i.id=c.work_order_id
      WHERE substr(CAST(c.service_date AS TEXT),1,10) >= ? AND substr(CAST(c.service_date AS TEXT),1,10) <= ? AND c.currency=? GROUP BY c.work_order_id
    ), ranked AS (
      SELECT i.asset_id, i.name, i.asset_tag, i.store_id, i.store_number, i.store_name,
      COUNT(*) AS issue_count, MAX(i.created_at) AS latest_issue, COALESCE(SUM(c.amount),0) AS recorded_cost_minor, COUNT(c.work_order_id) AS cost_work_count
      FROM issues i LEFT JOIN costs c ON c.work_order_id=i.id
      GROUP BY i.asset_id,i.name,i.asset_tag,i.store_id,i.store_number,i.store_name
      HAVING COUNT(*) >= ?
    ), totals AS (SELECT COUNT(*) AS total_count FROM ranked),
    visible AS (SELECT * FROM ranked ORDER BY issue_count DESC, asset_id ASC LIMIT ? OFFSET ?)
    SELECT visible.*, totals.total_count FROM totals LEFT JOIN visible ON 1=1 ORDER BY visible.issue_count DESC, visible.asset_id ASC`, params });
  return { totalCount: Number(result.rows[0]?.total_count ?? 0), items: result.rows.filter(r => r.asset_id != null).map(r => ({
    id: String(r.asset_id), name: String(r.name), assetTag: String(r.asset_tag), storeId: String(r.store_id), storeLabel: `Store ${r.store_number} · ${r.store_name}`,
    issueCount: Number(r.issue_count), latestIssue: new Date(r.latest_issue instanceof Date ? r.latest_issue.getTime() : String(r.latest_issue)).toISOString(), recordedCostMinor: Number(r.recorded_cost_minor), costWorkCount: Number(r.cost_work_count),
  })) };
}
