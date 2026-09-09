CREATE TABLE "ops_role_capability_overrides" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"role" text NOT NULL,
	"capability" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"updated_by_membership_id" text NOT NULL,
	"updated_by_name" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_ops_role_capability_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "chk_ops_role_capability_role" CHECK ("ops_role_capability_overrides"."role" IN ('facilities_admin', 'regional_manager', 'store_manager')),
	CONSTRAINT "chk_ops_role_capability_cap" CHECK ("ops_role_capability_overrides"."capability" IN ('create_work_order', 'issue_work_order', 'confirm_observable_result')),
	CONSTRAINT "chk_ops_role_capability_actor" CHECK (length(btrim("ops_role_capability_overrides"."updated_by_name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "ops_workflow_policies" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"version" integer NOT NULL,
	"status" text NOT NULL,
	"auto_close_routine_after_verification" boolean DEFAULT false NOT NULL,
	"applies_to_active_work" boolean DEFAULT false NOT NULL,
	"created_by_membership_id" text NOT NULL,
	"created_by_name" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_ops_workflow_policy_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "chk_ops_workflow_policy_status" CHECK ("ops_workflow_policies"."status" IN ('active', 'superseded')),
	CONSTRAINT "chk_ops_workflow_policy_version" CHECK ("ops_workflow_policies"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "ops_work_order_verifications" DROP CONSTRAINT "chk_ops_work_verifications_decision";--> statement-breakpoint
ALTER TABLE "ops_work_order_verifications" DROP CONSTRAINT "chk_ops_work_verifications_reason";--> statement-breakpoint
ALTER TABLE "ops_work_order_verifications" ADD COLUMN "basis" text;--> statement-breakpoint
ALTER TABLE "ops_work_order_verifications" ADD COLUMN "verification_scope" text;--> statement-breakpoint
ALTER TABLE "ops_role_capability_overrides" ADD CONSTRAINT "fk_ops_role_capability_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_role_capability_overrides" ADD CONSTRAINT "fk_ops_role_capability_member" FOREIGN KEY ("organization_id","updated_by_membership_id") REFERENCES "public"."ops_memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_workflow_policies" ADD CONSTRAINT "fk_ops_workflow_policy_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_workflow_policies" ADD CONSTRAINT "fk_ops_workflow_policy_member" FOREIGN KEY ("organization_id","created_by_membership_id") REFERENCES "public"."ops_memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_role_capability_org_role_cap" ON "ops_role_capability_overrides" USING btree ("organization_id","role","capability");--> statement-breakpoint
CREATE INDEX "idx_ops_role_capability_org_role" ON "ops_role_capability_overrides" USING btree ("organization_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_workflow_policy_org_version" ON "ops_workflow_policies" USING btree ("organization_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_workflow_policy_active" ON "ops_workflow_policies" USING btree ("organization_id") WHERE "ops_workflow_policies"."status" = 'active';--> statement-breakpoint
ALTER TABLE "ops_work_order_verifications" ADD CONSTRAINT "chk_ops_work_verifications_basis" CHECK ("ops_work_order_verifications"."basis" IS NULL OR "ops_work_order_verifications"."basis" IN ('observable_result', 'technical_evidence', 'operational_review'));--> statement-breakpoint
ALTER TABLE "ops_work_order_verifications" ADD CONSTRAINT "chk_ops_work_verifications_scope" CHECK ("ops_work_order_verifications"."verification_scope" IS NULL OR "ops_work_order_verifications"."verification_scope" IN ('reported_problem', 'pm_task', 'technical_work'));--> statement-breakpoint
ALTER TABLE "ops_work_order_verifications" ADD CONSTRAINT "chk_ops_work_verifications_decision" CHECK ("ops_work_order_verifications"."decision" IN ('verified', 'rejected', 'inconclusive'));--> statement-breakpoint
ALTER TABLE "ops_work_order_verifications" ADD CONSTRAINT "chk_ops_work_verifications_reason" CHECK ("ops_work_order_verifications"."decision" = 'verified' OR ("ops_work_order_verifications"."reason" IS NOT NULL AND length(btrim("ops_work_order_verifications"."reason")) > 0));