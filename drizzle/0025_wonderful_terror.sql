CREATE TABLE `ops_lifecycle_recommendations` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`work_order_id` text,
	`version` integer NOT NULL,
	`model_version` text NOT NULL,
	`recommendation` text NOT NULL,
	`confidence` text NOT NULL,
	`inputs_json` text NOT NULL,
	`explanation` text NOT NULL,
	`missing_data_json` text DEFAULT '[]' NOT NULL,
	`user_decision` text NOT NULL,
	`user_reason` text NOT NULL,
	`decided_by_membership_id` text NOT NULL,
	`decided_at` text NOT NULL,
	`actual_outcome` text,
	`actual_outcome_at` text,
	`replacement_event_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_lifecycle_recommendations_org_asset_version` ON `ops_lifecycle_recommendations` (`organization_id`,`asset_id`,`version`);--> statement-breakpoint
CREATE INDEX `idx_ops_lifecycle_recommendations_org_asset_created` ON `ops_lifecycle_recommendations` (`organization_id`,`asset_id`,`created_at`);