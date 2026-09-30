DROP INDEX `uidx_ops_work_verifications_org_outcome`;--> statement-breakpoint
ALTER TABLE `ops_maintenance_programs` ADD `require_confirmation` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `ops_pm_plans` ADD `require_confirmation` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `ops_work_orders` ADD `confirmation_membership_id` text;--> statement-breakpoint
ALTER TABLE `ops_work_orders` ADD `require_confirmation` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `ops_workflow_policies` ADD `require_confirmation_default` integer DEFAULT 1 NOT NULL;