ALTER TABLE `ops_workflow_policies` ADD `confirmation_delay` text;--> statement-breakpoint
ALTER TABLE `ops_workflow_policies` ADD `confirmation_escalation_hours` integer;--> statement-breakpoint
ALTER TABLE `ops_workflow_tasks` ADD `available_at` text;--> statement-breakpoint
ALTER TABLE `ops_workflow_tasks` ADD `reminded_at` text;