ALTER TABLE "ops_manufacturer_warranties" ADD COLUMN "travel_coverage" text;--> statement-breakpoint
ALTER TABLE "ops_warranty_cases" ADD COLUMN "owner_name" text;--> statement-breakpoint
ALTER TABLE "ops_warranty_cases" ADD COLUMN "next_action" text;--> statement-breakpoint
ALTER TABLE "ops_warranty_cases" ADD COLUMN "follow_up_on" text;