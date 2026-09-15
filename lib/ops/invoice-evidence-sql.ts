import type { OrganizationScope } from "./repository";
import { sqlJsonArrayText, type OpsSqlDriver } from "./sql-driver";
import { scopeWhere } from "./sql-scope";
import { dashboardPageBounds } from "./dashboard-query";
import { supportedInvoiceAllocationSql } from "./invoice-linking-sql";
import type { InvoiceEvidencePage, InvoiceEvidenceQuery } from "./invoice-evidence-query";
export async function queryInvoiceEvidence(driver: OpsSqlDriver, scope: OrganizationScope, q: InvoiceEvidenceQuery): Promise<InvoiceEvidencePage> {
    const pg = driver.dialect === "postgres", params: unknown[] = [], scoped = scopeWhere(scope, "s", params), bind = (v: unknown) => { params.push(v); return "?"; };
    const org = bind(scope.organizationId), legacyOrg = bind(scope.organizationId), binary = pg ? 'COLLATE "C"' : "COLLATE BINARY";
    const filters = [`a.currency=${bind(q.currency)}`];
    for (const [v, expr] of [[q.from, "a.invoice_date >="], [q.to, "a.invoice_date <="], [q.costMonth, "substr(CAST(a.invoice_date AS TEXT),1,7) ="], [q.store, "s.id ="], [q.region, "s.region_id ="], [q.category, "COALESCE(w.category_key,'unclassified') ="]])
        if (v)
            filters.push(`${expr} ${bind(v)}`);
    for (const [v, col] of [[q.asset, "w.asset_id"], [q.component, "w.component_id"]])
        if (v)
            filters.push(v === "unlinked" ? `${col} IS NULL` : `${col}=${bind(v)}`);
    if (q.path?.length) {
        const category = "lower(replace(wa.category_key,'_',' '))", includes = `lower(${sqlJsonArrayText(driver.dialect, "wa.group_path_json", 0)})=${category}`;
        const clauses = q.path.map((segment, index) => { const value = `CASE WHEN ${includes} THEN ${sqlJsonArrayText(driver.dialect, "wa.group_path_json", index)} ELSE ${index === 0 ? category : sqlJsonArrayText(driver.dialect, "wa.group_path_json", index - 1)} END`; return `${index === 0 ? `lower(${value})` : value}=${bind(index === 0 ? segment.toLowerCase() : segment)}`; });
        filters.push(`EXISTS (SELECT 1 FROM ops_assets wa WHERE wa.organization_id=w.organization_id AND wa.id=w.asset_id AND wa.store_id=w.store_id AND ${clauses.join(" AND ")})`);
    }
    if (q.search)
        filters.push(`LOWER(a.number||' '||w.number||' '||w.problem||' '||s.store_number) LIKE ${bind('%' + q.search.toLowerCase().replace(/[\\%_]/g, c => '\\' + c) + '%')} ESCAPE '\\'`);
    const { limit, offset } = dashboardPageBounds(q);
    const pageLimit = bind(limit), pageOffset = bind(offset);
    const labels: string[] = [];
    if (q.store)
        labels.push(`COALESCE((SELECT 'Store '||store_number||' · '||name FROM scoped_stores WHERE id=${bind(q.store)}),'Store unavailable') AS store_label`);
    if (q.region)
        labels.push(`COALESCE((SELECT name FROM ops_regions WHERE organization_id=${bind(scope.organizationId)} AND id=${bind(q.region)} AND id IN (SELECT region_id FROM scoped_stores)),'Region unavailable') AS region_label`);
    if (q.asset)
        labels.push(q.asset === "unlinked" ? "'Unlinked equipment' AS asset_label" : `COALESCE((SELECT a.name FROM ops_assets a JOIN scoped_stores s ON s.organization_id=a.organization_id AND s.id=a.store_id WHERE a.id=${bind(q.asset)}),'Equipment unavailable') AS asset_label`);
    if (q.component)
        labels.push(q.component === "unlinked" ? "'Unlinked component' AS component_label" : `COALESCE((SELECT c.name FROM ops_asset_components c JOIN ops_assets a ON a.organization_id=c.organization_id AND a.id=c.asset_id JOIN scoped_stores s ON s.organization_id=a.organization_id AND s.id=a.store_id WHERE c.id=${bind(q.component)}),'Component unavailable') AS component_label`);
    const result = await driver.query({ sql: `WITH scoped_stores AS MATERIALIZED (SELECT s.* FROM ops_stores s WHERE ${scoped}),
    invoices AS MATERIALIZED (SELECT * FROM ops_invoices WHERE organization_id=${org}),
    allocation_scope AS MATERIALIZED (SELECT l.invoice_id,COUNT(*) AS allocation_count,SUM(CASE WHEN s.id IS NULL OR w.id IS NULL OR w.store_id<>a.store_id THEN 1 ELSE 0 END) AS invalid_count FROM ops_invoice_lines l JOIN invoices i ON i.id=l.invoice_id AND i.organization_id=l.organization_id JOIN ops_invoice_line_allocations a ON a.organization_id=l.organization_id AND a.invoice_line_id=l.id LEFT JOIN scoped_stores s ON s.id=a.store_id AND s.organization_id=a.organization_id LEFT JOIN ops_work_orders w ON w.id=a.work_order_id AND w.organization_id=a.organization_id GROUP BY l.invoice_id),
    canonical AS (SELECT a.id,i.id AS invoice_id,i.organization_id,i.vendor_invoice_number AS number,i.invoice_date,a.amount_minor,a.currency,a.work_order_id,a.store_id,CASE WHEN sc.allocation_count>0 AND sc.invalid_count=0 THEN 1 ELSE 0 END AS full_access,1 AS canonical FROM invoices i JOIN ops_invoice_lines l ON l.organization_id=i.organization_id AND l.invoice_id=i.id JOIN ops_invoice_line_allocations a ON a.organization_id=l.organization_id AND a.invoice_line_id=l.id LEFT JOIN allocation_scope sc ON sc.invoice_id=i.id WHERE ${supportedInvoiceAllocationSql(pg, "i", "l", "a")}),
    legacy AS (SELECT a.id,i.id AS invoice_id,i.organization_id,i.invoice_number AS number,i.invoice_date,a.amount_minor,a.currency,a.work_order_id,NULL AS store_id,0 AS full_access,0 AS canonical FROM ops_invoice_references i JOIN ops_invoice_allocations a ON a.organization_id=i.organization_id AND a.invoice_reference_id=i.id WHERE i.organization_id=${legacyOrg} AND NOT EXISTS (SELECT 1 FROM invoices ci WHERE ci.id=i.id) AND i.match_status='confirmed' AND a.confirmed_at IS NOT NULL AND a.currency=i.currency AND (SELECT SUM(x.amount_minor) FROM ops_invoice_allocations x WHERE x.organization_id=i.organization_id AND x.invoice_reference_id=i.id AND x.confirmed_at IS NOT NULL AND x.currency=i.currency)=i.gross_amount_minor),
    allocations AS (SELECT * FROM canonical UNION ALL SELECT * FROM legacy),
    selected AS MATERIALIZED (SELECT a.*,w.number AS work_number,w.problem,s.id AS resolved_store_id,s.store_number,s.name AS store_name FROM allocations a JOIN ops_work_orders w ON w.organization_id=a.organization_id AND w.id=a.work_order_id JOIN scoped_stores s ON s.organization_id=w.organization_id AND s.id=w.store_id WHERE (a.store_id IS NULL OR a.store_id=s.id) AND ${filters.join(" AND ")}),
    total AS (SELECT COUNT(*) AS total_count,COALESCE(SUM(amount_minor),0) AS total_minor FROM selected),
    visible AS (SELECT * FROM selected ORDER BY invoice_date DESC,id ${binary} LIMIT ${pageLimit} OFFSET ${pageOffset}) SELECT v.*,t.total_count,t.total_minor${labels.length ? "," + labels.join(",") : ""} FROM total t LEFT JOIN visible v ON 1=1 ORDER BY v.invoice_date DESC,v.id ${binary}`, params });
    const totalCount = Number(result.rows[0]?.total_count ?? 0);
    return { filterLabels: ["store_label", "region_label", "asset_label", "component_label"].flatMap(k => result.rows[0]?.[k] != null ? [String(result.rows[0][k])] : []), totalCount, amountMinor: Number(result.rows[0]?.total_minor ?? 0), nextOffset: offset + limit < totalCount ? offset + limit : undefined, rows: result.rows.filter(r => r.id != null).map(r => ({ id: String(r.id), invoiceId: String(r.invoice_id), number: String(r.number), date: new Date(String(r.invoice_date)).toISOString().slice(0, 10), amountMinor: Number(r.amount_minor), workId: String(r.work_order_id), workNumber: String(r.work_number), problem: String(r.problem), storeId: String(r.resolved_store_id), storeNumber: String(r.store_number), storeName: String(r.store_name), href: Number(r.full_access) === 1 ? `/app/invoices/${r.invoice_id}?section=matches&match=${encodeURIComponent(String(r.id))}#allocation-${r.id}` : `/app/work-orders/${r.work_order_id}?view=cost` })) };
}
