-- Repair the fictional Northline V2 return-visit issuance before the V3 seed
-- runs. V2 reused revision 1 for a second issuance on the same work order, so
-- SQLite could ignore that issuance under the unique revision index. Remove
-- only the affected fictional records and the V2 marker; the idempotent V3
-- bootstrap restores the corrected revision 2 chain without touching any
-- non-demo tenant.
DELETE FROM `ops_vendor_responses`
WHERE `organization_id` = 'org-northline-demo'
  AND `id` = 'response-northline-109-return';
--> statement-breakpoint
DELETE FROM `ops_work_order_issuances`
WHERE `organization_id` = 'org-northline-demo'
  AND `id` = 'issuance-northline-109-return-r1';
--> statement-breakpoint
DELETE FROM `ops_idempotency_keys`
WHERE `organization_id` = 'org-northline-demo'
  AND `key` = 'northline-ops-2026-08-10-v2';
