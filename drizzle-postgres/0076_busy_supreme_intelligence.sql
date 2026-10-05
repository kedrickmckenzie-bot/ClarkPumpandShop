ALTER TABLE "ops_workflow_policies" ADD COLUMN "confirmation_delay" text;--> statement-breakpoint
ALTER TABLE "ops_workflow_policies" ADD COLUMN "confirmation_escalation_hours" integer;--> statement-breakpoint
ALTER TABLE "ops_workflow_tasks" ADD COLUMN "available_at" text;--> statement-breakpoint
ALTER TABLE "ops_workflow_tasks" ADD COLUMN "reminded_at" text;