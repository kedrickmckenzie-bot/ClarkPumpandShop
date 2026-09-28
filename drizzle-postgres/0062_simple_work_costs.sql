ALTER TABLE "ops_cost_lines" ADD COLUMN "provider_type" text;--> statement-breakpoint
ALTER TABLE "ops_cost_lines" ADD COLUMN "vendor_id" text;--> statement-breakpoint
ALTER TABLE "ops_cost_lines" ADD COLUMN "invoice_id" text;--> statement-breakpoint
ALTER TABLE "ops_cost_lines" ADD COLUMN "cost_group_id" text;--> statement-breakpoint
ALTER TABLE "ops_cost_lines" ADD COLUMN "reverses_cost_id" text;
