import type { DashboardContext } from "./dashboard-context";
import type { OrganizationScope } from "./repository";
import type { OpsSqlDriver } from "./sql-driver";
import { scopeWhere } from "./sql-scope";
import { visibleInvoiceSql } from "./invoice-scope-sql";

export async function queryDashboardContext(driver: OpsSqlDriver, scope: OrganizationScope): Promise<DashboardContext> {
  const params: unknown[] = [];
  const source = `WITH scoped_stores AS (SELECT s.id,s.organization_id,s.store_number FROM ops_stores s WHERE ${scopeWhere(scope, "s", params)})`;
  const binary = driver.dialect === "postgres" ? 'COLLATE "C"' : "COLLATE BINARY";
  const timestamp = driver.dialect === "postgres" ? "CAST(e.detected_at AS TIMESTAMPTZ)" : "julianday(e.detected_at)";
  const [stores, invoices] = await Promise.all([
    driver.query({ sql: `${source} SELECT id,store_number FROM scoped_stores ORDER BY store_number ${binary},id ${binary} LIMIT 1`, params }),
    driver.query({ sql: `${source} SELECT i.id,i.vendor_invoice_number,i.status,i.total_minor,i.currency,COALESCE(v.name,'Unknown vendor') AS vendor_name
      FROM ops_invoices i LEFT JOIN ops_vendors v ON v.organization_id=i.organization_id AND v.id=i.vendor_id
      WHERE ${visibleInvoiceSql} AND EXISTS (SELECT 1 FROM ops_invoice_exceptions e WHERE e.organization_id=i.organization_id AND e.invoice_id=i.id AND e.status='open')
      ORDER BY (SELECT MIN(${timestamp}) FROM ops_invoice_exceptions e WHERE e.organization_id=i.organization_id AND e.invoice_id=i.id AND e.status='open'),i.id ${binary} LIMIT 1`, params }),
  ]);
  const store = stores.rows[0], invoice = invoices.rows[0];
  return {
    store: store ? { id: String(store.id), storeNumber: String(store.store_number) } : undefined,
    invoice: invoice ? { id: String(invoice.id), number: String(invoice.vendor_invoice_number), status: String(invoice.status) as NonNullable<DashboardContext["invoice"]>["status"], vendorName: String(invoice.vendor_name), total: { amountMinor: Number(invoice.total_minor), currency: String(invoice.currency) } } : undefined,
  };
}
