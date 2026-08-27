CREATE TABLE "ops_vendor_compliance_alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"vendor_id" text NOT NULL,
	"document_id" text NOT NULL,
	"stage" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"reminder_id" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_ops_vendor_compliance_alerts_org_id" UNIQUE("organization_id","id")
);
--> statement-breakpoint
CREATE TABLE "ops_work_order_visit_holds" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"work_order_id" text NOT NULL,
	"posture" text NOT NULL,
	"status" text NOT NULL,
	"internal_review_threshold_minor" bigint,
	"currency" text,
	"deadline_at" timestamp with time zone NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"claimed_visit_id" text,
	"claimed_vendor_id" text,
	"claimed_at" timestamp with time zone,
	"created_by_membership_id" text,
	"created_by_name" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_ops_work_order_visit_holds_org_id" UNIQUE("organization_id","id")
);
--> statement-breakpoint
ALTER TABLE "ops_site_visit_work_orders" DROP CONSTRAINT "chk_ops_site_visit_work_outcome";--> statement-breakpoint
ALTER TABLE "ops_notification_rules" DROP CONSTRAINT "chk_ops_notification_rules_event";--> statement-breakpoint
ALTER TABLE "ops_site_visit_work_orders" ADD COLUMN "selection_source" text DEFAULT 'assigned_work' NOT NULL;--> statement-breakpoint
ALTER TABLE "ops_site_visit_work_orders" ADD COLUMN "work_order_hold_id" text;--> statement-breakpoint
ALTER TABLE "ops_site_visit_work_orders" ADD COLUMN "vendor_follow_up_timing" text;--> statement-breakpoint
ALTER TABLE "ops_work_order_visit_holds" ADD CONSTRAINT "fk_ops_work_order_visit_holds_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_work_order_visit_holds" ADD CONSTRAINT "fk_ops_work_order_visit_holds_work" FOREIGN KEY ("organization_id","work_order_id") REFERENCES "public"."ops_work_orders"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_vendor_compliance_alert_doc_stage" ON "ops_vendor_compliance_alerts" USING btree ("organization_id","document_id","stage");--> statement-breakpoint
CREATE INDEX "idx_ops_vendor_compliance_alert_org_vendor_created" ON "ops_vendor_compliance_alerts" USING btree ("organization_id","vendor_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_work_order_visit_holds_org_work" ON "ops_work_order_visit_holds" USING btree ("organization_id","work_order_id");--> statement-breakpoint
CREATE INDEX "idx_ops_work_order_visit_holds_org_status_deadline" ON "ops_work_order_visit_holds" USING btree ("organization_id","status","deadline_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_site_visit_work_org_hold_claim" ON "ops_site_visit_work_orders" USING btree ("organization_id","work_order_hold_id") WHERE "ops_site_visit_work_orders"."work_order_hold_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "ops_site_visit_work_orders" ADD CONSTRAINT "chk_ops_site_visit_work_outcome" CHECK ("ops_site_visit_work_orders"."outcome" IS NULL OR "ops_site_visit_work_orders"."outcome" IN ('completed', 'temporary_repair', 'diagnosis_only', 'quote_required', 'parts_required', 'return_visit_required', 'no_issue_found', 'store_access_unavailable', 'work_not_authorized', 'not_addressed'));
--> statement-breakpoint
ALTER TABLE "ops_notification_rules" ADD CONSTRAINT "chk_ops_notification_rules_event" CHECK ("ops_notification_rules"."event_key" IN ('vendor_response_received', 'vendor_commitment_received', 'workflow_task_escalated', 'follow_up_created', 'vendor_reminder_created', 'held_work_claimed', 'held_work_outcomes_recorded', 'vendor_compliance_due'));
