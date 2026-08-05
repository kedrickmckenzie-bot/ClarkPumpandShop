CREATE TABLE `labor_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`technician_id` text NOT NULL,
	`technician_name` text NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text NOT NULL,
	`regular_minutes` integer DEFAULT 0 NOT NULL,
	`overtime_minutes` integer DEFAULT 0 NOT NULL,
	`hourly_rate_cents` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_labor_org_work_started` ON `labor_entries` (`organization_id`,`work_order_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `idx_labor_org_tech_started` ON `labor_entries` (`organization_id`,`technician_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `parts_used` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`part_number` text,
	`description` text NOT NULL,
	`quantity_milli` integer DEFAULT 1000 NOT NULL,
	`unit_cost_cents` integer DEFAULT 0 NOT NULL,
	`source` text NOT NULL,
	`recorded_by_id` text,
	`recorded_by_name` text NOT NULL,
	`recorded_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_parts_used_org_work_recorded` ON `parts_used` (`organization_id`,`work_order_id`,`recorded_at`);--> statement-breakpoint
CREATE INDEX `idx_parts_used_org_part` ON `parts_used` (`organization_id`,`part_number`);--> statement-breakpoint
CREATE TABLE `work_order_checklist_items` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`label` text NOT NULL,
	`required` integer DEFAULT true NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`completed_at` text,
	`completed_by_id` text,
	`completed_by_name` text
);
--> statement-breakpoint
CREATE INDEX `idx_wo_checklist_org_work_sequence` ON `work_order_checklist_items` (`organization_id`,`work_order_id`,`sequence`);--> statement-breakpoint
CREATE TABLE `work_order_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`author_id` text,
	`author_name` text NOT NULL,
	`author_role` text,
	`body` text NOT NULL,
	`visibility` text DEFAULT 'internal' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_wo_notes_org_work_created` ON `work_order_notes` (`organization_id`,`work_order_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `work_order_status_events` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`prior_status` text,
	`new_status` text NOT NULL,
	`reason` text,
	`actor_id` text,
	`actor_name` text NOT NULL,
	`occurred_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_wo_status_events_org_work_occurred` ON `work_order_status_events` (`organization_id`,`work_order_id`,`occurred_at`);--> statement-breakpoint
ALTER TABLE `assets` ADD `asset_tag` text;--> statement-breakpoint
ALTER TABLE `assets` ADD `location` text;--> statement-breakpoint
ALTER TABLE `assets` ADD `condition` text;--> statement-breakpoint
ALTER TABLE `assets` ADD `purchase_cost_cents` integer;--> statement-breakpoint
ALTER TABLE `assets` ADD `last_service_at` text;--> statement-breakpoint
ALTER TABLE `assets` ADD `maintenance_strategy` text;--> statement-breakpoint
ALTER TABLE `assets` ADD `meter_type` text;--> statement-breakpoint
ALTER TABLE `assets` ADD `meter_reading` integer;--> statement-breakpoint
ALTER TABLE `components` ADD `serial` text;--> statement-breakpoint
ALTER TABLE `components` ADD `quantity` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `components` ADD `unit_cost_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `components` ADD `critical_spare` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `store_systems` ADD `code` text;--> statement-breakpoint
ALTER TABLE `store_systems` ADD `description` text;--> statement-breakpoint
ALTER TABLE `store_systems` ADD `location` text;--> statement-breakpoint
ALTER TABLE `store_systems` ADD `gl_code` text;--> statement-breakpoint
ALTER TABLE `store_systems` ADD `annual_budget_cents` integer;--> statement-breakpoint
ALTER TABLE `store_systems` ADD `owner_name` text;--> statement-breakpoint
ALTER TABLE `store_systems` ADD `maintenance_strategy` text;--> statement-breakpoint
ALTER TABLE `stores` ADD `address_1` text;--> statement-breakpoint
ALTER TABLE `stores` ADD `address_2` text;--> statement-breakpoint
ALTER TABLE `stores` ADD `postal_code` text;--> statement-breakpoint
ALTER TABLE `stores` ADD `phone` text;--> statement-breakpoint
ALTER TABLE `stores` ADD `manager_name` text;--> statement-breakpoint
ALTER TABLE `stores` ADD `district` text;--> statement-breakpoint
ALTER TABLE `stores` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `stores` ADD `opened_at` text;--> statement-breakpoint
ALTER TABLE `stores` ADD `square_feet` integer;--> statement-breakpoint
CREATE INDEX `idx_stores_org_address` ON `stores` (`organization_id`,`city`,`postal_code`);--> statement-breakpoint
ALTER TABLE `work_orders` ADD `location` text;--> statement-breakpoint
ALTER TABLE `work_orders` ADD `problem_code` text;--> statement-breakpoint
ALTER TABLE `work_orders` ADD `failure_code` text;--> statement-breakpoint
ALTER TABLE `work_orders` ADD `requested_by` text;--> statement-breakpoint
ALTER TABLE `work_orders` ADD `assignment_type` text DEFAULT 'unassigned' NOT NULL;--> statement-breakpoint
ALTER TABLE `work_orders` ADD `assigned_to_id` text;--> statement-breakpoint
ALTER TABLE `work_orders` ADD `assigned_to_name` text;--> statement-breakpoint
ALTER TABLE `work_orders` ADD `target_response_at` text;--> statement-breakpoint
ALTER TABLE `work_orders` ADD `target_completion_at` text;--> statement-breakpoint
ALTER TABLE `work_orders` ADD `scheduled_start_at` text;--> statement-breakpoint
ALTER TABLE `work_orders` ADD `estimated_minutes` integer;--> statement-breakpoint
ALTER TABLE `work_orders` ADD `actual_minutes` integer;--> statement-breakpoint
ALTER TABLE `work_orders` ADD `downtime_minutes` integer;--> statement-breakpoint
ALTER TABLE `work_orders` ADD `safety_risk` text;--> statement-breakpoint
ALTER TABLE `work_orders` ADD `access_instructions` text;--> statement-breakpoint
ALTER TABLE `work_orders` ADD `resolution_summary` text;--> statement-breakpoint
ALTER TABLE `work_orders` ADD `labor_cost_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `work_orders` ADD `parts_cost_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `work_orders` ADD `travel_cost_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `work_orders` ADD `purchase_order_number` text;--> statement-breakpoint
ALTER TABLE `work_orders` ADD `tags_json` text DEFAULT '[]' NOT NULL;