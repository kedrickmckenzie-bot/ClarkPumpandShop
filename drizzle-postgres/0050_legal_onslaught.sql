CREATE TABLE "ops_compliance_schedules" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"store_id" text NOT NULL,
	"name" text NOT NULL,
	"instructions" text NOT NULL,
	"requirement_source" text NOT NULL,
	"evidence_label" text NOT NULL,
	"asset_id" text,
	"kind" text NOT NULL,
	"escalation_days" integer NOT NULL,
	"escalation_to" text NOT NULL,
	"first_due_date" text NOT NULL,
	"interval_unit" text NOT NULL,
	"interval_count" integer NOT NULL,
	"lead_days" integer NOT NULL,
	"handler" text NOT NULL,
	"membership_id" text,
	"vendor_id" text,
	"evidence_required" integer NOT NULL,
	"status" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "chk_ops_compliance_status" CHECK ("ops_compliance_schedules"."status" IN ('active','paused')),
	CONSTRAINT "chk_ops_compliance_handler" CHECK (("ops_compliance_schedules"."handler" = 'vendor' AND "ops_compliance_schedules"."vendor_id" IS NOT NULL AND "ops_compliance_schedules"."membership_id" IS NULL) OR ("ops_compliance_schedules"."handler" = 'internal' AND "ops_compliance_schedules"."membership_id" IS NOT NULL AND "ops_compliance_schedules"."vendor_id" IS NULL)),
	CONSTRAINT "chk_ops_compliance_interval" CHECK ("ops_compliance_schedules"."interval_unit" IN ('once','days','months') AND "ops_compliance_schedules"."interval_count" BETWEEN 1 AND 365 AND "ops_compliance_schedules"."lead_days" BETWEEN 0 AND 90 AND "ops_compliance_schedules"."evidence_required" IN (0,1))
);
--> statement-breakpoint
CREATE TABLE "ops_inspections" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"schedule_id" text NOT NULL,
	"store_id" text NOT NULL,
	"due_date" text NOT NULL,
	"status" text NOT NULL,
	"work_order_id" text,
	"corrective_work_order_id" text,
	"document_expires_on" text,
	"completed_at" text,
	"result_note" text,
	"version" integer NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "chk_ops_inspection_status" CHECK ("ops_inspections"."status" IN ('pending','performed','passed','action_needed'))
);
--> statement-breakpoint
ALTER TABLE "ops_compliance_schedules" ADD CONSTRAINT "ops_compliance_schedules_organization_id_store_id_ops_stores_organization_id_id_fk" FOREIGN KEY ("organization_id","store_id") REFERENCES "public"."ops_stores"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_compliance_schedules" ADD CONSTRAINT "ops_compliance_schedules_organization_id_vendor_id_ops_vendors_organization_id_id_fk" FOREIGN KEY ("organization_id","vendor_id") REFERENCES "public"."ops_vendors"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ops_compliance_org_id" ON "ops_compliance_schedules" USING btree ("organization_id","id");--> statement-breakpoint
ALTER TABLE "ops_inspections" ADD CONSTRAINT "ops_inspections_organization_id_schedule_id_ops_compliance_schedules_organization_id_id_fk" FOREIGN KEY ("organization_id","schedule_id") REFERENCES "public"."ops_compliance_schedules"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_inspections" ADD CONSTRAINT "ops_inspections_organization_id_store_id_ops_stores_organization_id_id_fk" FOREIGN KEY ("organization_id","store_id") REFERENCES "public"."ops_stores"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_inspections" ADD CONSTRAINT "ops_inspections_organization_id_work_order_id_ops_work_orders_organization_id_id_fk" FOREIGN KEY ("organization_id","work_order_id") REFERENCES "public"."ops_work_orders"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ops_compliance_org_store" ON "ops_compliance_schedules" USING btree ("organization_id","store_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ops_inspection_cycle" ON "ops_inspections" USING btree ("organization_id","schedule_id","due_date");--> statement-breakpoint
CREATE INDEX "idx_ops_inspection_due" ON "ops_inspections" USING btree ("organization_id","store_id","status","due_date","id");