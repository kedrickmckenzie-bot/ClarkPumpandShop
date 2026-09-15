import type { OrganizationScope } from "./repository";
import type { OpsSqlDriver } from "./sql-driver";
import { dashboardPageBounds } from "./dashboard-query";
import { pmScheduleCtes } from "./pm-schedule-sql";
import { pmAnalysisPeriod, validatePmAnalysisQuery, type PmAnalysisPage, type PmAnalysisQuery, type PmAnalysisRow } from "./pm-analysis-query";

export async function queryPmAnalysis(driver: OpsSqlDriver, scope: OrganizationScope, query: PmAnalysisQuery): Promise<PmAnalysisPage> {
  validatePmAnalysisQuery(query);
  const source = pmScheduleCtes(driver, scope, query), period = pmAnalysisPeriod(query.asOf);
  const { limit, offset } = dashboardPageBounds(query), binary = driver.dialect === "postgres" ? 'COLLATE "C"' : "COLLATE BINARY";
  const bind = (value: unknown) => { source.params.push(value); return "?"; };
  const from = driver.dialect === "postgres" ? `CAST(${bind(period.from)} AS TIMESTAMPTZ)` : `julianday(${bind(period.from)})`;
  const ctes = `${source.sql}, covered AS (SELECT DISTINCT asset_id FROM pm_base WHERE asset_id IS NOT NULL),
    closed_ranked AS (SELECT id,asset_id,state,window_starts_at,window_ends_at,ROW_NUMBER() OVER (PARTITION BY asset_id ORDER BY end_instant DESC,id ${binary} DESC) AS rn FROM pm_base WHERE closed_eligible=1 AND asset_id IS NOT NULL),
    latest AS (SELECT * FROM closed_ranked WHERE rn=1),
    reactive AS (SELECT w.* FROM ops_work_orders w JOIN covered c ON c.asset_id=w.asset_id
      JOIN ops_assets a ON a.organization_id=w.organization_id AND a.id=w.asset_id AND a.store_id=w.store_id
      JOIN scoped_stores s ON s.organization_id=w.organization_id AND s.id=w.store_id
      WHERE NOT EXISTS (SELECT 1 FROM ops_pm_occurrences o WHERE o.organization_id=w.organization_id AND o.work_order_id=w.id AND o.store_id=w.store_id)),
    period_work AS (SELECT w.* FROM reactive w CROSS JOIN clock WHERE ${source.instant("w.created_at")}>=${from} AND ${source.instant("w.created_at")}<=clock.as_of),
    period_costs AS (SELECT c.* FROM ops_cost_lines c JOIN reactive w ON w.organization_id=c.organization_id AND w.id=c.work_order_id
      WHERE c.currency='USD' AND CAST(c.service_date AS TEXT)>=${bind(period.from.slice(0, 10))} AND CAST(c.service_date AS TEXT)<=${bind(period.through)}),
    stats AS (SELECT (SELECT COUNT(*) FROM covered) AS covered_equipment,
      (SELECT COUNT(*) FROM latest WHERE state='completed') AS completed_equipment,(SELECT COUNT(*) FROM latest WHERE state<>'completed') AS missed_equipment,
      (SELECT COUNT(*) FROM period_work w JOIN latest l ON l.asset_id=w.asset_id WHERE l.state='completed') AS completed_work,
      (SELECT COUNT(*) FROM period_work w JOIN latest l ON l.asset_id=w.asset_id WHERE l.state<>'completed') AS missed_work)`;
  const cohort = query.cohort === "completed" ? " AND l.state='completed'" : query.cohort === "missed" ? " AND l.state<>'completed'" : "";
  const columns = ["id", "date", "asset_id", "asset_name", "store_id", "store_number", "store_name", "time_zone", "work_id", "work_number", "description", "amount_minor", "occurrence_id", "window_starts_at", "window_ends_at", "state", "work_count", "sort_date"];
  const select = (values: Record<string, string>) => columns.map(key => `${values[key] ?? (key === "amount_minor" || key === "work_count" ? "0" : "NULL")} AS ${key}`).join(",");
  const context = { asset_id: "a.id", asset_name: "a.name", store_id: "s.id", store_number: "s.store_number", store_name: "s.name", time_zone: "s.time_zone" };
  const assetJoins = "JOIN ops_assets a ON a.organization_id=w.organization_id AND a.id=w.asset_id AND a.store_id=w.store_id JOIN scoped_stores s ON s.organization_id=a.organization_id AND s.id=a.store_id";
  let selected: string;
  if (query.kind === "months" || query.kind === "reactive-cost") {
    const conditions: string[] = [];
    if (query.month) conditions.push(`substr(CAST(c.service_date AS TEXT),1,7)=${bind(query.month)}`);
    if (cohort) conditions.push(`EXISTS (SELECT 1 FROM latest l WHERE l.asset_id=w.asset_id${cohort})`);
    const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
    if (query.kind === "months") selected = `SELECT ${select({ id: "substr(CAST(c.service_date AS TEXT),1,7)", date: "substr(CAST(c.service_date AS TEXT),1,7)", amount_minor: "SUM(c.amount_minor)" })} FROM period_costs c JOIN reactive w ON w.organization_id=c.organization_id AND w.id=c.work_order_id${where} GROUP BY substr(CAST(c.service_date AS TEXT),1,7)`;
    else selected = `SELECT ${select({ ...context, id: "c.id", date: "c.service_date", work_id: "w.id", work_number: "w.number", description: "c.description", amount_minor: "c.amount_minor", sort_date: source.instant("c.service_date") })} FROM period_costs c JOIN reactive w ON w.organization_id=c.organization_id AND w.id=c.work_order_id ${assetJoins}${where}`;
  } else if (query.kind === "reactive-work") selected = `SELECT ${select({ ...context, id: "w.id", date: "w.created_at", work_id: "w.id", work_number: "w.number", description: "w.problem", work_count: "1", sort_date: source.instant("w.created_at") })} FROM period_work w JOIN latest l ON l.asset_id=w.asset_id ${assetJoins} WHERE 1=1${cohort}`;
  else selected = `SELECT ${select({ ...context, id: "a.id", date: "l.window_ends_at", occurrence_id: "l.id", window_starts_at: "l.window_starts_at", window_ends_at: "l.window_ends_at", state: "l.state", work_count: "(SELECT COUNT(*) FROM period_work w WHERE w.asset_id=a.id)" })} FROM latest l JOIN pm_base p ON p.id=l.id JOIN ops_assets a ON a.organization_id=p.organization_id AND a.id=l.asset_id AND a.store_id=p.store_id JOIN scoped_stores s ON s.organization_id=a.organization_id AND s.id=a.store_id WHERE 1=1${cohort}`;
  const order = query.kind === "months" || query.kind === "cohort-equipment" ? `id ${binary}` : `sort_date DESC,id ${binary}`;
  const result = await driver.query({ sql: `${ctes}, selected AS (${selected}), total AS (SELECT COUNT(*) AS total_count,COALESCE(SUM(amount_minor),0) AS total_amount FROM selected),
    visible AS (SELECT * FROM selected ORDER BY ${order} LIMIT ${bind(limit)} OFFSET ${bind(offset)})
    SELECT visible.*,stats.*,total.* FROM stats CROSS JOIN total LEFT JOIN visible ON 1=1 ORDER BY ${query.kind === "months" || query.kind === "cohort-equipment" ? `visible.id ${binary}` : `visible.sort_date DESC,visible.id ${binary}`}`, params: source.params });
  const first = result.rows[0] ?? {}, totalCount = Number(first.total_count ?? 0);
  const items: PmAnalysisRow[] = result.rows.filter(row => row.id != null).map(row => {
    const optional = (key: string) => row[key] == null ? undefined : String(row[key]);
    const iso = (key: string) => row[key] == null ? undefined : new Date(String(row[key])).toISOString();
    return { id: String(row.id), date: query.kind === "months" ? String(row.date) : query.kind === "reactive-cost" ? new Date(String(row.date)).toISOString().slice(0, 10) : iso("date")!,
      assetId: optional("asset_id"), assetName: optional("asset_name"), storeId: optional("store_id"), storeNumber: optional("store_number"), storeName: optional("store_name"), timeZone: optional("time_zone"),
      workId: optional("work_id"), workNumber: optional("work_number"), description: optional("description"), amountMinor: Number(row.amount_minor), occurrenceId: optional("occurrence_id"), windowStartsAt: iso("window_starts_at"), windowEndsAt: iso("window_ends_at"), status: optional("state"), workCount: Number(row.work_count) };
  });
  return { items, totalCount, totalAmountMinor: Number(first.total_amount ?? 0), summary: { coveredEquipment: Number(first.covered_equipment ?? 0), completedEquipment: Number(first.completed_equipment ?? 0), missedEquipment: Number(first.missed_equipment ?? 0), completedWork: Number(first.completed_work ?? 0), missedWork: Number(first.missed_work ?? 0) }, nextOffset: offset + limit < totalCount ? offset + limit : undefined };
}
