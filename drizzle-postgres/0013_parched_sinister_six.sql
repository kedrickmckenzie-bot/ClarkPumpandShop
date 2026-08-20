CREATE TABLE "ops_work_order_verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"work_order_id" text NOT NULL,
	"site_visit_work_order_id" text NOT NULL,
	"outcome" text NOT NULL,
	"outcome_recorded_at" timestamp with time zone NOT NULL,
	"cycle" integer NOT NULL,
	"decision" text NOT NULL,
	"reason" text,
	"decided_by_membership_id" text NOT NULL,
	"decided_by_name" text NOT NULL,
	"decided_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_ops_work_verifications_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "uq_ops_work_verifications_org_cycle" UNIQUE("organization_id","work_order_id","cycle"),
	CONSTRAINT "uq_ops_work_verifications_org_outcome" UNIQUE("organization_id","site_visit_work_order_id"),
	CONSTRAINT "chk_ops_work_verifications_outcome" CHECK ("ops_work_order_verifications"."outcome" IN ('completed', 'diagnosis_only', 'quote_required', 'parts_required', 'return_visit_required', 'no_issue_found', 'store_access_unavailable', 'work_not_authorized', 'not_addressed')),
	CONSTRAINT "chk_ops_work_verifications_cycle" CHECK ("ops_work_order_verifications"."cycle" > 0),
	CONSTRAINT "chk_ops_work_verifications_decision" CHECK ("ops_work_order_verifications"."decision" IN ('verified', 'rejected')),
	CONSTRAINT "chk_ops_work_verifications_reason" CHECK ("ops_work_order_verifications"."decision" <> 'rejected' OR ("ops_work_order_verifications"."reason" IS NOT NULL AND length(btrim("ops_work_order_verifications"."reason")) > 0)),
	CONSTRAINT "chk_ops_work_verifications_actor" CHECK (length(btrim("ops_work_order_verifications"."decided_by_name")) > 0),
	CONSTRAINT "chk_ops_work_verifications_time" CHECK ("ops_work_order_verifications"."decided_at" >= "ops_work_order_verifications"."outcome_recorded_at")
);
--> statement-breakpoint
ALTER TABLE "ops_work_orders" DROP CONSTRAINT "chk_ops_work_orders_status";--> statement-breakpoint
ALTER TABLE "ops_workflow_tasks" DROP CONSTRAINT "chk_ops_workflow_tasks_type";--> statement-breakpoint
ALTER TABLE "ops_work_orders" ADD COLUMN "resolved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ops_work_order_verifications" ADD CONSTRAINT "fk_ops_work_verifications_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_work_order_verifications" ADD CONSTRAINT "fk_ops_work_verifications_work" FOREIGN KEY ("organization_id","work_order_id") REFERENCES "public"."ops_work_orders"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_work_order_verifications" ADD CONSTRAINT "fk_ops_work_verifications_outcome" FOREIGN KEY ("organization_id","site_visit_work_order_id","work_order_id") REFERENCES "public"."ops_site_visit_work_orders"("organization_id","id","work_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_work_order_verifications" ADD CONSTRAINT "fk_ops_work_verifications_member" FOREIGN KEY ("organization_id","decided_by_membership_id") REFERENCES "public"."ops_memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ops_work_verifications_org_work_time" ON "ops_work_order_verifications" USING btree ("organization_id","work_order_id","decided_at");--> statement-breakpoint
ALTER TABLE "ops_work_orders" ADD CONSTRAINT "chk_ops_work_orders_resolution_time" CHECK ("ops_work_orders"."resolved_at" IS NULL OR "ops_work_orders"."resolved_at" >= "ops_work_orders"."created_at");--> statement-breakpoint
ALTER TABLE "ops_work_orders" ADD CONSTRAINT "chk_ops_work_orders_status" CHECK ("ops_work_orders"."status" IN ('draft', 'awaiting_approval', 'approved', 'issued', 'accepted', 'scheduled', 'in_progress', 'waiting_on_vendor', 'waiting_on_parts', 'completed_pending_review', 'resolved', 'closed', 'cancelled'));--> statement-breakpoint
ALTER TABLE "ops_workflow_tasks" ADD CONSTRAINT "chk_ops_workflow_tasks_type" CHECK ("ops_workflow_tasks"."task_type" IN ('review_issue', 'approve_quote', 'vendor_response_required', 'confirm_store_access', 'submit_quote', 'choose_service_provider', 'schedule_service', 'record_service_outcome', 'schedule_return_visit', 'verify_repair', 'close_verified_work', 'review_warranty', 'resolve_invoice_exception', 'respond_service_discrepancy', 'other'));
