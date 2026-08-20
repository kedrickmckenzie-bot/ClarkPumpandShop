ALTER TABLE "ops_entity_files" DROP CONSTRAINT "chk_ops_entity_files_type";--> statement-breakpoint
ALTER TABLE "ops_invoices" ADD COLUMN "submitted_by_membership_id" text;--> statement-breakpoint
ALTER TABLE "ops_warranty_coverage_lines" ADD COLUMN "start_date" date;--> statement-breakpoint
ALTER TABLE "ops_warranty_coverage_lines" ADD COLUMN "end_date" date;--> statement-breakpoint
ALTER TABLE "ops_warranty_rules" ADD COLUMN "quote_id" text;--> statement-breakpoint
ALTER TABLE "ops_warranty_rules" ADD COLUMN "authorization_id" text;--> statement-breakpoint
ALTER TABLE "ops_entity_files" ADD CONSTRAINT "chk_ops_entity_files_type" CHECK ("ops_entity_files"."entity_type" IN ('request', 'work_order', 'visit', 'asset', 'invoice_reference', 'invoice'));