import { briefValueScopeSql } from "./brief-value-scope-sql";
import type { OrganizationScope } from "./repository";
import type { OpsSqlDriver, SqlRow } from "./sql-driver";
import { scopeWhere } from "./sql-scope";
import { visibleInvoiceSql } from "./invoice-scope-sql";
import { dashboardPageBounds } from "./dashboard-query";
import { BRIEF_PM_STATES, validateBriefPeriod, type BriefPeriod, type BriefSourcePage, type BriefSourceQuery, type BriefSourceRow } from "./owner-brief-query";

export async function queryBriefSources(driver: OpsSqlDriver, scope: OrganizationScope, period: BriefPeriod, query: BriefSourceQuery): Promise<BriefSourcePage> {
  validateBriefPeriod(period);
  const params: unknown[] = [];
  const binary = driver.dialect === "postgres" ? 'COLLATE "C"' : "COLLATE BINARY";
  const date = (column: string) => `substr(CAST(${column} AS TEXT),1,10)`;
  const instant = (column: string) => driver.dialect === "postgres" ? `to_char(${column} AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')` : `strftime('%Y-%m-%dT%H:%M:%fZ',${column})`;
  const within = (column: string) => { params.push(period.from, period.to); return `${date(column)}>=? AND ${date(column)}<=?`; };
  const scopeSql = scopeWhere(query.storeId ? { ...scope, storeIds: scope.storeIds === undefined ? [query.storeId] : scope.storeIds.filter(id => id === query.storeId) } : scope, "s", params);
  const source = `WITH scoped_stores AS (SELECT s.* FROM ops_stores s WHERE ${scopeSql}),
    scoped_work AS (SELECT w.* FROM ops_work_orders w JOIN scoped_stores s ON s.organization_id=w.organization_id AND s.id=w.store_id),
    scoped_assets AS (SELECT a.* FROM ops_assets a JOIN scoped_stores s ON s.organization_id=a.organization_id AND s.id=a.store_id),
    scoped_requests AS (SELECT r.* FROM ops_requests r JOIN scoped_stores s ON s.organization_id=r.organization_id AND s.id=r.store_id),
    visible_invoices AS (SELECT i.* FROM ops_invoices i WHERE ${visibleInvoiceSql}),
    visible_lines AS (SELECT l.* FROM ops_invoice_lines l JOIN visible_invoices i ON i.organization_id=l.organization_id AND i.id=l.invoice_id),
    visible_tasks AS (SELECT t.*,COALESCE(w.store_id,r.store_id) AS scoped_store_id FROM ops_workflow_tasks t LEFT JOIN scoped_work w ON w.organization_id=t.organization_id AND w.id=t.work_order_id LEFT JOIN scoped_requests r ON r.organization_id=t.organization_id AND r.id=t.service_request_id WHERE t.status IN ('open','in_progress') AND (w.id IS NOT NULL OR (t.work_order_id IS NULL AND r.id IS NOT NULL)))`;
  const columns = ["id", "label", "detail", "store_id", "entity_id", "entity_type", "amount_minor", "currency", "date_text", "status", "opened_work"];
  const select = (values: Record<string, string>) => columns.map(column => `${values[column] ?? (["amount_minor", "opened_work"].includes(column) ? "0" : "NULL")} AS ${column}`).join(",");
  const taskFields = { id: "t.id", label: "t.title", detail: "t.reason", store_id: "t.scoped_store_id", entity_id: "COALESCE(t.work_order_id,t.service_request_id)", entity_type: "CASE WHEN t.work_order_id IS NOT NULL THEN 'work_order' ELSE 'request' END", date_text: instant("t.due_at"), status: "CASE WHEN t.task_type='approve_quote' THEN 'approval' ELSE 'escalated_task' END" };
  let records: string;
  if (query.kind === "recorded_cost") {
    const window = within("c.service_date"); params.push(period.currency);
    records = `SELECT ${select({ id: "c.id", label: "w.number || ' · ' || c.description", detail: "c.kind", store_id: "w.store_id", entity_id: "w.id", entity_type: "'work_order'", amount_minor: "c.amount_minor", currency: "c.currency", date_text: date("c.service_date"), status: "c.kind" })} FROM ops_cost_lines c JOIN scoped_work w ON w.organization_id=c.organization_id AND w.id=c.work_order_id WHERE ${window} AND c.currency=?`;
  } else if (query.kind === "invoice_review") {
    params.push(period.currency);
    records = `SELECT ${select({ id: "i.id", label: "i.vendor_invoice_number", detail: "'Open review flag'", entity_id: "i.id", entity_type: "'invoice'", amount_minor: "i.total_minor", currency: "i.currency", date_text: date("i.invoice_date"), status: "i.status" })} FROM visible_invoices i WHERE i.currency=? AND EXISTS (SELECT 1 FROM ops_invoice_exceptions e WHERE e.organization_id=i.organization_id AND e.invoice_id=i.id AND e.status='open')`;
  } else if (["verified_value", "opportunity", "other_exposure"].includes(query.kind)) {
    const category = query.kind === "verified_value" ? "realized_verified" : query.kind === "opportunity" ? "estimated_opportunity" : "identified_exposure";
    params.push(scope.organizationId, category, period.currency); const window = within("v.occurred_at");
    const companywide = !query.storeId && scope.storeIds === undefined && scope.regionIds === undefined;
    records = `SELECT ${select({ id: "v.id", label: "v.event_type", detail: "v.source_decision", store_id: "COALESCE(w.store_id,a.store_id)", entity_id: "COALESCE(v.work_order_id,v.asset_id)", entity_type: "CASE WHEN v.work_order_id IS NOT NULL THEN 'work_order' WHEN v.asset_id IS NOT NULL THEN 'asset' ELSE NULL END", amount_minor: "v.amount_minor", currency: "v.currency", date_text: date("v.occurred_at"), status: "v.category" })} FROM ops_value_events v LEFT JOIN scoped_work w ON w.organization_id=v.organization_id AND w.id=v.work_order_id LEFT JOIN scoped_assets a ON a.organization_id=v.organization_id AND a.id=v.asset_id LEFT JOIN visible_lines l ON l.organization_id=v.organization_id AND l.id=v.invoice_line_id WHERE v.organization_id=? AND v.category=? AND v.currency=? AND ${window} AND (v.work_order_id IS NULL OR w.id IS NOT NULL) AND (v.asset_id IS NULL OR a.id IS NOT NULL) AND (v.invoice_line_id IS NULL OR l.id IS NOT NULL) AND ${companywide ? "1=1" : "(w.id IS NOT NULL OR a.id IS NOT NULL OR l.id IS NOT NULL OR v.warranty_case_id IS NOT NULL OR v.approval_decision_id IS NOT NULL OR v.service_run_id IS NOT NULL)"} ${briefValueScopeSql} ${query.kind === "other_exposure" ? "AND v.event_type NOT LIKE 'invoice\\_%' ESCAPE '\\'" : ""}`;
  } else if (query.kind === "opened_work" || query.kind === "active_work") {
    const condition = query.kind === "opened_work" ? within("w.created_at") : "w.status NOT IN ('resolved','closed','cancelled')";
    records = `SELECT ${select({ id: "w.id", label: "w.number", detail: "w.problem", store_id: "w.store_id", entity_id: "w.id", entity_type: "'work_order'", date_text: date("w.created_at"), status: "w.status" })} FROM scoped_work w WHERE ${condition}`;
  } else if (query.kind === "escalations") records = `SELECT ${select(taskFields)} FROM visible_tasks t WHERE t.escalation_level>0`;
  else if (query.kind === "pm") {
    const pmState = `CASE WHEN p.status IN ('waived','cancelled') THEN p.status WHEN p.completed_at IS NOT NULL THEN CASE WHEN ${instant("p.completed_at")}<${instant("p.window_starts_at")} THEN 'completed_early' WHEN ${instant("p.completed_at")}<=${instant("p.window_ends_at")} THEN 'completed_on_time' ELSE 'completed_late' END WHEN p.status LIKE 'completed%' THEN p.status WHEN ${instant("p.window_ends_at")}<? THEN 'missed' WHEN p.status IN ('unscheduled','proposed','upcoming') THEN 'unscheduled' ELSE 'open' END`;
    params.push(new Date(period.asOf).toISOString()); const window = within("p.due_at");
    records = `SELECT ${select({ id: "p.id", label: "COALESCE(plan.name,'Store PM') || ' · Store ' || s.store_number", detail: "COALESCE(a.name,'Store PM')", store_id: "p.store_id", entity_id: "p.id", entity_type: "'pm_occurrence'", date_text: date("p.due_at"), status: pmState })} FROM ops_pm_occurrences p JOIN scoped_stores s ON s.organization_id=p.organization_id AND s.id=p.store_id LEFT JOIN scoped_assets a ON a.organization_id=p.organization_id AND a.id=p.asset_id LEFT JOIN ops_pm_plans plan ON plan.organization_id=p.organization_id AND plan.id=p.plan_id WHERE ${window}`;
  } else if (query.kind === "stores") {
    params.push(period.currency); const costWindow = within("c.service_date"); params.push(period.currency); const workWindow = within("w.created_at");
    records = `SELECT ${select({ id: "s.id", label: "'Store ' || s.store_number || ' · ' || s.name", detail: "''", store_id: "s.id", entity_id: "s.id", entity_type: "'store'", amount_minor: `(SELECT COALESCE(SUM(c.amount_minor),0) FROM ops_cost_lines c JOIN scoped_work w ON w.organization_id=c.organization_id AND w.id=c.work_order_id WHERE w.store_id=s.id AND c.currency=? AND ${costWindow})`, currency: "?", status: "s.status", opened_work: `(SELECT COUNT(*) FROM scoped_work w WHERE w.store_id=s.id AND ${workWindow})` })} FROM scoped_stores s`;
  } else if (query.kind === "decisions") {
    const state = `CASE d.user_decision WHEN 'investigate' THEN CASE WHEN trim(d.user_reason)='' THEN 'Review required' ELSE 'Investigation underway' END WHEN 'defer' THEN 'Deferred — re-review not yet scheduled' WHEN 'repair' THEN 'Repair approved — outcome pending' WHEN 'replace' THEN 'Replacement approved — outcome pending' END`;
    records = `SELECT ${select({ ...taskFields, id: "'task:' || t.id" })} FROM visible_tasks t WHERE t.task_type='approve_quote' OR t.escalation_level>0 UNION ALL SELECT ${select({ id: "'lifecycle:' || d.id", label: `a.name || ' · ' || ${state}`, detail: "d.user_reason", store_id: "a.store_id", entity_id: "a.id", entity_type: "'asset'", date_text: instant("d.decided_at"), status: "'lifecycle'" })} FROM scoped_assets a JOIN ops_lifecycle_recommendations d ON d.organization_id=a.organization_id AND d.id=(SELECT x.id FROM ops_lifecycle_recommendations x WHERE x.organization_id=a.organization_id AND x.asset_id=a.id ORDER BY x.version DESC,x.decided_at DESC,x.id ${binary} DESC LIMIT 1) WHERE d.actual_outcome IS NULL AND d.recommendation IN ('capital_review','replace') AND d.user_decision IN ('investigate','defer','repair','replace')`;
  } else throw new RangeError("Choose a brief record type.");
  const { limit, offset } = dashboardPageBounds(query);
  const order = query.kind === "stores" ? `amount_minor DESC,id ${binary}` : `COALESCE(date_text,'') DESC,id ${binary}`;
  params.push(limit + 1, offset);
  const result = await driver.query({ sql: `${source}, records AS (${records}), totals AS (SELECT COUNT(*) AS total_count,COALESCE(SUM(amount_minor),0) AS total_amount,${BRIEF_PM_STATES.map(state => `COALESCE(SUM(CASE WHEN status='${state}' THEN 1 ELSE 0 END),0) AS count_${state}`).join(",")} FROM records), visible AS (SELECT * FROM records ORDER BY ${order} LIMIT ? OFFSET ?) SELECT visible.*,totals.* FROM totals LEFT JOIN visible ON 1=1 ORDER BY ${query.kind === "stores" ? "visible.amount_minor DESC,visible.id" : "COALESCE(visible.date_text,'') DESC,visible.id"} ${binary}`, params });
  const optional = (row: SqlRow, key: string) => row[key] == null ? undefined : String(row[key]);
  const rows = result.rows.filter(row => row.id != null).map((row): BriefSourceRow => ({ id: String(row.id), label: String(row.label), detail: String(row.detail ?? ""), storeId: optional(row, "store_id"), entityId: optional(row, "entity_id"), entityType: optional(row, "entity_type") as BriefSourceRow["entityType"], amountMinor: Number(row.amount_minor), currency: optional(row, "currency"), date: optional(row, "date_text"), status: String(row.status), ...(query.kind === "stores" ? { openedWork: Number(row.opened_work) } : {}) }));
  return { items: rows.slice(0, limit), totalCount: Number(result.rows[0]?.total_count ?? 0), totalAmountMinor: Number(result.rows[0]?.total_amount ?? 0), statuses: Object.fromEntries(BRIEF_PM_STATES.map(state => [state, Number(result.rows[0]?.[`count_${state}`] ?? 0)])), nextOffset: rows.length > limit ? offset + limit : undefined };
}
