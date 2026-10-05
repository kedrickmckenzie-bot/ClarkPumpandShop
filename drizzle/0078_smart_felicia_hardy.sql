CREATE TABLE `ops_route_legs` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`from_lat_e6` integer NOT NULL,
	`from_lng_e6` integer NOT NULL,
	`to_lat_e6` integer NOT NULL,
	`to_lng_e6` integer NOT NULL,
	`distance_m` integer NOT NULL,
	`duration_s` integer NOT NULL,
	`geometry` text NOT NULL,
	`provider` text NOT NULL,
	`fetched_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `ops_organizations`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_ops_route_legs" CHECK("ops_route_legs"."distance_m" >= 0 AND "ops_route_legs"."duration_s" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ops_route_legs_points` ON `ops_route_legs` (`organization_id`,`from_lat_e6`,`from_lng_e6`,`to_lat_e6`,`to_lng_e6`);