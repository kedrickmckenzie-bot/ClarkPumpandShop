PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_ops_replacement_benchmarks` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`source_type` text NOT NULL,
	`source_work_order_id` text,
	`source_estimate_proposal_id` text,
	`source_asset_id` text,
	`source_vendor_id` text,
	`equipment_amount_minor` integer,
	`installation_amount_minor` integer,
	`other_amount_minor` integer,
	`total_amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`effective_at` text NOT NULL,
	`status` text NOT NULL,
	`superseded_at` text,
	`notes` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_ops_replacement_benchmarks`("id", "organization_id", "profile_id", "source_type", "source_work_order_id", "source_estimate_proposal_id", "source_asset_id", "source_vendor_id", "equipment_amount_minor", "installation_amount_minor", "other_amount_minor", "total_amount_minor", "currency", "effective_at", "status", "superseded_at", "notes", "created_at") SELECT "id", "organization_id", "profile_id", "source_type", "source_work_order_id", "source_estimate_proposal_id", "source_asset_id", "source_vendor_id", "equipment_amount_minor", "installation_amount_minor", "other_amount_minor", "total_amount_minor", "currency", "effective_at", "status", "superseded_at", "notes", "created_at" FROM `ops_replacement_benchmarks`;--> statement-breakpoint
DROP TABLE `ops_replacement_benchmarks`;--> statement-breakpoint
ALTER TABLE `__new_ops_replacement_benchmarks` RENAME TO `ops_replacement_benchmarks`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_ops_replacement_benchmarks_org_profile_status_effective` ON `ops_replacement_benchmarks` (`organization_id`,`profile_id`,`status`,`effective_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_replacement_benchmarks_org_profile_published` ON `ops_replacement_benchmarks` (`organization_id`,`profile_id`) WHERE "ops_replacement_benchmarks"."status" = 'published';--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_replacement_benchmarks_org_source_proposal` ON `ops_replacement_benchmarks` (`organization_id`,`source_estimate_proposal_id`);