CREATE TABLE "ops_report_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"schedule_id" text NOT NULL,
	"report_id" text NOT NULL,
	"options_json" text NOT NULL,
	"period_label" text NOT NULL,
	"run_at" text NOT NULL,
	"created_at" text NOT NULL,
	"delivery_status" text NOT NULL,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"delivered_at" text
);
--> statement-breakpoint
CREATE TABLE "ops_report_schedules" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"report_id" text NOT NULL,
	"title" text NOT NULL,
	"options_json" text NOT NULL,
	"frequency" text NOT NULL,
	"weekday" integer,
	"month_day" integer,
	"send_hour" integer NOT NULL,
	"time_zone" text NOT NULL,
	"recipients_json" text NOT NULL,
	"status" text NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_by_membership_id" text,
	"created_by_name" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"next_run_at" text,
	"last_run_at" text,
	CONSTRAINT "ck_ops_report_schedules_frequency" CHECK ("ops_report_schedules"."frequency" IN ('weekly','monthly')),
	CONSTRAINT "ck_ops_report_schedules_status" CHECK ("ops_report_schedules"."status" IN ('active','paused','removed'))
);
--> statement-breakpoint
ALTER TABLE "ops_report_runs" ADD CONSTRAINT "ops_report_runs_organization_id_ops_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_report_runs" ADD CONSTRAINT "ops_report_runs_schedule_id_ops_report_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."ops_report_schedules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_report_schedules" ADD CONSTRAINT "ops_report_schedules_organization_id_ops_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ops_report_runs_org" ON "ops_report_runs" USING btree ("organization_id","run_at");--> statement-breakpoint
CREATE INDEX "idx_ops_report_runs_schedule" ON "ops_report_runs" USING btree ("organization_id","schedule_id","run_at");--> statement-breakpoint
CREATE INDEX "idx_ops_report_schedules_org" ON "ops_report_schedules" USING btree ("organization_id","status","created_at");--> statement-breakpoint
CREATE INDEX "idx_ops_report_schedules_due" ON "ops_report_schedules" USING btree ("status","next_run_at");