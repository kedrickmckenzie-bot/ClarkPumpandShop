import type { OrganizationScope } from "./repository";
import type { OpsSqlDriver } from "./sql-driver";
import { dashboardPageBounds } from "./dashboard-query";
import type { InvoiceIntakeQuery, InvoiceIntakePage, InvoiceIntakeChecks } from "./invoice-intake-query";
export async function queryInvoiceIntakeChecks(driver: OpsSqlDriver, org: string, workId: string, vendorId: string, number: string): Promise<InvoiceIntakeChecks> {
  const pg = driver.dialect === "postgres", binary = pg ? 'COLLATE "C"' : "COLLATE BINARY";
  const [duplicate, prior, warranty] = await Promise.all([
    driver.query({ sql: "SELECT id FROM ops_invoices WHERE organization_id=? AND vendor_id=? AND LOWER(TRIM(vendor_invoice_number))=LOWER(TRIM(?)) LIMIT 1", params: [org, vendorId, number] }),
    driver.query({ sql: `SELECT i.id,i.vendor_invoice_number,i.invoice_date FROM ops_invoices i WHERE i.organization_id=? AND LOWER(TRIM(i.vendor_invoice_number))<>LOWER(TRIM(?)) AND EXISTS (SELECT 1 FROM ops_invoice_lines l JOIN ops_invoice_line_allocations a ON a.organization_id=l.organization_id AND a.invoice_line_id=l.id WHERE l.organization_id=i.organization_id AND l.invoice_id=i.id AND a.work_order_id=?) ORDER BY i.invoice_date DESC,i.id ${binary} DESC LIMIT 1`, params: [org, number, workId] }),
    driver.query({ sql: `SELECT id,coverage_decision,customer_charge_status FROM ops_warranty_cases WHERE organization_id=? AND work_order_id=? AND invoice_hold=${pg ? "true" : "1"} AND closed_at IS NULL ORDER BY ${pg ? "CAST(created_at AS TIMESTAMPTZ)" : "julianday(created_at)"} DESC,id ${binary} DESC LIMIT 1`, params: [org, workId] }),
  ]);
  const p = prior.rows[0], w = warranty.rows[0];
  return { duplicateNumber: duplicate.rows.length > 0, priorInvoice: p ? { id: String(p.id), vendorInvoiceNumber: String(p.vendor_invoice_number), invoiceDate: new Date(String(p.invoice_date)).toISOString().slice(0,10) } : undefined, warrantyHold: w ? { id: String(w.id), coverageDecision: String(w.coverage_decision) as NonNullable<InvoiceIntakeChecks["warrantyHold"]>["coverageDecision"], customerChargeStatus: String(w.customer_charge_status) as NonNullable<InvoiceIntakeChecks["warrantyHold"]>["customerChargeStatus"] } : undefined };
}
export async function queryInvoiceIntake(driver: OpsSqlDriver, scope: OrganizationScope, q: InvoiceIntakeQuery): Promise<InvoiceIntakePage> {
  if (scope.storeIds !== undefined || scope.regionIds !== undefined) return { items: [], totalCount: 0 };
  const params: unknown[] = [scope.organizationId], binary = driver.dialect === "postgres" ? 'COLLATE "C"' : "COLLATE BINARY";
  let source: string;
  if (q.kind === "work") source = "SELECT w.id,w.number AS label,'Store '||s.store_number||' · '||w.problem AS detail FROM ops_work_orders w JOIN ops_stores s ON s.organization_id=w.organization_id AND s.id=w.store_id WHERE w.organization_id=? AND w.status<>'cancelled'";
  else if (q.kind === "vendor") source = "SELECT v.id,v.name AS label,'Approved vendor' AS detail FROM ops_vendors v WHERE v.organization_id=? AND v.status<>'inactive'";
  else { source = "SELECT c.id,c.source_agreement_reference AS label,'Version '||CAST(c.version AS TEXT) AS detail FROM ops_contract_versions c JOIN ops_vendors v ON v.organization_id=c.organization_id AND v.id=c.vendor_id AND v.status<>'inactive' WHERE c.organization_id=? AND c.vendor_id=? AND c.status='active'"; params.push(q.vendorId ?? ""); }
  const search = q.search ? " WHERE LOWER(label||' '||detail) LIKE ? ESCAPE '\\'" : "";
  if (q.search) params.push(`%${q.search.toLowerCase().replace(/[\\%_]/g, c => `\\${c}`)}%`);
  const { limit, offset } = dashboardPageBounds(q); params.push(limit, offset);
  const result = await driver.query({ sql: `WITH source AS (${source}),selected AS (SELECT * FROM source${search}),total AS (SELECT COUNT(*) AS total_count FROM selected),visible AS (SELECT * FROM selected ORDER BY label ${binary},id ${binary} LIMIT ? OFFSET ?) SELECT v.*,t.total_count FROM total t LEFT JOIN visible v ON 1=1 ORDER BY v.label ${binary},v.id ${binary}`, params });
  const totalCount = Number(result.rows[0]?.total_count ?? 0);
  return { items: result.rows.filter(r => r.id != null).map(r => ({ id: String(r.id), label: String(r.label), detail: String(r.detail) })), totalCount, nextOffset: offset + limit < totalCount ? offset + limit : undefined };
}
