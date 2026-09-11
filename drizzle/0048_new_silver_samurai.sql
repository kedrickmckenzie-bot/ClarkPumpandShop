CREATE TABLE `ops_work_prices` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`store_id` text NOT NULL,
	`asset_id` text,
	`component_id` text,
	`profile_id` text,
	`vendor_id` text NOT NULL,
	`kind` text NOT NULL,
	`scope_kind` text NOT NULL,
	`scope` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`recorded_at` text NOT NULL,
	`recorded_by` text NOT NULL,
	CONSTRAINT "chk_ops_work_prices_kind" CHECK("ops_work_prices"."kind" IN ('repair', 'replace')),
	CONSTRAINT "chk_ops_work_prices_scope" CHECK("ops_work_prices"."scope_kind" IN ('whole', 'part', 'job')),
	CONSTRAINT "chk_ops_work_prices_amount" CHECK("ops_work_prices"."amount_minor" >= 0)
);
--> statement-breakpoint
CREATE INDEX `idx_ops_work_prices_org_work_date` ON `ops_work_prices` (`organization_id`,`work_order_id`,`recorded_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_ops_work_prices_org_profile_date` ON `ops_work_prices` (`organization_id`,`profile_id`,`recorded_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_ops_work_prices_org_asset_date` ON `ops_work_prices` (`organization_id`,`asset_id`,`recorded_at`,`id`);