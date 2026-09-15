/** Requires an organization-filtered scoped_stores CTE. An invoice is visible only in full. */
export const visibleInvoiceSql = `i.organization_id IN (SELECT organization_id FROM scoped_stores)
  AND EXISTS (SELECT 1 FROM ops_invoice_lines l JOIN ops_invoice_line_allocations a ON a.organization_id=l.organization_id AND a.invoice_line_id=l.id WHERE l.organization_id=i.organization_id AND l.invoice_id=i.id)
  AND NOT EXISTS (SELECT 1 FROM ops_invoice_lines l JOIN ops_invoice_line_allocations a ON a.organization_id=l.organization_id AND a.invoice_line_id=l.id WHERE l.organization_id=i.organization_id AND l.invoice_id=i.id AND a.store_id NOT IN (SELECT id FROM scoped_stores))`;
