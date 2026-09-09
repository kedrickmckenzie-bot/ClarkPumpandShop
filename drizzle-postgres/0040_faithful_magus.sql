ALTER TABLE "ops_requests" DROP CONSTRAINT "chk_ops_requests_status";--> statement-breakpoint
ALTER TABLE "ops_requests" ADD COLUMN "acknowledged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ops_requests" ADD COLUMN "acknowledged_by_actor_type" text;--> statement-breakpoint
ALTER TABLE "ops_requests" ADD COLUMN "acknowledged_by_actor_id" text;--> statement-breakpoint
ALTER TABLE "ops_requests" ADD COLUMN "acknowledged_by_actor_name" text;--> statement-breakpoint
ALTER TABLE "ops_requests" ADD COLUMN "linked_work_order_id" text;--> statement-breakpoint
ALTER TABLE "ops_requests" ADD COLUMN "linked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ops_requests" ADD COLUMN "linked_by_actor_type" text;--> statement-breakpoint
ALTER TABLE "ops_requests" ADD COLUMN "linked_by_actor_id" text;--> statement-breakpoint
ALTER TABLE "ops_requests" ADD COLUMN "linked_by_actor_name" text;--> statement-breakpoint
ALTER TABLE "ops_requests" ADD CONSTRAINT "fk_ops_requests_linked_work" FOREIGN KEY ("organization_id","linked_work_order_id") REFERENCES "public"."ops_work_orders"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_requests" ADD CONSTRAINT "chk_ops_requests_status" CHECK ("ops_requests"."status" IN ('submitted', 'under_review', 'acknowledged', 'converted', 'closed'));