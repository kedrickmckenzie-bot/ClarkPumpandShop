CREATE TABLE `ops_asset_replacement_overrides` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`source_benchmark_id` text,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`effective_at` text NOT NULL,
	`reason` text NOT NULL,
	`status` text NOT NULL,
	`superseded_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ops_asset_replacement_overrides_org_asset_status_effective` ON `ops_asset_replacement_overrides` (`organization_id`,`asset_id`,`status`,`effective_at`);--> statement-breakpoint
CREATE TABLE `ops_replacement_benchmarks` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`source_type` text NOT NULL,
	`source_work_order_id` text,
	`source_estimate_proposal_id` text,
	`source_asset_id` text,
	`source_vendor_id` text,
	`equipment_amount_minor` integer NOT NULL,
	`installation_amount_minor` integer NOT NULL,
	`other_amount_minor` integer NOT NULL,
	`total_amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`effective_at` text NOT NULL,
	`status` text NOT NULL,
	`superseded_at` text,
	`notes` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ops_replacement_benchmarks_org_profile_status_effective` ON `ops_replacement_benchmarks` (`organization_id`,`profile_id`,`status`,`effective_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_replacement_benchmarks_org_source_proposal` ON `ops_replacement_benchmarks` (`organization_id`,`source_estimate_proposal_id`);--> statement-breakpoint
CREATE TABLE `ops_replacement_events` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`source_estimate_proposal_id` text NOT NULL,
	`status` text NOT NULL,
	`approved_amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`approved_at` text NOT NULL,
	`completed_at` text,
	`final_amount_minor` integer,
	`replacement_asset_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ops_replacement_events_org_asset_status` ON `ops_replacement_events` (`organization_id`,`asset_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_ops_replacement_events_org_work` ON `ops_replacement_events` (`organization_id`,`work_order_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_replacement_events_org_proposal` ON `ops_replacement_events` (`organization_id`,`source_estimate_proposal_id`);--> statement-breakpoint
CREATE TABLE `ops_replacement_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`category_key` text NOT NULL,
	`taxonomy_node_id` text,
	`match_keys_json` text DEFAULT '[]' NOT NULL,
	`attributes_json` text DEFAULT '{}' NOT NULL,
	`expected_life_years` integer,
	`annual_escalation_bps` integer DEFAULT 300 NOT NULL,
	`low_variance_bps` integer DEFAULT 1000 NOT NULL,
	`high_variance_bps` integer DEFAULT 2000 NOT NULL,
	`active` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_replacement_profiles_org_code` ON `ops_replacement_profiles` (`organization_id`,`code`);--> statement-breakpoint
CREATE INDEX `idx_ops_replacement_profiles_org_category_active` ON `ops_replacement_profiles` (`organization_id`,`category_key`,`active`);--> statement-breakpoint
ALTER TABLE `ops_assets` ADD `replacement_profile_id` text;--> statement-breakpoint
ALTER TABLE `ops_assets` ADD `replacement_attributes_json` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `ops_assets` ADD `replacement_adjustment_bps` integer;--> statement-breakpoint
ALTER TABLE `ops_assets` ADD `retired_at` text;--> statement-breakpoint
ALTER TABLE `ops_assets` ADD `replaced_by_asset_id` text;--> statement-breakpoint
CREATE INDEX `idx_ops_assets_org_replacement_profile` ON `ops_assets` (`organization_id`,`replacement_profile_id`,`status`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_ops_work_order_estimate_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`vendor_id` text NOT NULL,
	`kind` text NOT NULL,
	`decision_kind` text DEFAULT 'service_bid' NOT NULL,
	`requested_scope` text NOT NULL,
	`status` text NOT NULL,
	`channel` text NOT NULL,
	`requested_at` text NOT NULL,
	`due_at` text,
	`opened_at` text,
	`responded_at` text,
	`decision_at` text,
	FOREIGN KEY (`organization_id`) REFERENCES `ops_organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`work_order_id`) REFERENCES `ops_work_orders`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`vendor_id`) REFERENCES `ops_vendors`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_ops_estimate_requests_kind" CHECK("__new_ops_work_order_estimate_requests"."kind" IN ('estimate_only', 'diagnostic_and_estimate')),
	CONSTRAINT "chk_ops_estimate_requests_decision_kind" CHECK("__new_ops_work_order_estimate_requests"."decision_kind" IN ('service_bid', 'replacement_quote')),
	CONSTRAINT "chk_ops_estimate_requests_status" CHECK("__new_ops_work_order_estimate_requests"."status" IN ('requested', 'opened', 'submitted', 'declined', 'expired', 'withdrawn', 'selected', 'not_selected')),
	CONSTRAINT "chk_ops_estimate_requests_channel" CHECK("__new_ops_work_order_estimate_requests"."channel" IN ('email', 'sms', 'manual')),
	CONSTRAINT "chk_ops_estimate_requests_scope" CHECK(length(trim("__new_ops_work_order_estimate_requests"."requested_scope")) > 0),
	CONSTRAINT "chk_ops_estimate_requests_due" CHECK("__new_ops_work_order_estimate_requests"."due_at" IS NULL OR "__new_ops_work_order_estimate_requests"."due_at" >= "__new_ops_work_order_estimate_requests"."requested_at"),
	CONSTRAINT "chk_ops_estimate_requests_opened" CHECK("__new_ops_work_order_estimate_requests"."opened_at" IS NULL OR "__new_ops_work_order_estimate_requests"."opened_at" >= "__new_ops_work_order_estimate_requests"."requested_at"),
	CONSTRAINT "chk_ops_estimate_requests_responded" CHECK("__new_ops_work_order_estimate_requests"."responded_at" IS NULL OR "__new_ops_work_order_estimate_requests"."responded_at" >= "__new_ops_work_order_estimate_requests"."requested_at"),
	CONSTRAINT "chk_ops_estimate_requests_decision" CHECK("__new_ops_work_order_estimate_requests"."decision_at" IS NULL OR "__new_ops_work_order_estimate_requests"."decision_at" >= "__new_ops_work_order_estimate_requests"."requested_at")
);
--> statement-breakpoint
INSERT INTO `__new_ops_work_order_estimate_requests`("id", "organization_id", "work_order_id", "vendor_id", "kind", "decision_kind", "requested_scope", "status", "channel", "requested_at", "due_at", "opened_at", "responded_at", "decision_at") SELECT "id", "organization_id", "work_order_id", "vendor_id", "kind", 'service_bid', "requested_scope", "status", "channel", "requested_at", "due_at", "opened_at", "responded_at", "decision_at" FROM `ops_work_order_estimate_requests`;--> statement-breakpoint
DROP TABLE `ops_work_order_estimate_requests`;--> statement-breakpoint
ALTER TABLE `__new_ops_work_order_estimate_requests` RENAME TO `ops_work_order_estimate_requests`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_estimate_requests_org_id` ON `ops_work_order_estimate_requests` (`organization_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_estimate_requests_org_context` ON `ops_work_order_estimate_requests` (`organization_id`,`id`,`work_order_id`,`vendor_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_estimate_requests_org_work_vendor_active` ON `ops_work_order_estimate_requests` (`organization_id`,`work_order_id`,`vendor_id`) WHERE "ops_work_order_estimate_requests"."status" IN ('requested', 'opened', 'submitted');--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_estimate_requests_org_work_selected` ON `ops_work_order_estimate_requests` (`organization_id`,`work_order_id`) WHERE "ops_work_order_estimate_requests"."status" = 'selected';--> statement-breakpoint
CREATE INDEX `idx_ops_estimate_requests_org_work_status_requested` ON `ops_work_order_estimate_requests` (`organization_id`,`work_order_id`,`status`,`requested_at`);--> statement-breakpoint
CREATE INDEX `idx_ops_estimate_requests_org_vendor_status_due` ON `ops_work_order_estimate_requests` (`organization_id`,`vendor_id`,`status`,`due_at`);--> statement-breakpoint
CREATE INDEX `idx_ops_estimate_requests_org_status_due` ON `ops_work_order_estimate_requests` (`organization_id`,`status`,`due_at`);
