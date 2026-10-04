CREATE UNIQUE INDEX `uidx_ops_regions_org_id` ON `ops_regions` (`organization_id`,`id`);
--> statement-breakpoint
CREATE TABLE `ops_technician_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`membership_id` text NOT NULL,
	`home_region_id` text,
	`skills_json` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`organization_id`,`membership_id`) REFERENCES `ops_memberships`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`home_region_id`) REFERENCES `ops_regions`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ops_technician_profiles_member` ON `ops_technician_profiles` (`organization_id`,`membership_id`);