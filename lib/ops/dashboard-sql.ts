import type { OrganizationScope } from "./repository";
import type { OpsSqlDriver } from "./sql-driver";
import { scopeWhere } from "./sql-scope";
import { vendorResponseSql } from "./work-stage-sql";
import { workCostSql } from "./work-cost-query";
import { visibleInvoiceSql } from "./invoice-scope-sql";
import { PENDING_REQUEST_STATUSES, WORK_STAGE_STATUSES } from "./dashboard-cohorts";
import {
  dashboardCursor, dashboardPageBounds, readDashboardCursor, validateDashboardWindow,
  type DashboardActivitySummary, type DashboardBreakdownPage, type DashboardBreakdownQuery,
  type DashboardBreakdownRow, type DashboardWindow,
} from "./dashboard-query";

function dashboardCtes(scope: OrganizationScope, window: DashboardWindow) {
  validateDashboardWindow(window);
  const params: unknown[] = [];
  const cost = workCostSql("c", { hasCost: true, costFrom: window.costFrom, costTo: window.costTo, currency: window.currency });
  const sql = `WITH scoped_stores AS (SELECT s.id, s.organization_id, s.store_number, s.name FROM ops_stores s WHERE ${scopeWhere(scope, "s", params)}),
    scoped_work AS (SELECT w.id, w.organization_id, w.store_id, w.category_key, w.status, w.accountable_party
      FROM ops_work_orders w JOIN scoped_stores s ON s.organization_id=w.organization_id AND s.id=w.store_id),
    scoped_visits AS (SELECT v.id, v.organization_id, v.vendor_id, v.work_order_id, v.status
      FROM ops_visit_sessions v JOIN scoped_stores s ON s.organization_id=v.organization_id AND s.id=v.store_id),
    period_costs AS (SELECT c.work_order_id, c.amount_minor, c.service_date
      FROM ops_cost_lines c JOIN scoped_work w ON w.organization_id=c.organization_id AND w.id=c.work_order_id
      WHERE 1=1${cost.sql})`;
  params.push(...cost.params);
  return { sql, params };
}

export async function queryDashboardActivity(driver: OpsSqlDriver, scope: OrganizationScope, window: DashboardWindow): Promise<DashboardActivitySummary> {
  const source = dashboardCtes(scope, window);
  const conditions = [
    ["stores", "SELECT COUNT(*) FROM scoped_stores"],
    ["openWork", "SELECT COUNT(*) FROM scoped_work WHERE status NOT IN ('closed','cancelled')"],
    ["pendingRequests", `SELECT COUNT(*) FROM ops_requests r JOIN scoped_stores s ON s.organization_id=r.organization_id AND s.id=r.store_id WHERE r.status IN (${PENDING_REQUEST_STATUSES.map(() => "?").join(",")})`],
    ["approvedNotSent", `SELECT COUNT(*) FROM scoped_work WHERE status IN (${WORK_STAGE_STATUSES["not-sent"].map(() => "?").join(",")})`],
    ["awaitingVendor", `SELECT COUNT(*) FROM scoped_work w
      LEFT JOIN ops_work_order_assignments a ON a.organization_id=w.organization_id AND a.id=(SELECT aa.id FROM ops_work_order_assignments aa WHERE aa.organization_id=w.organization_id AND aa.work_order_id=w.id ORDER BY aa.assigned_at DESC, aa.id DESC LIMIT 1)
      LEFT JOIN ops_vendors v ON v.organization_id=w.organization_id AND v.id=a.vendor_id
      WHERE w.status IN (${WORK_STAGE_STATUSES["vendor-response"].map(() => "?").join(",")}) AND ${vendorResponseSql}`],
    ["activeVisits", "SELECT COUNT(*) FROM scoped_visits WHERE status='active'"],
    ["completedVisits", "SELECT COUNT(*) FROM scoped_visits WHERE status<>'active'"],
    ["totalVisits", "SELECT COUNT(*) FROM scoped_visits"],
    ["visitsWithoutWork", `SELECT COUNT(*) FROM scoped_visits v WHERE v.work_order_id IS NULL AND NOT EXISTS (SELECT 1 FROM ops_site_visit_work_orders l WHERE l.organization_id=v.organization_id AND l.visit_id=v.id)`],
    ["upcomingAppointments", `SELECT COUNT(*) FROM ops_service_appointments a JOIN scoped_work w ON w.organization_id=a.organization_id AND w.id=a.work_order_id WHERE a.status='confirmed' AND a.starts_at >= ?`],
    ["watchAssets", "SELECT COUNT(*) FROM ops_assets a JOIN scoped_stores s ON s.organization_id=a.organization_id AND s.id=a.store_id WHERE a.status='watch'"],
    ["invoiceRecords", `SELECT COUNT(*) FROM ops_invoices i WHERE ${visibleInvoiceSql}`],
    ["recordedCostMinor", "SELECT COALESCE(SUM(amount_minor),0) FROM period_costs"],
    ["costWorkOrders", "SELECT COUNT(DISTINCT work_order_id) FROM period_costs"],
    ["costLines", "SELECT COUNT(*) FROM period_costs"],
    ["unclassifiedCostMinor", "SELECT COALESCE(SUM(c.amount_minor),0) FROM period_costs c JOIN scoped_work w ON w.id=c.work_order_id WHERE w.category_key IS NULL"],
    ["unclassifiedCostWorkOrders", "SELECT COUNT(DISTINCT c.work_order_id) FROM period_costs c JOIN scoped_work w ON w.id=c.work_order_id WHERE w.category_key IS NULL"],
    ["unclassifiedWork", "SELECT COUNT(*) FROM scoped_work WHERE category_key IS NULL"],
  ] as const;
  source.params.push(...PENDING_REQUEST_STATUSES, ...WORK_STAGE_STATUSES["not-sent"], ...WORK_STAGE_STATUSES["vendor-response"], window.asOf);
  const result = await driver.query({ sql: `${source.sql} SELECT ${conditions.map(([key, sql]) => `(${sql}) AS "${key}"`).join(",\n")}`, params: source.params });
  return Object.fromEntries(conditions.map(([key]) => [key, Number(result.rows[0]?.[key] ?? 0)])) as unknown as DashboardActivitySummary;
}

