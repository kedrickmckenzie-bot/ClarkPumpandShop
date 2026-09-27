CREATE TABLE `ops_follow_up_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`cadence_hours` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `ops_organizations`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_ops_follow_up_cadence" CHECK("ops_follow_up_preferences"."cadence_hours" IN (0,24,48,168))
);
--> statement-breakpoint
CREATE INDEX `idx_ops_follow_up_preference_org_date` ON `ops_follow_up_preferences` (`organization_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `ops_inbound_emails` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`message_key` text NOT NULL,
	`sender` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`reported_date` text,
	`received_at` text NOT NULL,
	`status` text NOT NULL,
	`work_order_id` text,
	`request_id` text,
	FOREIGN KEY (`organization_id`) REFERENCES `ops_organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`work_order_id`) REFERENCES `ops_work_orders`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`request_id`) REFERENCES `ops_requests`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_ops_email_status" CHECK("ops_inbound_emails"."status" IN ('needs_review','linked','dismissed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ops_email_org_key` ON `ops_inbound_emails` (`organization_id`,`message_key`);--> statement-breakpoint
CREATE INDEX `idx_ops_email_org_status_date` ON `ops_inbound_emails` (`organization_id`,`status`,`received_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_ops_email_org_work_date` ON `ops_inbound_emails` (`organization_id`,`work_order_id`,`received_at`,`id`);