CREATE TABLE "ops_request_impact_assessments" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"request_id" text NOT NULL,
	"store_id" text NOT NULL,
	"assessment_kind" text NOT NULL,
	"review_disposition" text,
	"store_operating_state" text NOT NULL,
	"safety_concern" text NOT NULL,
	"product_inventory_risk" text NOT NULL,
	"product_inventory_value_minor" bigint,
	"product_inventory_currency" text,
	"customers_affected" text NOT NULL,
	"compliance_impact" text NOT NULL,
	"capacity_unavailable_bps" integer,
	"redundant_equipment" text NOT NULL,
	"revenue_function_impact" text,
	"estimated_daily_revenue_exposure_minor" bigint,
	"estimated_daily_revenue_exposure_currency" text,
	"estimated_downtime_minutes" integer,
	"confidence" text NOT NULL,
	"source" text NOT NULL,
	"notes" text,
	"assessed_by_actor_type" text NOT NULL,
	"assessed_by_actor_id" text,
	"assessed_by_actor_name" text NOT NULL,
	"assessed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_ops_request_impact_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "chk_ops_request_impact_kind" CHECK ("ops_request_impact_assessments"."assessment_kind" IN ('initial_report', 'review')),
	CONSTRAINT "chk_ops_request_impact_disposition" CHECK ("ops_request_impact_assessments"."review_disposition" IS NULL OR "ops_request_impact_assessments"."review_disposition" IN ('confirmed', 'revised')),
	CONSTRAINT "chk_ops_request_impact_review_disposition" CHECK (("ops_request_impact_assessments"."assessment_kind" = 'initial_report' AND "ops_request_impact_assessments"."review_disposition" IS NULL) OR ("ops_request_impact_assessments"."assessment_kind" = 'review' AND "ops_request_impact_assessments"."review_disposition" IS NOT NULL)),
	CONSTRAINT "chk_ops_request_impact_operating_state" CHECK ("ops_request_impact_assessments"."store_operating_state" IN ('open', 'partially_operational', 'unable_to_operate', 'unknown')),
	CONSTRAINT "chk_ops_request_impact_safety" CHECK ("ops_request_impact_assessments"."safety_concern" IN ('none_reported', 'potential', 'immediate', 'unknown')),
	CONSTRAINT "chk_ops_request_impact_inventory" CHECK ("ops_request_impact_assessments"."product_inventory_risk" IN ('none_reported', 'at_risk', 'loss_reported', 'unknown')),
	CONSTRAINT "chk_ops_request_impact_inventory_value" CHECK (("ops_request_impact_assessments"."product_inventory_value_minor" IS NULL AND "ops_request_impact_assessments"."product_inventory_currency" IS NULL) OR ("ops_request_impact_assessments"."product_inventory_value_minor" >= 0 AND char_length(btrim("ops_request_impact_assessments"."product_inventory_currency")) > 0)),
	CONSTRAINT "chk_ops_request_impact_customers" CHECK ("ops_request_impact_assessments"."customers_affected" IN ('yes', 'no', 'unknown')),
	CONSTRAINT "chk_ops_request_impact_compliance" CHECK ("ops_request_impact_assessments"."compliance_impact" IN ('none_reported', 'potential', 'confirmed', 'unknown')),
	CONSTRAINT "chk_ops_request_impact_capacity" CHECK ("ops_request_impact_assessments"."capacity_unavailable_bps" IS NULL OR "ops_request_impact_assessments"."capacity_unavailable_bps" BETWEEN 0 AND 10000),
	CONSTRAINT "chk_ops_request_impact_redundancy" CHECK ("ops_request_impact_assessments"."redundant_equipment" IN ('yes', 'no', 'unknown')),
	CONSTRAINT "chk_ops_request_impact_revenue" CHECK ("ops_request_impact_assessments"."revenue_function_impact" IS NULL OR "ops_request_impact_assessments"."revenue_function_impact" IN ('fuel', 'foodservice', 'refrigerated_merchandise', 'beverages', 'lottery', 'car_wash', 'other')),
	CONSTRAINT "chk_ops_request_impact_revenue_exposure" CHECK (("ops_request_impact_assessments"."estimated_daily_revenue_exposure_minor" IS NULL AND "ops_request_impact_assessments"."estimated_daily_revenue_exposure_currency" IS NULL) OR ("ops_request_impact_assessments"."estimated_daily_revenue_exposure_minor" >= 0 AND char_length(btrim("ops_request_impact_assessments"."estimated_daily_revenue_exposure_currency")) > 0)),
	CONSTRAINT "chk_ops_request_impact_downtime" CHECK ("ops_request_impact_assessments"."estimated_downtime_minutes" IS NULL OR "ops_request_impact_assessments"."estimated_downtime_minutes" BETWEEN 0 AND 525600),
	CONSTRAINT "chk_ops_request_impact_confidence" CHECK ("ops_request_impact_assessments"."confidence" IN ('low', 'medium', 'high')),
	CONSTRAINT "chk_ops_request_impact_source" CHECK ("ops_request_impact_assessments"."source" IN ('store_report', 'manager_review', 'imported', 'not_assessed')),
	CONSTRAINT "chk_ops_request_impact_actor_type" CHECK ("ops_request_impact_assessments"."assessed_by_actor_type" IN ('user', 'vendor_link', 'technician', 'store_device', 'system', 'support'))
);
--> statement-breakpoint
ALTER TABLE "ops_workflow_tasks" ALTER COLUMN "work_order_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ops_workflow_tasks" ADD COLUMN "service_request_id" text;--> statement-breakpoint
ALTER TABLE "ops_request_impact_assessments" ADD CONSTRAINT "fk_ops_request_impact_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_request_impact_assessments" ADD CONSTRAINT "fk_ops_request_impact_request" FOREIGN KEY ("organization_id","request_id") REFERENCES "public"."ops_requests"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_request_impact_assessments" ADD CONSTRAINT "fk_ops_request_impact_store" FOREIGN KEY ("organization_id","store_id") REFERENCES "public"."ops_stores"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ops_request_impact_org_request_time" ON "ops_request_impact_assessments" USING btree ("organization_id","request_id","assessed_at");--> statement-breakpoint
CREATE INDEX "idx_ops_request_impact_org_store_time" ON "ops_request_impact_assessments" USING btree ("organization_id","store_id","assessed_at");--> statement-breakpoint
ALTER TABLE "ops_workflow_tasks" ADD CONSTRAINT "fk_ops_workflow_tasks_request" FOREIGN KEY ("organization_id","service_request_id") REFERENCES "public"."ops_requests"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ops_workflow_tasks_org_request_status_due" ON "ops_workflow_tasks" USING btree ("organization_id","service_request_id","status","due_at");--> statement-breakpoint
ALTER TABLE "ops_workflow_tasks" ADD CONSTRAINT "chk_ops_workflow_tasks_subject" CHECK (("ops_workflow_tasks"."work_order_id" IS NOT NULL AND "ops_workflow_tasks"."service_request_id" IS NULL) OR ("ops_workflow_tasks"."work_order_id" IS NULL AND "ops_workflow_tasks"."service_request_id" IS NOT NULL));