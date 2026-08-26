CREATE TABLE "ops_notification_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"event_key" text NOT NULL,
	"email_enabled" boolean DEFAULT false NOT NULL,
	"recipient_role" text NOT NULL,
	"updated_by_membership_id" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_ops_notification_rules_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "chk_ops_notification_rules_event" CHECK ("ops_notification_rules"."event_key" IN ('vendor_response_received', 'workflow_task_escalated', 'follow_up_created', 'vendor_reminder_created')),
	CONSTRAINT "chk_ops_notification_rules_role" CHECK ("ops_notification_rules"."recipient_role" IN ('facilities_admin', 'regional_manager', 'executive', 'finance_reviewer'))
);
--> statement-breakpoint
ALTER TABLE "ops_notification_rules" ADD CONSTRAINT "fk_ops_notification_rules_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_notification_rules_org_event" ON "ops_notification_rules" USING btree ("organization_id","event_key");--> statement-breakpoint
CREATE INDEX "idx_ops_notification_rules_org_role" ON "ops_notification_rules" USING btree ("organization_id","recipient_role");