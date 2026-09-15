import type { OrganizationScope } from "./repository";
import type { OpsSqlDriver } from "./sql-driver";
import { scopeWhere } from "./sql-scope";
import { visibleInvoiceSql } from "./invoice-scope-sql";
import { dashboardPageBounds } from "./dashboard-query";
import { INTEGRITY_SOURCES, validateIntegrityQuery, type IntegrityCounts, type IntegrityPage, type IntegrityQuery } from "./record-integrity-query";
import type { BriefSourceRow } from "./owner-brief-query";

export async function queryRecordIntegrity(driver: OpsSqlDriver, scope: OrganizationScope, asOf: string, query: IntegrityQuery): Promise<IntegrityPage> {
  validateIntegrityQuery(asOf, query);
  const params: unknown[] = [];
  const scoped = scopeWhere(scope, "s", params);
  const binary = driver.dialect === "postgres" ? 'COLLATE "C"' : "COLLATE BINARY";
  const instant = (column: string) => driver.dialect === "postgres" ? `to_char(${column} AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')` : `strftime('%Y-%m-%dT%H:%M:%fZ',${column})`;
  const closed = "w.status IN ('resolved','closed')";
  const conditions = {
    closed_work: closed,
    with_outcome: `${closed} AND w.outcome IS NOT NULL AND w.outcome_recorded_at IS NOT NULL`,
    without_outcome: `${closed} AND (w.outcome IS NULL OR w.outcome_recorded_at IS NULL)`,
    vendor_closed: `${closed} AND w.vendor_assigned=1`,
    verified: `${closed} AND w.vendor_assigned=1 AND w.verified=1`,
    unverified: `${closed} AND w.vendor_assigned=1 AND w.verified=0`,
    with_cost: `${closed} AND w.has_cost=1`, without_cost: `${closed} AND w.has_cost=0`,
    missing_action: `w.status NOT IN ('resolved','closed','cancelled') AND w.has_task=0`,
    unclassified_work: `w.status<>'cancelled' AND trim(COALESCE(w.category_key,''))=''`,
  };
  const workGroups = Object.entries(conditions).map(([kind, condition]) => `SELECT '${kind}' AS kind,w.id,w.number || ' · Store ' || w.store_number AS label,w.problem AS detail,w.store_id,'work_order' AS entity_type,${instant("COALESCE(w.closed_at,w.resolved_at,w.created_at)")} AS date_text,w.status FROM work_facts w WHERE ${condition}`).join(" UNION ALL ");
  params.push(new Date(Date.parse(asOf) - 30 * 86_400_000).toISOString());
  const { limit, offset } = dashboardPageBounds(query);
  params.push(query.kind, limit + 1, offset);
  const result = await driver.query({ sql: `WITH scoped_stores AS (SELECT s.* FROM ops_stores s WHERE ${scoped}),
    scoped_work AS (SELECT w.*,s.store_number FROM ops_work_orders w JOIN scoped_stores s ON s.organization_id=w.organization_id AND s.id=w.store_id),
    current_work AS MATERIALIZED (SELECT w.*,(SELECT x.id FROM ops_site_visit_work_orders x WHERE x.organization_id=w.organization_id AND x.work_order_id=w.id ORDER BY ${instant("x.linked_at")} DESC,COALESCE(${instant("x.outcome_recorded_at")},'') DESC,x.id ${binary} DESC LIMIT 1) AS current_outcome_id FROM scoped_work w),
    current_outcomes AS MATERIALIZED (SELECT w.*,o.outcome,o.outcome_recorded_at,(SELECT x.id FROM ops_work_order_verifications x WHERE x.organization_id=w.organization_id AND x.work_order_id=w.id AND x.site_visit_work_order_id=o.id ORDER BY ${instant("x.decided_at")} DESC,x.id ${binary} DESC LIMIT 1) AS current_verification_id FROM current_work w LEFT JOIN ops_site_visit_work_orders o ON o.organization_id=w.organization_id AND o.id=w.current_outcome_id),
    work_facts AS MATERIALIZED (SELECT w.*,
      CASE WHEN EXISTS (SELECT 1 FROM ops_work_order_assignments a WHERE a.organization_id=w.organization_id AND a.work_order_id=w.id AND a.vendor_id IS NOT NULL) THEN 1 ELSE 0 END AS vendor_assigned,
      CASE WHEN EXISTS (SELECT 1 FROM ops_cost_lines c WHERE c.organization_id=w.organization_id AND c.work_order_id=w.id) THEN 1 ELSE 0 END AS has_cost,
      CASE WHEN EXISTS (SELECT 1 FROM ops_workflow_tasks t WHERE t.organization_id=w.organization_id AND t.work_order_id=w.id AND t.status IN ('open','in_progress')) THEN 1 ELSE 0 END AS has_task,
      CASE WHEN w.outcome IS NOT NULL AND w.outcome_recorded_at IS NOT NULL AND v.decision='verified' AND v.outcome=w.outcome AND ${instant("v.outcome_recorded_at")}=${instant("w.outcome_recorded_at")} THEN 1 ELSE 0 END AS verified
      FROM current_outcomes w LEFT JOIN ops_work_order_verifications v ON v.organization_id=w.organization_id AND v.id=w.current_verification_id),
    visible_invoices AS (SELECT i.* FROM ops_invoices i WHERE ${visibleInvoiceSql}),
    aged_invoices AS (SELECT i.id,i.vendor_invoice_number,MIN(${instant("e.detected_at")}) AS oldest FROM visible_invoices i JOIN ops_invoice_exceptions e ON e.organization_id=i.organization_id AND e.invoice_id=i.id AND e.status='open' GROUP BY i.id,i.vendor_invoice_number),
    records AS (${workGroups}
      UNION ALL SELECT 'aged_invoice',i.id,i.vendor_invoice_number,'Oldest open review flag',NULL,'invoice',i.oldest,'Needs review' FROM aged_invoices i WHERE i.oldest<=?
      UNION ALL SELECT 'missing_life',a.id,a.name || ' · Store ' || s.store_number,'Optional equipment detail',a.store_id,'asset',${instant("a.created_at")},'Not entered' FROM ops_assets a JOIN scoped_stores s ON s.organization_id=a.organization_id AND s.id=a.store_id WHERE a.status<>'retired' AND COALESCE(a.expected_life_years,0)=0),
    totals AS (SELECT ${Object.keys(INTEGRITY_SOURCES).map(key => `COALESCE(SUM(CASE WHEN kind='${key}' THEN 1 ELSE 0 END),0) AS count_${key}`).join(",")} FROM records),
    visible AS (SELECT * FROM records WHERE kind=? ORDER BY date_text,id ${binary} LIMIT ? OFFSET ?)
    SELECT visible.*,totals.* FROM totals LEFT JOIN visible ON 1=1 ORDER BY visible.date_text,visible.id ${binary}`, params });
  const counts = Object.fromEntries(Object.keys(INTEGRITY_SOURCES).map(key => [key, Number(result.rows[0]?.[`count_${key}`] ?? 0)])) as IntegrityCounts;
  const rows: BriefSourceRow[] = result.rows.filter(row => row.id != null).map(row => ({ id: String(row.id), label: String(row.label), detail: String(row.detail), storeId: row.store_id == null ? undefined : String(row.store_id), entityId: String(row.id), entityType: row.entity_type as BriefSourceRow["entityType"], amountMinor: 0, date: String(row.date_text), status: String(row.status) }));
  return { items: rows.slice(0, limit), totalCount: counts[query.kind], counts, nextOffset: rows.length > limit ? offset + limit : undefined };
}
