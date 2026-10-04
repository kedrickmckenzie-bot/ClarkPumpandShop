CREATE UNIQUE INDEX "uidx_ops_assignments_org_id_work" ON "ops_work_order_assignments" USING btree ("organization_id","id","work_order_id");
--> statement-breakpoint
CREATE TABLE "ops_internal_schedules" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"work_order_id" text NOT NULL,
	"assignment_id" text NOT NULL,
	"revision" integer NOT NULL,
	"precision" text NOT NULL,
	"planning_zone" text NOT NULL,
	"week" text NOT NULL,
	"day" text,
	"starts_at" text,
	"ends_at" text,
	"entry_zone" text,
	"local_start" text,
	"disambiguation" text,
	"duration_minutes" integer,
	"tentative" integer DEFAULT 0 NOT NULL,
	"review_reason" text,
	"supersedes_id" text,
	"recorded_by" text NOT NULL,
	"recorded_by_name" text NOT NULL,
	"recorded_at" text NOT NULL,
	CONSTRAINT "chk_ops_internal_schedule_shape" CHECK ("ops_internal_schedules"."revision" > 0 AND "ops_internal_schedules"."tentative" IN (0,1) AND ("ops_internal_schedules"."duration_minutes" IS NULL OR "ops_internal_schedules"."duration_minutes" BETWEEN 1 AND 1440) AND ("ops_internal_schedules"."precision" IN ('week','removed') AND "ops_internal_schedules"."day" IS NULL AND "ops_internal_schedules"."starts_at" IS NULL AND "ops_internal_schedules"."ends_at" IS NULL OR "ops_internal_schedules"."precision"='day' AND "ops_internal_schedules"."day" IS NOT NULL AND "ops_internal_schedules"."starts_at" IS NULL AND "ops_internal_schedules"."ends_at" IS NULL OR "ops_internal_schedules"."precision"='appointment' AND "ops_internal_schedules"."day" IS NOT NULL AND "ops_internal_schedules"."starts_at" IS NOT NULL AND "ops_internal_schedules"."entry_zone" IS NOT NULL AND "ops_internal_schedules"."local_start" IS NOT NULL AND ("ops_internal_schedules"."ends_at" IS NULL OR "ops_internal_schedules"."ends_at" > "ops_internal_schedules"."starts_at")))
);
--> statement-breakpoint
ALTER TABLE "ops_work_orders" ADD COLUMN "internal_schedule_id" text;--> statement-breakpoint
ALTER TABLE "ops_work_orders" ADD COLUMN "target_completion_at" text;--> statement-breakpoint
ALTER TABLE "ops_work_orders" ADD COLUMN "target_completion_source" text;--> statement-breakpoint
ALTER TABLE "ops_internal_schedules" ADD CONSTRAINT "fk_ops_internal_schedule_assignment" FOREIGN KEY ("organization_id","assignment_id","work_order_id") REFERENCES "public"."ops_work_order_assignments"("organization_id","id","work_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_internal_schedules_org_work_revision" ON "ops_internal_schedules" USING btree ("organization_id","work_order_id","revision");--> statement-breakpoint
CREATE INDEX "idx_ops_internal_schedules_org_week_day" ON "ops_internal_schedules" USING btree ("organization_id","week","day","id");--> statement-breakpoint
