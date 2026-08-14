ALTER TABLE "ops_work_orders" ADD COLUMN "repair_estimate_amount_minor" bigint;--> statement-breakpoint
ALTER TABLE "ops_work_orders" ADD COLUMN "repair_estimate_currency" text;--> statement-breakpoint
ALTER TABLE "ops_work_orders" ADD COLUMN "estimated_service_extension_months" integer;--> statement-breakpoint
ALTER TABLE "ops_work_orders" ADD CONSTRAINT "chk_ops_work_orders_repair_estimate" CHECK ("ops_work_orders"."repair_estimate_amount_minor" IS NULL OR "ops_work_orders"."repair_estimate_amount_minor" BETWEEN 0 AND 9007199254740991);--> statement-breakpoint
ALTER TABLE "ops_work_orders" ADD CONSTRAINT "chk_ops_work_orders_repair_estimate_money" CHECK (("ops_work_orders"."repair_estimate_amount_minor" IS NULL) = ("ops_work_orders"."repair_estimate_currency" IS NULL));--> statement-breakpoint
ALTER TABLE "ops_work_orders" ADD CONSTRAINT "chk_ops_work_orders_service_extension" CHECK ("ops_work_orders"."estimated_service_extension_months" IS NULL OR "ops_work_orders"."estimated_service_extension_months" BETWEEN 1 AND 1200);--> statement-breakpoint
-- One-time refresh of only the fictional presentation tenant. The v5 seed
-- marker is written after the source-coherent fixture has been reinserted.
DELETE FROM "ops_entity_files" WHERE "organization_id" = 'org-northline-demo';--> statement-breakpoint
DELETE FROM "ops_files" WHERE "organization_id" = 'org-northline-demo';--> statement-breakpoint
DELETE FROM "ops_visit_evidence" WHERE "organization_id" = 'org-northline-demo';--> statement-breakpoint
DELETE FROM "ops_follow_ups" WHERE "organization_id" = 'org-northline-demo';--> statement-breakpoint
DELETE FROM "ops_exceptions" WHERE "organization_id" = 'org-northline-demo';--> statement-breakpoint
DELETE FROM "ops_invoice_allocations" WHERE "organization_id" = 'org-northline-demo';--> statement-breakpoint
DELETE FROM "ops_invoice_references" WHERE "organization_id" = 'org-northline-demo';--> statement-breakpoint
DELETE FROM "ops_cost_lines" WHERE "organization_id" = 'org-northline-demo';--> statement-breakpoint
DELETE FROM "ops_pm_occurrences" WHERE "organization_id" = 'org-northline-demo';--> statement-breakpoint
DELETE FROM "ops_pm_plans" WHERE "organization_id" = 'org-northline-demo';--> statement-breakpoint
DELETE FROM "ops_asset_components" WHERE "organization_id" = 'org-northline-demo';--> statement-breakpoint
DELETE FROM "ops_assets" WHERE "organization_id" = 'org-northline-demo';--> statement-breakpoint
DELETE FROM "ops_vendor_responses" WHERE "organization_id" = 'org-northline-demo';--> statement-breakpoint
DELETE FROM "ops_work_order_issuances" WHERE "organization_id" = 'org-northline-demo';--> statement-breakpoint
DELETE FROM "ops_visit_sessions" WHERE "organization_id" = 'org-northline-demo';--> statement-breakpoint
DELETE FROM "ops_work_order_assignments" WHERE "organization_id" = 'org-northline-demo';--> statement-breakpoint
DELETE FROM "ops_work_orders" WHERE "organization_id" = 'org-northline-demo';--> statement-breakpoint
DELETE FROM "ops_requests" WHERE "organization_id" = 'org-northline-demo';--> statement-breakpoint
DELETE FROM "ops_vendor_coverage" WHERE "organization_id" = 'org-northline-demo';--> statement-breakpoint
DELETE FROM "ops_vendor_specialties" WHERE "organization_id" = 'org-northline-demo';--> statement-breakpoint
DELETE FROM "ops_vendors" WHERE "organization_id" = 'org-northline-demo';--> statement-breakpoint
DELETE FROM "ops_scope_grants" WHERE "organization_id" = 'org-northline-demo';--> statement-breakpoint
DELETE FROM "ops_memberships" WHERE "organization_id" = 'org-northline-demo';--> statement-breakpoint
DELETE FROM "ops_public_tokens" WHERE "organization_id" = 'org-northline-demo';--> statement-breakpoint
DELETE FROM "ops_outbox_messages" WHERE "organization_id" = 'org-northline-demo';--> statement-breakpoint
DELETE FROM "ops_audit_events" WHERE "organization_id" = 'org-northline-demo';--> statement-breakpoint
DELETE FROM "ops_work_order_counters" WHERE "organization_id" = 'org-northline-demo';--> statement-breakpoint
DELETE FROM "ops_idempotency_keys" WHERE "organization_id" = 'org-northline-demo';--> statement-breakpoint
DELETE FROM "ops_taxonomy_nodes" WHERE "organization_id" = 'org-northline-demo';--> statement-breakpoint
DELETE FROM "ops_stores" WHERE "organization_id" = 'org-northline-demo';--> statement-breakpoint
DELETE FROM "ops_regions" WHERE "organization_id" = 'org-northline-demo';--> statement-breakpoint
DELETE FROM "ops_divisions" WHERE "organization_id" = 'org-northline-demo';--> statement-breakpoint
DELETE FROM "ops_organizations" WHERE "id" = 'org-northline-demo';
