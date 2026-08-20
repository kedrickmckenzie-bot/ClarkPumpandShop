CREATE TABLE `ops_checklist_responses` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`work_item_id` text NOT NULL,
	`checklist_template_id` text NOT NULL,
	`item_key` text NOT NULL,
	`response_kind` text NOT NULL,
	`passed` integer,
	`numeric_value` integer,
	`text_value` text,
	`measurement_unit` text,
	`evidence_file_ids_json` text DEFAULT '[]' NOT NULL,
	`recorded_by_actor_type` text NOT NULL,
	`recorded_by_actor_id` text,
	`recorded_by_actor_name` text NOT NULL,
	`recorded_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_checklist_responses_org_work_item_key` ON `ops_checklist_responses` (`organization_id`,`work_item_id`,`item_key`);--> statement-breakpoint
CREATE TABLE `ops_checklist_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`version` integer NOT NULL,
	`items_json` text DEFAULT '[]' NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_checklist_templates_org_name_version` ON `ops_checklist_templates` (`organization_id`,`name`,`version`);--> statement-breakpoint
CREATE TABLE `ops_contract_scopes` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`contract_version_id` text NOT NULL,
	`scope_kind` text NOT NULL,
	`scope_id` text NOT NULL,
	`included` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_contract_scopes_org_version_scope` ON `ops_contract_scopes` (`organization_id`,`contract_version_id`,`scope_kind`,`scope_id`);--> statement-breakpoint
CREATE TABLE `ops_contract_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`contract_id` text NOT NULL,
	`vendor_id` text NOT NULL,
	`version` integer NOT NULL,
	`source_agreement_reference` text NOT NULL,
	`status` text NOT NULL,
	`effective_starts_at` text NOT NULL,
	`effective_ends_at` text,
	`renewal_at` text,
	`notice_days` integer,
	`price_escalation_at` text,
	`supersedes_contract_version_id` text,
	`currency` text NOT NULL,
	`preferred_provider` integer DEFAULT false NOT NULL,
	`exclusive_provider` integer DEFAULT false NOT NULL,
	`reactive_work_allowed` integer DEFAULT false NOT NULL,
	`emergency_work_allowed` integer DEFAULT false NOT NULL,
	`pm_work_allowed` integer DEFAULT false NOT NULL,
	`subcontractor_policy` text NOT NULL,
	`scheduling_mode` text NOT NULL,
	`reserved_capacity_minutes` integer NOT NULL,
	`nte_amount_minor` integer,
	`materials_markup_bps` integer NOT NULL,
	`route_discount_bps` integer NOT NULL,
	`evidence_requirements_json` text DEFAULT '[]' NOT NULL,
	`compliance_requirements_json` text DEFAULT '[]' NOT NULL,
	`warranty_labor_days` integer,
	`warranty_parts_days` integer,
	`warranty_travel_days` integer,
	`created_by_membership_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_contract_versions_org_contract_version` ON `ops_contract_versions` (`organization_id`,`contract_id`,`version`);--> statement-breakpoint
