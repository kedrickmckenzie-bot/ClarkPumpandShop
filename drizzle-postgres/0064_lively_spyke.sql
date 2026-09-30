ALTER TABLE "ops_work_order_verifications" DROP CONSTRAINT "uq_ops_work_verifications_org_outcome";--> statement-breakpoint
ALTER TABLE "ops_maintenance_programs" ADD COLUMN "require_confirmation" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "ops_pm_plans" ADD COLUMN "require_confirmation" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "ops_work_orders" ADD COLUMN "confirmation_membership_id" text;--> statement-breakpoint
ALTER TABLE "ops_work_orders" ADD COLUMN "require_confirmation" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "ops_workflow_policies" ADD COLUMN "require_confirmation_default" integer DEFAULT 1 NOT NULL;