import type { OrganizationScope } from "./repository";
import type { OpsSqlDriver, SqlRow } from "./sql-driver";
import { scopeWhere } from "./sql-scope";
import { dashboardPageBounds } from "./dashboard-query";
import { PM_SCHEDULE_STATES, pmScheduleScope, validatePmScheduleQuery, type PmSchedulePage, type PmScheduleQuery, type PmScheduleRow, type PmScheduleSummary } from "./pm-schedule-query";

export function pmScheduleCtes(driver: OpsSqlDriver, scope: OrganizationScope, query: PmScheduleQuery) {
  validatePmScheduleQuery(query);
  const params: unknown[] = [query.asOf];
  const instant = (column: string) => driver.dialect === "postgres" ? column : `julianday(${column})`;
  const clock = driver.dialect === "postgres" ? "CAST(? AS TIMESTAMPTZ)" : "julianday(?)";
  const scoped = scopeWhere(pmScheduleScope(scope, query), "s", params);
  const where: string[] = [];
  if (query.program) { where.push("program_id=?"); params.push(query.program); }
  if (query.window) where.push("closed_eligible=1");
  const sql = `WITH clock AS (SELECT ${clock} AS as_of), scoped_stores AS (SELECT s.* FROM ops_stores s WHERE ${scoped}),
    pm_facts AS (
      SELECT o.id,o.organization_id,o.store_id,o.due_at,o.window_starts_at,o.window_ends_at,o.result,o.work_order_id AS work_reference,
        s.store_number,s.name AS store_name,s.time_zone,p.id AS plan_id,p.name AS plan_name,p.category_key,g.id AS program_id,
        a.id AS asset_id,a.name AS asset_name,w.id AS work_id,w.number AS work_number,${instant("o.due_at")} AS due_instant,${instant("o.window_ends_at")} AS end_instant,
        CASE WHEN o.status IN ('waived','cancelled') THEN o.status WHEN o.completed_at IS NOT NULL OR o.status LIKE 'completed%' THEN 'completed'
          WHEN ${instant("o.window_ends_at")}<clock.as_of THEN 'missed' WHEN ${instant("o.window_starts_at")}>clock.as_of THEN 'scheduled'
          WHEN o.status IN ('unscheduled','proposed','upcoming') THEN 'unscheduled' WHEN ${instant("o.due_at")}<clock.as_of THEN 'overdue' ELSE 'due' END AS state,
        (SELECT COUNT(*) FROM ops_visit_sessions v WHERE v.organization_id=w.organization_id AND v.store_id=w.store_id AND (v.work_order_id=w.id OR EXISTS (SELECT 1 FROM ops_site_visit_work_orders l WHERE l.organization_id=w.organization_id AND l.work_order_id=w.id AND l.visit_id=v.id))) AS visit_count,
        (SELECT COUNT(*) FROM ops_follow_ups f WHERE f.organization_id=w.organization_id AND f.work_order_id=w.id AND f.status='open') AS follow_up_count
      FROM ops_pm_occurrences o JOIN scoped_stores s ON s.organization_id=o.organization_id AND s.id=o.store_id CROSS JOIN clock
      LEFT JOIN ops_pm_plans p ON p.organization_id=o.organization_id AND p.id=o.plan_id AND (p.store_id IS NULL OR p.store_id=o.store_id)
      LEFT JOIN ops_maintenance_programs g ON g.organization_id=p.organization_id AND g.id=p.program_id
      LEFT JOIN ops_assets a ON a.organization_id=o.organization_id AND a.id=o.asset_id AND a.store_id=o.store_id
      LEFT JOIN ops_work_orders w ON w.organization_id=o.organization_id AND w.id=o.work_order_id AND w.store_id=o.store_id
    ), pm_classified AS (SELECT pm_facts.*,CASE WHEN end_instant<clock.as_of AND state NOT IN ('waived','cancelled') THEN 1 ELSE 0 END AS closed_eligible FROM pm_facts CROSS JOIN clock),
    pm_base AS (SELECT * FROM pm_classified${where.length ? ` WHERE ${where.join(" AND ")}` : ""})`;
  return { sql, params, instant };
}

