CREATE TABLE `ops_store_vendor_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`store_id` text NOT NULL,
	`vendor_id` text NOT NULL,
	`trade_keys_json` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_store_vendor_preferences_version` ON `ops_store_vendor_preferences` (`organization_id`,`store_id`,`vendor_id`,`version`);--> statement-breakpoint
CREATE INDEX `idx_ops_store_vendor_preferences_store` ON `ops_store_vendor_preferences` (`organization_id`,`store_id`,`vendor_id`);