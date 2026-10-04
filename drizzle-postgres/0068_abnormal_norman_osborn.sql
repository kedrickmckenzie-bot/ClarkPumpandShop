CREATE TABLE "ops_work_results" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"work_order_id" text NOT NULL,
	"assignment_id" text,
	"site_visit_work_order_id" text,
	"performer_membership_id" text,
	"performer_name" text NOT NULL,
	"source" text NOT NULL,
	"outcome" text NOT NULL,
	"outcome_notes" text,
	"blocker" text,
	"linked_at" timestamp with time zone NOT NULL,
	"outcome_recorded_at" timestamp with time zone NOT NULL,
	"cycle_version" integer NOT NULL,
	"outcome_recorded_by_actor_type" text NOT NULL,
	"outcome_recorded_by_actor_id" text,
	"outcome_recorded_by_actor_name" text NOT NULL,
	"reported_performed_at" timestamp with time zone,
	"supersedes_result_id" text,
	"correction_reason" text,
	"follow_up_id" text,
	CONSTRAINT "chk_ops_work_results_source" CHECK ("ops_work_results"."source" IN ('technician_report','visit_checkout','phone','email','in_person','correction')),
	CONSTRAINT "chk_ops_work_results_outcome" CHECK ("ops_work_results"."outcome" IN ('completed','temporary_repair','diagnosis_only','quote_required','parts_required','return_visit_required','no_issue_found','store_access_unavailable','work_not_authorized','not_addressed')),
	CONSTRAINT "chk_ops_work_results_cycle" CHECK ("ops_work_results"."cycle_version" > 0),
	CONSTRAINT "chk_ops_work_results_correction" CHECK ("ops_work_results"."source" <> 'correction' OR ("ops_work_results"."correction_reason" IS NOT NULL AND length(trim("ops_work_results"."correction_reason")) > 0))
);
--> statement-breakpoint
ALTER TABLE "ops_work_order_verifications" ALTER COLUMN "site_visit_work_order_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ops_site_visit_work_orders" ADD COLUMN "cycle_version" integer;--> statement-breakpoint
ALTER TABLE "ops_work_order_verifications" ADD COLUMN "work_result_id" text;--> statement-breakpoint
ALTER TABLE "ops_workflow_policies" ADD COLUMN "internal_check_in_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ops_work_results" ADD CONSTRAINT "fk_ops_work_results_work" FOREIGN KEY ("organization_id","work_order_id") REFERENCES "public"."ops_work_orders"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_work_results" ADD CONSTRAINT "fk_ops_work_results_visit" FOREIGN KEY ("organization_id","site_visit_work_order_id","work_order_id") REFERENCES "public"."ops_site_visit_work_orders"("organization_id","id","work_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_work_results_org_id_work" ON "ops_work_results" USING btree ("organization_id","id","work_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_work_results_org_work_cycle" ON "ops_work_results" USING btree ("organization_id","work_order_id","cycle_version");--> statement-breakpoint
CREATE INDEX "idx_ops_work_results_org_work_time" ON "ops_work_results" USING btree ("organization_id","work_order_id","outcome_recorded_at");--> statement-breakpoint
ALTER TABLE "ops_work_order_verifications" ADD CONSTRAINT "fk_ops_work_verifications_result" FOREIGN KEY ("organization_id","work_result_id","work_order_id") REFERENCES "public"."ops_work_results"("organization_id","id","work_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_work_order_verifications" ADD CONSTRAINT "chk_ops_work_verifications_target" CHECK (("ops_work_order_verifications"."site_visit_work_order_id" IS NOT NULL AND "ops_work_order_verifications"."work_result_id" IS NULL) OR ("ops_work_order_verifications"."site_visit_work_order_id" IS NULL AND "ops_work_order_verifications"."work_result_id" IS NOT NULL));