export function pmScheduleRow(row: SqlRow): PmScheduleRow {
  const optional = (key: string) => row[key] == null ? undefined : String(row[key]);
  return { id: String(row.id), planId: optional("plan_id"), planName: optional("plan_name") ?? "Planned maintenance", programId: optional("program_id"),
    storeId: String(row.store_id), storeNumber: String(row.store_number), storeName: String(row.store_name), timeZone: optional("time_zone"),
    assetId: optional("asset_id"), assetName: optional("asset_name"), categoryKey: optional("category_key"), workId: optional("work_id"), workNumber: optional("work_number"), hasWorkReference: row.work_reference != null,
    dueAt: new Date(String(row.due_at)).toISOString(), windowStartsAt: new Date(String(row.window_starts_at)).toISOString(), windowEndsAt: new Date(String(row.window_ends_at)).toISOString(),
    status: String(row.state) as PmScheduleRow["status"], visitCount: Number(row.visit_count), followUpCount: Number(row.follow_up_count), importedHistory: row.state === "completed" && row.work_reference == null && String(row.result ?? "").startsWith("Manager-attested historical completion"),
  };
}
export async function queryPmSchedule(driver: OpsSqlDriver, scope: OrganizationScope, query: PmScheduleQuery): Promise<PmSchedulePage> {
  const source = pmScheduleCtes(driver, scope, query), { limit, offset } = dashboardPageBounds(query);
  const filters: string[] = [];
  if (query.view === "attention") filters.push("state IN ('due','overdue','missed','unscheduled')");
  if (query.view === "upcoming") filters.push("state IN ('scheduled','due','overdue')");
  if (query.status === "follow-up") filters.push("follow_up_count>0");
  else if (query.status) { filters.push("state=?"); source.params.push(query.status); }
  if (query.occurrence) { filters.push("id=?"); source.params.push(query.occurrence); }
  const sum = (condition: string, name: string) => `COALESCE(SUM(CASE WHEN ${condition} THEN 1 ELSE 0 END),0) AS ${name}`;
  const summary = ["COUNT(*) AS all_count", ...PM_SCHEDULE_STATES.map(state => sum(`state='${state}'`, `state_${state}`)),
    sum("state IN ('due','overdue','missed','unscheduled')", "attention_count"), sum("state IN ('scheduled','due','overdue')", "upcoming_count"), sum("follow_up_count>0", "follow_count"), sum("closed_eligible=1", "eligible_count"), sum("closed_eligible=1 AND state='completed'", "completed_count")];
  const binary = driver.dialect === "postgres" ? 'COLLATE "C"' : "COLLATE BINARY";
  source.params.push(limit, offset);
  const result = await driver.query({ sql: `${source.sql}, selected AS (SELECT * FROM pm_base${filters.length ? ` WHERE ${filters.join(" AND ")}` : ""}),
    summary AS (SELECT ${summary.join(",")} FROM pm_base), total AS (SELECT COUNT(*) AS total_count FROM selected),
    visible AS (SELECT * FROM selected ORDER BY due_instant,id ${binary} LIMIT ? OFFSET ?)
    SELECT visible.*,summary.*,total.total_count FROM summary CROSS JOIN total LEFT JOIN visible ON 1=1 ORDER BY visible.due_instant,visible.id ${binary}`, params: source.params });
  const first = result.rows[0] ?? {}, totalCount = Number(first.total_count ?? 0);
  return { items: result.rows.filter(row => row.id != null).map(pmScheduleRow), totalCount,
    summary: { states: Object.fromEntries(PM_SCHEDULE_STATES.map(state => [state, Number(first[`state_${state}`] ?? 0)])) as PmScheduleSummary["states"], all: Number(first.all_count ?? 0), attention: Number(first.attention_count ?? 0), upcoming: Number(first.upcoming_count ?? 0), followUp: Number(first.follow_count ?? 0), closedEligible: Number(first.eligible_count ?? 0), closedCompleted: Number(first.completed_count ?? 0) },
    nextOffset: offset + limit < totalCount ? offset + limit : undefined };
}
