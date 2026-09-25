ALTER TABLE "ops_manufacturer_warranties" ADD COLUMN "provider_kind" text DEFAULT 'manufacturer' NOT NULL;--> statement-breakpoint
ALTER TABLE "ops_manufacturer_warranties" ADD COLUMN "vendor_id" text;--> statement-breakpoint
ALTER TABLE "ops_manufacturer_warranties" ADD COLUMN "work_order_id" text;--> statement-breakpoint
ALTER TABLE "ops_manufacturer_warranties" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "ops_work_orders" ADD COLUMN "internal_review_threshold_minor" bigint;--> statement-breakpoint
ALTER TABLE "ops_work_orders" ADD COLUMN "internal_review_currency" text;