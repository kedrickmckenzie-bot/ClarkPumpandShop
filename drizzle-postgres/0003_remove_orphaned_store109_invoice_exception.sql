-- The unmatched invoice has no confirmed work-order link, so it must not also
-- appear as an amount exception on an unrelated service record.
DELETE FROM "ops_exceptions"
WHERE "organization_id" = 'org-northline-demo'
  AND "id" = 'exception-invoice-northline-109-above-authorization';
