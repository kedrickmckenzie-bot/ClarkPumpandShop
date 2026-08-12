-- One-time replacement of the fictional Northline preview tenant. This removes
-- only the hard-coded demo organization so the clean-slate, source-coherent V2
-- fixture can seed after deployment. It does not touch any other tenant.
DELETE FROM `ops_entity_files` WHERE `organization_id` = 'org-northline-demo';
DELETE FROM `ops_files` WHERE `organization_id` = 'org-northline-demo';
DELETE FROM `ops_visit_evidence` WHERE `organization_id` = 'org-northline-demo';
DELETE FROM `ops_follow_ups` WHERE `organization_id` = 'org-northline-demo';
DELETE FROM `ops_exceptions` WHERE `organization_id` = 'org-northline-demo';
DELETE FROM `ops_invoice_allocations` WHERE `organization_id` = 'org-northline-demo';
DELETE FROM `ops_invoice_references` WHERE `organization_id` = 'org-northline-demo';
DELETE FROM `ops_cost_lines` WHERE `organization_id` = 'org-northline-demo';
DELETE FROM `ops_pm_occurrences` WHERE `organization_id` = 'org-northline-demo';
DELETE FROM `ops_pm_plans` WHERE `organization_id` = 'org-northline-demo';
DELETE FROM `ops_asset_components` WHERE `organization_id` = 'org-northline-demo';
DELETE FROM `ops_assets` WHERE `organization_id` = 'org-northline-demo';
DELETE FROM `ops_vendor_responses` WHERE `organization_id` = 'org-northline-demo';
DELETE FROM `ops_work_order_issuances` WHERE `organization_id` = 'org-northline-demo';
DELETE FROM `ops_visit_sessions` WHERE `organization_id` = 'org-northline-demo';
DELETE FROM `ops_work_order_assignments` WHERE `organization_id` = 'org-northline-demo';
DELETE FROM `ops_work_orders` WHERE `organization_id` = 'org-northline-demo';
DELETE FROM `ops_requests` WHERE `organization_id` = 'org-northline-demo';
DELETE FROM `ops_vendor_coverage` WHERE `organization_id` = 'org-northline-demo';
DELETE FROM `ops_vendor_specialties` WHERE `organization_id` = 'org-northline-demo';
DELETE FROM `ops_vendors` WHERE `organization_id` = 'org-northline-demo';
DELETE FROM `ops_scope_grants` WHERE `organization_id` = 'org-northline-demo';
DELETE FROM `ops_memberships` WHERE `organization_id` = 'org-northline-demo';
DELETE FROM `ops_public_tokens` WHERE `organization_id` = 'org-northline-demo';
DELETE FROM `ops_outbox_messages` WHERE `organization_id` = 'org-northline-demo';
DELETE FROM `ops_audit_events` WHERE `organization_id` = 'org-northline-demo';
DELETE FROM `ops_work_order_counters` WHERE `organization_id` = 'org-northline-demo';
DELETE FROM `ops_idempotency_keys` WHERE `organization_id` = 'org-northline-demo';
DELETE FROM `ops_taxonomy_nodes` WHERE `organization_id` = 'org-northline-demo';
DELETE FROM `ops_stores` WHERE `organization_id` = 'org-northline-demo';
DELETE FROM `ops_regions` WHERE `organization_id` = 'org-northline-demo';
DELETE FROM `ops_divisions` WHERE `organization_id` = 'org-northline-demo';
DELETE FROM `ops_organizations` WHERE `id` = 'org-northline-demo';
