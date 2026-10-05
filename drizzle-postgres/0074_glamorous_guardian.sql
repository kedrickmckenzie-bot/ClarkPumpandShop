ALTER TABLE "ops_internal_schedules" ADD COLUMN "stop_order" integer;--> statement-breakpoint
ALTER TABLE "ops_work_orders" ADD COLUMN "technician_notes" text;--> statement-breakpoint
ALTER TABLE "ops_work_orders" ADD COLUMN "estimated_minutes" integer;--> statement-breakpoint
ALTER TABLE "ops_work_orders" ADD COLUMN "confirmation_delay" text;