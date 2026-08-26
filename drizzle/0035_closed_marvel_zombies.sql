CREATE TABLE `ops_notification_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`event_key` text NOT NULL,
	`email_enabled` integer DEFAULT false NOT NULL,
	`recipient_role` text NOT NULL,
	`updated_by_membership_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_notification_rules_org_event` ON `ops_notification_rules` (`organization_id`,`event_key`);--> statement-breakpoint
CREATE INDEX `idx_ops_notification_rules_org_role` ON `ops_notification_rules` (`organization_id`,`recipient_role`);