CREATE INDEX `idx_ops_contract_versions_org_vendor_effective` ON `ops_contract_versions` (`organization_id`,`vendor_id`,`status`,`effective_starts_at`);--> statement-breakpoint
CREATE TABLE `ops_maintenance_programs` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`program_key` text NOT NULL,
	`version` integer NOT NULL,
	`name` text NOT NULL,
	`trade_key` text NOT NULL,
	`work_type` text NOT NULL,
	`applicable_asset_types_json` text DEFAULT '[]' NOT NULL,
	`frequency_days` integer NOT NULL,
	`recurrence_kind` text NOT NULL,
	`due_window_days` integer NOT NULL,
	`seasonal_start_month` integer,
	`seasonal_end_month` integer,
	`checklist_template_id` text NOT NULL,
	`required_evidence_kinds_json` text DEFAULT '[]' NOT NULL,
	`expected_duration_minutes` integer NOT NULL,
	`completion_criteria` text NOT NULL,
	`corrective_work_authority_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`deficiency_handling` text NOT NULL,
	`status` text NOT NULL,
	`supersedes_program_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_maintenance_program_org_key_version` ON `ops_maintenance_programs` (`organization_id`,`program_key`,`version`);--> statement-breakpoint
CREATE INDEX `idx_ops_maintenance_program_org_status_trade` ON `ops_maintenance_programs` (`organization_id`,`status`,`trade_key`);--> statement-breakpoint
CREATE TABLE `ops_pm_work_items` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`occurrence_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`component_id` text,
	`required_task` text NOT NULL,
	`checklist_template_id` text NOT NULL,
	`status` text NOT NULL,
	`result` text,
	`deficiency` text,
	`follow_up_id` text,
	`corrective_work_order_id` text,
	`cost_allocation_minor` integer,
	`currency` text NOT NULL,
	`created_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_ops_pm_work_items_org_occurrence` ON `ops_pm_work_items` (`organization_id`,`occurrence_id`,`asset_id`);--> statement-breakpoint
