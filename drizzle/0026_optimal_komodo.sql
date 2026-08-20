CREATE TABLE `ops_component_lifecycle_events` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`removed_component_id` text NOT NULL,
	`installed_component_id` text NOT NULL,
	`repair_item_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`vendor_id` text NOT NULL,
	`part_manufacturer` text NOT NULL,
	`part_model` text NOT NULL,
	`serial_number` text,
	`removed_at` text NOT NULL,
	`installed_at` text NOT NULL,
	`failure_mode` text NOT NULL,
	`root_cause` text,
	`labor_cost_minor` integer NOT NULL,
	`part_cost_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`replacement_kind` text NOT NULL,
	`expected_life_months` integer,
	`warranty_ends_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_component_lifecycle_org_removed` ON `ops_component_lifecycle_events` (`organization_id`,`removed_component_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_component_lifecycle_org_repair` ON `ops_component_lifecycle_events` (`organization_id`,`repair_item_id`);--> statement-breakpoint
CREATE INDEX `idx_ops_component_lifecycle_org_model_removed` ON `ops_component_lifecycle_events` (`organization_id`,`part_manufacturer`,`part_model`,`removed_at`);--> statement-breakpoint
CREATE INDEX `idx_ops_component_lifecycle_org_vendor_removed` ON `ops_component_lifecycle_events` (`organization_id`,`vendor_id`,`removed_at`);--> statement-breakpoint
ALTER TABLE `ops_asset_components` ADD `removed_at` text;--> statement-breakpoint
ALTER TABLE `ops_asset_components` ADD `replaced_by_component_id` text;