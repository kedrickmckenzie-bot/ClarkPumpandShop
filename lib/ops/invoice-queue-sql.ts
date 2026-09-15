import type { OrganizationScope } from "./repository";
import type { OpsSqlDriver, SqlRow } from "./sql-driver";
import { scopeWhere } from "./sql-scope";
import { dashboardPageBounds } from "./dashboard-query";
import { validateInvoiceQueueQuery, type InvoiceQueueQuery, type InvoiceQueuePage, type InvoiceQueueRow } from "./invoice-queue-query";

export async function queryInvoiceQueue(driver: OpsSqlDriver, scope: OrganizationScope, query: InvoiceQueueQuery): Promise<InvoiceQueuePage> {
  validateInvoiceQueueQuery(query);
  const pg = driver.dialect === "postgres", params: unknown[] = [], scoped = scopeWhere(scope, "s", params), bind = (v: unknown) => { params.push(v); return "?"; };
  const binary = pg ? 'COLLATE "C"' : "COLLATE BINARY", instant = (s: string) => pg ? `CAST(${s} AS TIMESTAMPTZ)` : `julianday(${s})`, organization = bind(scope.organizationId);
  const search = query.search ? ` AND LOWER(i.vendor_invoice_number||' '||COALESCE(v.name,'')) LIKE ${bind(`%${query.search.toLowerCase().replace(/[\\%_]/g, c => `\\${c}`)}%`)} ESCAPE '\\'` : "";
  const ctes = `WITH scoped_stores AS MATERIALIZED (SELECT s.id,s.organization_id FROM ops_stores s WHERE ${scoped}),
    scoped_work AS MATERIALIZED (SELECT w.id,w.organization_id,w.store_id FROM ops_work_orders w JOIN scoped_stores s ON s.organization_id=w.organization_id AND s.id=w.store_id),
    candidates AS MATERIALIZED (SELECT i.*,v.id AS valid_vendor_id,v.name AS vendor_name FROM ops_invoices i LEFT JOIN ops_vendors v ON v.organization_id=i.organization_id AND v.id=i.vendor_id WHERE i.organization_id=${organization}${search}),
    candidate_lines AS MATERIALIZED (SELECT l.* FROM ops_invoice_lines l JOIN candidates i ON i.organization_id=l.organization_id AND i.id=l.invoice_id),
    allocations AS MATERIALIZED (SELECT a.*,l.invoice_id FROM ops_invoice_line_allocations a JOIN candidate_lines l ON l.organization_id=a.organization_id AND l.id=a.invoice_line_id),
    allocation_scope AS MATERIALIZED (SELECT a.invoice_id,COUNT(*) AS allocation_count,SUM(CASE WHEN w.id IS NULL THEN 1 ELSE 0 END) AS invalid_count FROM allocations a LEFT JOIN scoped_work w ON w.organization_id=a.organization_id AND w.id=a.work_order_id AND w.store_id=a.store_id GROUP BY a.invoice_id),
    invoices AS MATERIALIZED (SELECT i.* FROM candidates i LEFT JOIN allocation_scope a ON a.invoice_id=i.id WHERE COALESCE(a.invalid_count,0)=0${scope.storeIds === undefined && scope.regionIds === undefined ? "" : " AND a.allocation_count>0"}),
    lines AS MATERIALIZED (SELECT l.* FROM candidate_lines l JOIN invoices i ON i.id=l.invoice_id),
    flags AS MATERIALIZED (SELECT f.* FROM ops_invoice_exceptions f JOIN invoices i ON i.organization_id=f.organization_id AND i.id=f.invoice_id WHERE f.status='open'),
    exposure AS MATERIALIZED (SELECT e.*,l.invoice_id FROM ops_value_events e JOIN lines l ON l.organization_id=e.organization_id AND l.id=e.invoice_line_id WHERE e.category='identified_exposure' AND e.currency=${bind(query.currency)} AND (e.work_order_id IS NULL OR EXISTS (SELECT 1 FROM allocations a WHERE a.organization_id=e.organization_id AND a.invoice_line_id=e.invoice_line_id AND a.work_order_id=e.work_order_id))),
    counts AS (SELECT (SELECT COUNT(*) FROM invoices) AS invoice_count,(SELECT COUNT(DISTINCT invoice_id) FROM flags) AS review_count,(SELECT COUNT(*) FROM flags) AS flag_count,(SELECT COUNT(*) FROM exposure) AS exposure_count,COALESCE((SELECT SUM(amount_minor) FROM exposure),0) AS exposure_minor)`;
  const common = "i.id AS invoice_id,i.vendor_invoice_number,i.valid_vendor_id,i.vendor_name,(SELECT COUNT(*) FROM flags f WHERE f.invoice_id=i.id) AS open_flags";
  const selected = query.view === "flags" ? `SELECT f.id,${common},f.detected_at AS date,f.status,f.kind AS label,f.summary AS detail,f.amount_minor,f.currency,NULL AS line_id,NULL AS work_id,NULL AS approved_minor,NULL AS paid_minor FROM flags f JOIN invoices i ON i.id=f.invoice_id`
    : query.view === "exposure" ? `SELECT e.id,${common},e.occurred_at AS date,'Recorded flag' AS status,e.event_type AS label,e.source_decision AS detail,e.amount_minor,e.currency,e.invoice_line_id AS line_id,e.work_order_id AS work_id,NULL AS approved_minor,NULL AS paid_minor FROM exposure e JOIN invoices i ON i.id=e.invoice_id`
    : `SELECT i.id,${common},i.invoice_date AS date,i.status,NULL AS label,NULL AS detail,i.total_minor AS amount_minor,i.currency,NULL AS line_id,NULL AS work_id,i.approved_for_payment_minor AS approved_minor,i.paid_amount_minor AS paid_minor FROM invoices i${query.view === "review" ? " WHERE EXISTS (SELECT 1 FROM flags f WHERE f.invoice_id=i.id)" : ""}`;
  const { limit, offset } = dashboardPageBounds(query);
  const result = await driver.query({ sql: `${ctes},selected AS (${selected}),total AS (SELECT COUNT(*) AS total_count FROM selected),visible AS (SELECT * FROM selected ORDER BY ${instant("date")} DESC,id ${binary} LIMIT ${bind(limit)} OFFSET ${bind(offset)}) SELECT v.*,c.*,t.total_count FROM counts c CROSS JOIN total t LEFT JOIN visible v ON 1=1 ORDER BY ${instant("v.date")} DESC,v.id ${binary}`, params });
  const first = result.rows[0] ?? {}, optional = (r: SqlRow, k: string) => r[k] == null ? undefined : String(r[k]);
  const rows: InvoiceQueueRow[] = result.rows.filter(r => r.id != null).map(r => ({ id: String(r.id), invoiceId: String(r.invoice_id), number: String(r.vendor_invoice_number), vendorId: optional(r, "valid_vendor_id"), vendorName: optional(r, "vendor_name"), date: new Date(String(r.date)).toISOString(), status: String(r.status), label: optional(r, "label"), detail: optional(r, "detail"), lineId: optional(r, "line_id"), workId: optional(r, "work_id"), amount: { amountMinor: Number(r.amount_minor), currency: String(r.currency) }, approved: r.approved_minor == null ? undefined : { amountMinor: Number(r.approved_minor), currency: String(r.currency) }, paid: r.paid_minor == null ? undefined : { amountMinor: Number(r.paid_minor), currency: String(r.currency) }, openFlags: Number(r.open_flags) }));
  const totalCount = Number(first.total_count ?? 0);
  return { rows, totalCount, nextOffset: offset + limit < totalCount ? offset + limit : undefined, counts: { invoices: Number(first.invoice_count ?? 0), review: Number(first.review_count ?? 0), flags: Number(first.flag_count ?? 0), exposure: Number(first.exposure_count ?? 0) }, exposureAmount: { amountMinor: Number(first.exposure_minor ?? 0), currency: query.currency } };
}