CREATE INDEX `idx_ops_pm_work_items_org_work` ON `ops_pm_work_items` (`organization_id`,`work_order_id`);--> statement-breakpoint
CREATE TABLE `ops_rate_card_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`contract_version_id` text NOT NULL,
	`charge_type` text NOT NULL,
	`description` text NOT NULL,
	`unit` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`effective_starts_at` text NOT NULL,
	`effective_ends_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_ops_rate_card_org_contract_type` ON `ops_rate_card_lines` (`organization_id`,`contract_version_id`,`charge_type`);--> statement-breakpoint
CREATE TABLE `ops_route_stops` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`service_run_id` text NOT NULL,
	`store_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`proposed_arrival_at` text NOT NULL,
	`committed_arrival_at` text,
	`estimated_drive_minutes` integer NOT NULL,
	`estimated_service_minutes` integer NOT NULL,
	`access_requirements` text,
	`status` text NOT NULL,
	`site_visit_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_route_stops_org_run_sequence` ON `ops_route_stops` (`organization_id`,`service_run_id`,`sequence`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_route_stops_org_run_store` ON `ops_route_stops` (`organization_id`,`service_run_id`,`store_id`);--> statement-breakpoint
CREATE TABLE `ops_scheduling_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`contract_version_id` text NOT NULL,
	`maximum_route_minutes` integer NOT NULL,
	`maximum_stores` integer NOT NULL,
	`maximum_travel_minutes` integer NOT NULL,
	`maximum_utilization_bps` integer NOT NULL,
	`per_stop_buffer_minutes` integer NOT NULL,
	`travel_buffer_bps` integer NOT NULL,
	`documentation_buffer_minutes` integer NOT NULL,
	`uncertainty_buffer_bps` integer NOT NULL,
	`emergency_reserve_minutes` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_scheduling_policy_org_contract` ON `ops_scheduling_policies` (`organization_id`,`contract_version_id`);--> statement-breakpoint
CREATE TABLE `ops_service_level_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`contract_version_id` text NOT NULL,
	`priority` text NOT NULL,
	`response_minutes` integer NOT NULL,
	`arrival_minutes` integer NOT NULL,
	`completion_minutes` integer NOT NULL,
	`calendar` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_service_level_org_contract_priority` ON `ops_service_level_policies` (`organization_id`,`contract_version_id`,`priority`);--> statement-breakpoint
CREATE TABLE `ops_service_run_responses` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`service_run_id` text NOT NULL,
	`response` text NOT NULL,
	`requested_starts_at` text,
	`requested_stop_changes_json` text,
	`requested_work_order_changes_json` text,
	`reason_code` text,
	`reason_detail` text,
	`travel_impact_minutes` integer NOT NULL,
	`due_window_impact_count` integer NOT NULL,
	`economic_impact_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`responder_name` text NOT NULL,
	`responded_at` text NOT NULL,
	`resulting_plan_json` text
);
--> statement-breakpoint
CREATE INDEX `idx_ops_service_run_responses_org_run_time` ON `ops_service_run_responses` (`organization_id`,`service_run_id`,`responded_at`);--> statement-breakpoint
CREATE TABLE `ops_service_run_work_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`service_run_id` text NOT NULL,
	`route_stop_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`occurrence_id` text,
	`planned` integer DEFAULT false NOT NULL,
	`estimated_duration_minutes` integer NOT NULL,
	`addressed` integer DEFAULT false NOT NULL,
	`removal_reason` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_service_run_work_org_run_work` ON `ops_service_run_work_orders` (`organization_id`,`service_run_id`,`work_order_id`);--> statement-breakpoint
CREATE INDEX `idx_ops_service_run_work_org_work` ON `ops_service_run_work_orders` (`organization_id`,`work_order_id`);--> statement-breakpoint
CREATE TABLE `ops_service_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`vendor_id` text NOT NULL,
	`contract_version_id` text NOT NULL,
	`scheduling_mode` text NOT NULL,
	`status` text NOT NULL,
	`proposed_starts_at` text NOT NULL,
	`proposed_ends_at` text NOT NULL,
	`response_due_at` text NOT NULL,
	`committed_starts_at` text,
	`committed_ends_at` text,
	`estimated_drive_minutes` integer NOT NULL,
	`estimated_service_minutes` integer NOT NULL,
	`capacity_used_minutes` integer NOT NULL,
	`expected_work_value_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`estimated_trip_reduction` integer NOT NULL,
	`estimated_opportunity_minor` integer NOT NULL,
	`recommendation_explanation` text NOT NULL,
	`required_qualifications_json` text DEFAULT '[]' NOT NULL,
	`constraints_json` text NOT NULL,
	`confidence` text NOT NULL,
	`scheduler_version` text NOT NULL,
	`original_recommendation_json` text NOT NULL,
	`created_by_actor_type` text NOT NULL,
	`created_by_actor_id` text,
	`created_by_actor_name` text NOT NULL,
	`created_at` text NOT NULL,
	`accepted_at` text,
	`completed_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_ops_service_runs_org_vendor_status_start` ON `ops_service_runs` (`organization_id`,`vendor_id`,`status`,`proposed_starts_at`);--> statement-breakpoint
CREATE TABLE `ops_vendor_capacity` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`vendor_id` text NOT NULL,
	`region_id` text NOT NULL,
	`trade_key` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`crew_minutes` integer NOT NULL,
	`committed_minutes` integer NOT NULL,
	`maximum_route_minutes` integer NOT NULL,
	`maximum_stores` integer NOT NULL,
	`maximum_travel_minutes` integer NOT NULL,
	`blackout` integer DEFAULT false NOT NULL,
	`emergency_reserve_minutes` integer NOT NULL,
	`variable_work_limit_minutes` integer NOT NULL,
	`special_equipment_json` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ops_vendor_capacity_org_vendor_window` ON `ops_vendor_capacity` (`organization_id`,`vendor_id`,`starts_at`,`ends_at`);--> statement-breakpoint