export async function queryDashboardBreakdown(driver: OpsSqlDriver, scope: OrganizationScope, window: DashboardWindow, query: DashboardBreakdownQuery): Promise<DashboardBreakdownPage> {
  const source = dashboardCtes(scope, window);
  let grouped: string;
  if (query.kind === "work_status") grouped = "SELECT status AS id, status AS label, COUNT(*) AS value FROM scoped_work WHERE status NOT IN ('closed','cancelled') GROUP BY status";
  else if (query.kind === "active_vendor" || query.kind === "observed_vendor") grouped = `SELECT v.vendor_id AS id, COALESCE(p.name,'Unknown vendor') AS label, COUNT(*) AS value FROM scoped_visits v LEFT JOIN ops_vendors p ON p.organization_id=v.organization_id AND p.id=v.vendor_id WHERE v.vendor_id IS NOT NULL ${query.kind === "active_vendor" ? "AND v.status='active'" : ""} GROUP BY v.vendor_id, p.name`;
  else if (query.kind === "cost_month") grouped = "SELECT substr(CAST(service_date AS TEXT),1,7) AS id, substr(CAST(service_date AS TEXT),1,7) AS label, SUM(amount_minor) AS value FROM period_costs GROUP BY substr(CAST(service_date AS TEXT),1,7)";
  else if (query.kind === "cost_category") grouped = "SELECT COALESCE(w.category_key,'unclassified') AS id, COALESCE(w.category_key,'unclassified') AS label, COALESCE(SUM(c.amount_minor),0) AS value FROM scoped_work w LEFT JOIN period_costs c ON c.work_order_id=w.id GROUP BY COALESCE(w.category_key,'unclassified')";
  else if (query.kind === "cost_store") grouped = "SELECT s.id, 'Store ' || s.store_number || ' · ' || s.name AS label, COALESCE(c.value,0) AS value FROM scoped_stores s LEFT JOIN (SELECT w.store_id,SUM(c.amount_minor) AS value FROM period_costs c JOIN scoped_work w ON w.id=c.work_order_id GROUP BY w.store_id) c ON c.store_id=s.id";
  else throw new RangeError("Choose a supported dashboard breakdown.");
  const { limit, offset } = dashboardPageBounds(query);
  const search = query.search?.trim().toLowerCase();
  const searchSql = search ? "WHERE LOWER(label) LIKE ? ESCAPE '\\'" : "";
  if (search) source.params.push(`%${search.replace(/[\\%_]/g, value => `\\${value}`)}%`);
  const cursor = readDashboardCursor(query.cursor);
  const cursorSql = cursor ? "WHERE value < ? OR (value = ? AND id > ?)" : "";
  if (cursor) source.params.push(cursor.value, cursor.value, cursor.id);
  source.params.push(limit + 1, cursor ? 0 : offset);
  const result = await driver.query({ sql: `${source.sql}, raw_groups AS (${grouped}), grouped AS (SELECT * FROM raw_groups ${searchSql}),
    totals AS (SELECT COUNT(*) AS total_count, COALESCE(SUM(value),0) AS total_value FROM grouped),
    visible AS (SELECT id,label,value FROM grouped ${cursorSql} ORDER BY value DESC,id ASC LIMIT ? OFFSET ?)
    SELECT visible.id,visible.label,visible.value,totals.total_count,totals.total_value FROM totals LEFT JOIN visible ON 1=1 ORDER BY visible.value DESC,visible.id ASC`, params: source.params });
  const rows = result.rows.filter(row => row.id !== null && row.id !== undefined).map((row): DashboardBreakdownRow => ({ id: String(row.id), label: String(row.label), value: Number(row.value) }));
  const items = rows.slice(0, limit);
  return { items, totalCount: Number(result.rows[0]?.total_count ?? 0), totalValue: Number(result.rows[0]?.total_value ?? 0), nextCursor: rows.length > limit ? dashboardCursor(items.at(-1)!) : undefined };
}
