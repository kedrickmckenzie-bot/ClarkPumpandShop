CREATE TABLE `ops_saved_views` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`owner_membership_id` text NOT NULL,
	`surface` text NOT NULL,
	`name` text NOT NULL,
	`query_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_saved_views_org_owner_surface_name` ON `ops_saved_views` (`organization_id`,`owner_membership_id`,`surface`,`name`);--> statement-breakpoint
CREATE INDEX `idx_ops_saved_views_org_owner_surface` ON `ops_saved_views` (`organization_id`,`owner_membership_id`,`surface`);