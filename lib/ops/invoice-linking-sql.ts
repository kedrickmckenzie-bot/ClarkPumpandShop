/** Aliases are fixed by callers; no user values enter this SQL fragment. */
export function supportedInvoiceAllocationSql(pg: boolean, invoice: string, line: string, allocation: string) {
  const payload = pg ? "CASE WHEN src.payload_json IS JSON OBJECT THEN CAST(src.payload_json AS JSONB) ELSE '{}'::jsonb END" : "CASE WHEN json_valid(src.payload_json) THEN src.payload_json ELSE '{}' END";
  const nonMaintenance = pg ? `(${payload})->'delivery'->>'kind'='bill' AND (${payload})->'delivery'->'maintenance'='false'::jsonb` : `json_extract(${payload},'$.delivery.kind')='bill' AND json_type(${payload},'$.delivery.maintenance')='false'`;
  return `${invoice}.status<>'void'
    AND NOT EXISTS (SELECT 1 FROM ops_accounting_invoice_sources src WHERE src.organization_id=${invoice}.organization_id AND src.invoice_id=${invoice}.id AND ${nonMaintenance})
    AND NOT EXISTS (SELECT 1 FROM ops_invoice_lines il WHERE il.organization_id=${invoice}.organization_id AND il.invoice_id=${invoice}.id AND il.currency<>${invoice}.currency)
    AND COALESCE((SELECT SUM(il.line_amount_minor) FROM ops_invoice_lines il WHERE il.organization_id=${invoice}.organization_id AND il.invoice_id=${invoice}.id),0)=${invoice}.total_minor
    AND ${allocation}.confirmed_at IS NOT NULL AND ${allocation}.amount_minor>0 AND ${allocation}.currency=${invoice}.currency
    AND (SELECT SUM(split.amount_minor) FROM ops_invoice_line_allocations split WHERE split.organization_id=${allocation}.organization_id AND split.invoice_line_id=${line}.id AND split.confirmed_at IS NOT NULL AND split.amount_minor>0 AND split.currency=${invoice}.currency)<=${line}.line_amount_minor`;
}
