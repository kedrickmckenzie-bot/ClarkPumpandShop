CREATE TABLE `ops_overview_seen_marks` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`membership_id` text NOT NULL,
	`seen_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `ops_organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`membership_id`) REFERENCES `ops_memberships`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_ops_overview_seen_marks_person` ON `ops_overview_seen_marks` (`organization_id`,`membership_id`,`seen_at`);