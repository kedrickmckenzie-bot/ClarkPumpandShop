ALTER TABLE `ops_assets` ADD `equipment_template_id` text;--> statement-breakpoint
CREATE INDEX `idx_ops_assets_org_equipment_template` ON `ops_assets` (`organization_id`,`equipment_template_id`,`status`);--> statement-breakpoint
ALTER TABLE `ops_maintenance_programs` ADD `schedule_anchor_at` text;--> statement-breakpoint
ALTER TABLE `ops_pm_plans` ADD `cadence_override_reason` text;--> statement-breakpoint
ALTER TABLE `ops_pm_plans` ADD `cadence_overridden_at` text;--> statement-breakpoint
ALTER TABLE `ops_pm_plans` ADD `cadence_overridden_by_membership_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_pm_plans_org_program_asset` ON `ops_pm_plans` (`organization_id`,`program_id`,`asset_id`);