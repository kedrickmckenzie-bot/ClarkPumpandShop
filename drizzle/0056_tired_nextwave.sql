PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_ops_store_vendor_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`store_id` text NOT NULL,
	`vendor_id` text NOT NULL,
	`trade_keys_json` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`organization_id`,`store_id`) REFERENCES `ops_stores`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`vendor_id`) REFERENCES `ops_vendors`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_ops_store_vendor_preferences`("id", "organization_id", "store_id", "vendor_id", "trade_keys_json", "version", "created_at") SELECT "id", "organization_id", "store_id", "vendor_id", "trade_keys_json", "version", "created_at" FROM `ops_store_vendor_preferences`;--> statement-breakpoint
DROP TABLE `ops_store_vendor_preferences`;--> statement-breakpoint
ALTER TABLE `__new_ops_store_vendor_preferences` RENAME TO `ops_store_vendor_preferences`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_store_vendor_preferences_version` ON `ops_store_vendor_preferences` (`organization_id`,`store_id`,`vendor_id`,`version`);--> statement-breakpoint
CREATE INDEX `idx_ops_store_vendor_preferences_store` ON `ops_store_vendor_preferences` (`organization_id`,`store_id`,`vendor_id`);