CREATE INDEX `idx_ops_vendor_capacity_org_region_trade` ON `ops_vendor_capacity` (`organization_id`,`region_id`,`trade_key`,`starts_at`);--> statement-breakpoint
CREATE TABLE `ops_vendor_compliance_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`vendor_id` text NOT NULL,
	`document_type` text NOT NULL,
	`issuer` text,
	`reference` text,
	`effective_at` text,
	`expires_at` text,
	`review_status` text NOT NULL,
	`blocking` integer DEFAULT false NOT NULL,
	`stored_file_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ops_vendor_compliance_org_vendor_status_expiry` ON `ops_vendor_compliance_documents` (`organization_id`,`vendor_id`,`review_status`,`expires_at`);--> statement-breakpoint
CREATE TABLE `ops_vendor_contracts` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`vendor_id` text NOT NULL,
	`name` text NOT NULL,
	`owner_membership_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ops_vendor_contracts_org_vendor_status` ON `ops_vendor_contracts` (`organization_id`,`vendor_id`,`status`);--> statement-breakpoint
CREATE TABLE `ops_vendor_qualifications` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`vendor_id` text NOT NULL,
	`trade_key` text NOT NULL,
	`work_type` text,
	`service_type` text,
	`asset_type` text,
	`component_type` text,
	`pm_work` integer DEFAULT false NOT NULL,
	`emergency_response` integer DEFAULT false NOT NULL,
	`warranty_work` integer DEFAULT false NOT NULL,
	`manufacturer_authorization` text,
	`region_id` text,
	`store_id` text,
	`after_hours` integer DEFAULT false NOT NULL,
	`maximum_job_amount_minor` integer,
	`currency` text,
	`required_license` text,
	`required_certification` text,
	`effective_at` text NOT NULL,
	`expires_at` text,
	`status` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ops_vendor_qualifications_org_vendor_trade` ON `ops_vendor_qualifications` (`organization_id`,`vendor_id`,`trade_key`,`status`);--> statement-breakpoint
CREATE INDEX `idx_ops_vendor_qualifications_org_scope` ON `ops_vendor_qualifications` (`organization_id`,`region_id`,`store_id`);--> statement-breakpoint
ALTER TABLE `ops_pm_occurrences` ADD `program_id` text;--> statement-breakpoint
ALTER TABLE `ops_pm_occurrences` ADD `program_version` integer;--> statement-breakpoint
ALTER TABLE `ops_pm_occurrences` ADD `plan_version` integer;--> statement-breakpoint
ALTER TABLE `ops_pm_occurrences` ADD `proposed_at` text;--> statement-breakpoint
ALTER TABLE `ops_pm_occurrences` ADD `committed_at` text;--> statement-breakpoint
ALTER TABLE `ops_pm_occurrences` ADD `result` text;--> statement-breakpoint
ALTER TABLE `ops_pm_occurrences` ADD `exception_reason` text;--> statement-breakpoint
ALTER TABLE `ops_pm_occurrences` ADD `recurrence_key` text;--> statement-breakpoint
ALTER TABLE `ops_pm_occurrences` ADD `created_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_pm_occurrences_org_plan_recurrence` ON `ops_pm_occurrences` (`organization_id`,`plan_id`,`recurrence_key`);--> statement-breakpoint
ALTER TABLE `ops_pm_plans` ADD `program_id` text;--> statement-breakpoint
ALTER TABLE `ops_pm_plans` ADD `program_version` integer;--> statement-breakpoint
ALTER TABLE `ops_pm_plans` ADD `asset_selection_rule` text;--> statement-breakpoint
ALTER TABLE `ops_pm_plans` ADD `preferred_vendor_id` text;--> statement-breakpoint
ALTER TABLE `ops_pm_plans` ADD `backup_vendor_id` text;--> statement-breakpoint
ALTER TABLE `ops_pm_plans` ADD `contract_version_id` text;--> statement-breakpoint
ALTER TABLE `ops_pm_plans` ADD `effective_starts_at` text;--> statement-breakpoint
ALTER TABLE `ops_pm_plans` ADD `effective_ends_at` text;--> statement-breakpoint
ALTER TABLE `ops_pm_plans` ADD `access_requirements` text;--> statement-breakpoint
ALTER TABLE `ops_pm_plans` ADD `program_authorization_minor` integer;--> statement-breakpoint
ALTER TABLE `ops_pm_plans` ADD `budget_minor` integer;--> statement-breakpoint
ALTER TABLE `ops_pm_plans` ADD `currency` text;--> statement-breakpoint
ALTER TABLE `ops_pm_plans` ADD `service_level_policy_id` text;--> statement-breakpoint
ALTER TABLE `ops_pm_plans` ADD `scheduling_mode` text;--> statement-breakpoint
ALTER TABLE `ops_pm_plans` ADD `escalation_rules` text;