CREATE TABLE "ops_follow_up_preferences" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"cadence_hours" integer NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "chk_ops_follow_up_cadence" CHECK ("ops_follow_up_preferences"."cadence_hours" IN (0,24,48,168))
);
--> statement-breakpoint
CREATE TABLE "ops_inbound_emails" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"message_key" text NOT NULL,
	"sender" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"reported_date" text,
	"received_at" text NOT NULL,
	"status" text NOT NULL,
	"work_order_id" text,
	"request_id" text,
	CONSTRAINT "chk_ops_email_status" CHECK ("ops_inbound_emails"."status" IN ('needs_review','linked','dismissed'))
);
--> statement-breakpoint
ALTER TABLE "ops_follow_up_preferences" ADD CONSTRAINT "ops_follow_up_preferences_organization_id_ops_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_inbound_emails" ADD CONSTRAINT "ops_inbound_emails_organization_id_ops_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_inbound_emails" ADD CONSTRAINT "ops_inbound_emails_organization_id_work_order_id_ops_work_orders_organization_id_id_fk" FOREIGN KEY ("organization_id","work_order_id") REFERENCES "public"."ops_work_orders"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_inbound_emails" ADD CONSTRAINT "ops_inbound_emails_organization_id_request_id_ops_requests_organization_id_id_fk" FOREIGN KEY ("organization_id","request_id") REFERENCES "public"."ops_requests"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ops_follow_up_preference_org_date" ON "ops_follow_up_preferences" USING btree ("organization_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ops_email_org_key" ON "ops_inbound_emails" USING btree ("organization_id","message_key");--> statement-breakpoint
CREATE INDEX "idx_ops_email_org_status_date" ON "ops_inbound_emails" USING btree ("organization_id","status","received_at","id");--> statement-breakpoint
CREATE INDEX "idx_ops_email_org_work_date" ON "ops_inbound_emails" USING btree ("organization_id","work_order_id","received_at","id");
--> statement-breakpoint
ALTER TABLE "ops_entity_files" DROP CONSTRAINT "chk_ops_entity_files_type";
--> statement-breakpoint
ALTER TABLE "ops_entity_files" ADD CONSTRAINT "chk_ops_entity_files_type" CHECK (entity_type IN ('inbound_email', 'request', 'work_order', 'visit', 'asset', 'invoice_reference', 'invoice', 'estimate_proposal'));
