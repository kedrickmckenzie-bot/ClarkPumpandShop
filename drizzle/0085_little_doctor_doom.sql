CREATE TABLE `ops_asset_refrigerants` (
	`organization_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`version` integer NOT NULL,
	`refrigerant` text NOT NULL,
	`full_charge_oz` integer,
	`system_use` text NOT NULL,
	`charge_source` text,
	`recorded_by_name` text NOT NULL,
	`recorded_by_actor_id` text,
	`created_at` text NOT NULL,
	PRIMARY KEY(`organization_id`, `asset_id`, `version`),
	FOREIGN KEY (`organization_id`) REFERENCES `ops_organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`asset_id`) REFERENCES `ops_assets`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_ops_asset_refrigerants_use" CHECK("ops_asset_refrigerants"."system_use" IN ('commercial_refrigeration','comfort_cooling','light_commercial_ac')),
	CONSTRAINT "chk_ops_asset_refrigerants_charge" CHECK("ops_asset_refrigerants"."full_charge_oz" IS NULL OR "ops_asset_refrigerants"."full_charge_oz" >= 0)
);
--> statement-breakpoint
CREATE TABLE `ops_refrigerant_events` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`store_id` text NOT NULL,
	`work_order_id` text,
	`visit_id` text,
	`kind` text NOT NULL,
	`occurred_at` text NOT NULL,
	`added_oz` integer DEFAULT 0 NOT NULL,
	`leak_status` text,
	`verification_stage` text,
	`verification_result` text,
	`refrigerant` text NOT NULL,
	`full_charge_oz` integer,
	`rule` text,
	`leak_rate_bps` integer,
	`threshold_bps` integer,
	`technician_name` text NOT NULL,
	`technician_cert` text,
	`source` text NOT NULL,
	`recorded_by_name` text NOT NULL,
	`recorded_by_actor_id` text,
	`notes` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `ops_organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`asset_id`) REFERENCES `ops_assets`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_ops_refrigerant_events_kind" CHECK("ops_refrigerant_events"."kind" IN ('service','verification')),
	CONSTRAINT "chk_ops_refrigerant_events_added" CHECK("ops_refrigerant_events"."added_oz" >= 0),
	CONSTRAINT "chk_ops_refrigerant_events_source" CHECK("ops_refrigerant_events"."source" IN ('vendor','internal','office'))
);
--> statement-breakpoint
CREATE INDEX `idx_ops_refrigerant_events_asset` ON `ops_refrigerant_events` (`organization_id`,`asset_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_ops_refrigerant_events_store` ON `ops_refrigerant_events` (`organization_id`,`store_id`,`occurred_at`);