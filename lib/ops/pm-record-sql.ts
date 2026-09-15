import type { OrganizationScope } from "./repository";
import type { PageRequest } from "./types";
import type { OpsSqlDriver } from "./sql-driver";
import { scopeWhere } from "./sql-scope";
import { dashboardPageBounds } from "./dashboard-query";
import { workVisitEvidencePage } from "./pm-record-query";

export async function queryWorkVisitEvidence(driver: OpsSqlDriver, scope: OrganizationScope, workId: string, request: PageRequest) {
  const params: unknown[] = [];
  const stores = scopeWhere(scope, "s", params);
  const { limit, offset } = dashboardPageBounds(request);
  params.push(workId, limit, offset);
  const timestamp = driver.dialect === "postgres" ? "v.checked_in_at" : "julianday(v.checked_in_at)";
  const binary = driver.dialect === "postgres" ? 'COLLATE "C"' : "COLLATE BINARY";
  const result = await driver.query({ sql: `WITH parent AS (
      SELECT w.id, w.organization_id, w.store_id FROM ops_work_orders w
      JOIN ops_stores s ON s.organization_id=w.organization_id AND s.id=w.store_id
      WHERE ${stores} AND w.id=?
    ), evidence AS (
      SELECT v.id, v.checked_in_at, v.checked_out_at, v.provider_name, v.technician_name, v.status, ${timestamp} AS sort_date
      FROM ops_visit_sessions v JOIN parent w ON w.organization_id=v.organization_id AND w.store_id=v.store_id
      WHERE v.work_order_id=w.id OR EXISTS (SELECT 1 FROM ops_site_visit_work_orders l WHERE l.organization_id=w.organization_id AND l.work_order_id=w.id AND l.visit_id=v.id)
    ), total AS (SELECT COUNT(*) AS count FROM evidence), visible AS (
      SELECT * FROM evidence ORDER BY sort_date DESC, id ${binary} LIMIT ? OFFSET ?
    ) SELECT visible.*,total.count FROM total LEFT JOIN visible ON 1=1 ORDER BY visible.sort_date DESC,visible.id ${binary}`, params });
  return workVisitEvidencePage(result.rows.filter(row => row.id != null).map(row => ({
    id: String(row.id), checkedInAt: new Date(String(row.checked_in_at)).toISOString(),
    checkedOutAt: row.checked_out_at == null ? undefined : new Date(String(row.checked_out_at)).toISOString(),
    providerName: String(row.provider_name), technicianName: String(row.technician_name), status: String(row.status),
  })), Number(result.rows[0]?.count ?? 0), request);
}
