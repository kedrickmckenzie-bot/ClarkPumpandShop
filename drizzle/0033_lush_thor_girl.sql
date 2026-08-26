CREATE TABLE `ops_vendor_reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`vendor_id` text NOT NULL,
	`title` text NOT NULL,
	`note` text,
	`accountable_party` text NOT NULL,
	`due_at` text NOT NULL,
	`escalation_to` text NOT NULL,
	`status` text NOT NULL,
	`created_by_actor_type` text NOT NULL,
	`created_by_actor_id` text,
	`created_by_actor_name` text NOT NULL,
	`created_at` text NOT NULL,
	`completed_by_actor_type` text,
	`completed_by_actor_id` text,
	`completed_by_actor_name` text,
	`completed_at` text,
	`completion_note` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_vendor_reminders_org_id` ON `ops_vendor_reminders` (`organization_id`,`id`);--> statement-breakpoint
CREATE INDEX `idx_ops_vendor_reminders_org_vendor_status_due` ON `ops_vendor_reminders` (`organization_id`,`vendor_id`,`status`,`due_at`);--> statement-breakpoint
CREATE INDEX `idx_ops_vendor_reminders_org_status_due` ON `ops_vendor_reminders` (`organization_id`,`status`,`due_at`);