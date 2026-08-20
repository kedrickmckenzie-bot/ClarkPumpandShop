CREATE TABLE `ops_applied_warranties` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`repair_item_id` text NOT NULL,
	`coverage_type` text NOT NULL,
	`provider` text NOT NULL,
	`obligated_vendor_id` text,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`covered_charges_json` text NOT NULL,
	`routing_rule` text NOT NULL,
	`contract_version_id` text,
	`policy_source` text NOT NULL,
	`rule_source` text,
	`original_calculated_terms_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_applied_warranty_repair_type` ON `ops_applied_warranties` (`organization_id`,`repair_item_id`,`coverage_type`);--> statement-breakpoint
CREATE INDEX `idx_ops_applied_warranty_org_end` ON `ops_applied_warranties` (`organization_id`,`end_date`);--> statement-breakpoint
CREATE TABLE `ops_authorizations` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`authorization_type` text NOT NULL,
	`authorized_amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`authorized_scope` text NOT NULL,
	`approver_membership_id` text NOT NULL,
	`approver_name` text NOT NULL,
	`approval_authority` text NOT NULL,
	`authorized_at` text NOT NULL,
	`reason` text NOT NULL,
	`contract_version_id` text,
	`supersedes_authorization_id` text
);
--> statement-breakpoint
CREATE INDEX `idx_ops_authorizations_org_work_time` ON `ops_authorizations` (`organization_id`,`work_order_id`,`authorized_at`);--> statement-breakpoint
CREATE TABLE `ops_invoice_adjustments` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`invoice_id` text NOT NULL,
	`kind` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`reason` text NOT NULL,
	`created_by_membership_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ops_invoice_adjustments_org_invoice_time` ON `ops_invoice_adjustments` (`organization_id`,`invoice_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `ops_invoice_exceptions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`invoice_id` text NOT NULL,
	`invoice_line_id` text,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`summary` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`detected_at` text NOT NULL,
	`resolved_at` text,
	`resolution_reason` text
);
--> statement-breakpoint
CREATE INDEX `idx_ops_invoice_exceptions_org_status_kind` ON `ops_invoice_exceptions` (`organization_id`,`status`,`kind`);--> statement-breakpoint
CREATE TABLE `ops_invoice_line_allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`invoice_line_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`work_item_id` text,
	`repair_item_id` text,
	`site_visit_work_order_id` text,
	`asset_id` text,
	`component_id` text,
	`store_id` text NOT NULL,
	`trade_key` text,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`method` text NOT NULL,
	`confirmed_by_membership_id` text,
	`confirmed_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_ops_invoice_line_allocations_org_line` ON `ops_invoice_line_allocations` (`organization_id`,`invoice_line_id`);--> statement-breakpoint
CREATE INDEX `idx_ops_invoice_line_allocations_org_work` ON `ops_invoice_line_allocations` (`organization_id`,`work_order_id`);--> statement-breakpoint
CREATE TABLE `ops_invoice_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`invoice_id` text NOT NULL,
	`line_number` integer NOT NULL,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`quantity_thousandths` integer NOT NULL,
	`unit_amount_minor` integer NOT NULL,
	`line_amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`contract_rate_card_line_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_invoice_lines_org_invoice_line` ON `ops_invoice_lines` (`organization_id`,`invoice_id`,`line_number`);--> statement-breakpoint
CREATE TABLE `ops_invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`vendor_id` text NOT NULL,
	`contract_version_id` text,
	`vendor_invoice_number` text NOT NULL,
	`invoice_date` text NOT NULL,
	`subtotal_minor` integer NOT NULL,
	`tax_minor` integer NOT NULL,
	`fees_minor` integer NOT NULL,
	`total_minor` integer NOT NULL,
	`approved_for_payment_minor` integer NOT NULL,
	`paid_amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`status` text NOT NULL,
	`exception_reason` text,
	`supporting_file_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_invoice_records_org_vendor_number` ON `ops_invoices` (`organization_id`,`vendor_id`,`vendor_invoice_number`);--> statement-breakpoint
CREATE INDEX `idx_ops_invoices_org_status_date` ON `ops_invoices` (`organization_id`,`status`,`invoice_date`);--> statement-breakpoint
CREATE TABLE `ops_manufacturer_warranties` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`component_id` text,
	`manufacturer` text NOT NULL,
	`model` text,
	`serial_number` text,
	`parts_coverage` text NOT NULL,
	`labor_coverage` text NOT NULL,
	`start_date` text NOT NULL,
	`expiration_date` text NOT NULL,
	`authorized_provider_rule` text,
	`claim_requirements` text,
	`installing_vendor_id` text,
	`administrator` text,
	`supporting_file_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ops_manufacturer_warranty_org_asset_expiry` ON `ops_manufacturer_warranties` (`organization_id`,`asset_id`,`expiration_date`);--> statement-breakpoint
CREATE TABLE `ops_quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`vendor_id` text NOT NULL,
	`contract_version_id` text,
	`quote_number` text NOT NULL,
	`version` integer NOT NULL,
	`scope` text NOT NULL,
	`subtotal_minor` integer NOT NULL,
	`tax_minor` integer NOT NULL,
	`fees_minor` integer NOT NULL,
	`total_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`submitted_at` text NOT NULL,
	`expires_at` text,
	`supersedes_quote_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_quotes_org_vendor_number_version` ON `ops_quotes` (`organization_id`,`vendor_id`,`quote_number`,`version`);--> statement-breakpoint
CREATE TABLE `ops_repair_items` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`site_visit_work_order_id` text NOT NULL,
	`vendor_id` text NOT NULL,
	`contract_version_id` text,
	`asset_id` text NOT NULL,
	`component_id` text,
	`failure_code` text NOT NULL,
	`repair_action` text NOT NULL,
	`repair_severity` text NOT NULL,
	`removed_component_id` text,
	`installed_component_id` text,
	`part_manufacturer` text,
	`part_model` text,
	`serial_number` text,
	`vendor_supplied` integer DEFAULT false NOT NULL,
	`completion_date` text NOT NULL,
	`verification_date` text,
	`labor_cost_minor` integer NOT NULL,
	`part_cost_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`root_cause` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ops_repair_items_org_work` ON `ops_repair_items` (`organization_id`,`work_order_id`);--> statement-breakpoint
CREATE INDEX `idx_ops_repair_items_org_asset_component_date` ON `ops_repair_items` (`organization_id`,`asset_id`,`component_id`,`completion_date`);--> statement-breakpoint
CREATE TABLE `ops_service_discrepancies` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`invoice_id` text,
	`site_visit_work_order_id` text,
	`discrepancy_type` text NOT NULL,
	`status` text NOT NULL,
	`facts_json` text NOT NULL,
	`vendor_response` text,
	`resolution` text,
	`created_at` text NOT NULL,
	`resolved_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_ops_service_discrepancies_org_status` ON `ops_service_discrepancies` (`organization_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_ops_service_discrepancies_org_work` ON `ops_service_discrepancies` (`organization_id`,`work_order_id`);--> statement-breakpoint
CREATE TABLE `ops_value_events` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`category` text NOT NULL,
	`event_type` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`work_order_id` text,
	`invoice_line_id` text,
	`service_run_id` text,
	`contract_version_id` text,
	`warranty_case_id` text,
	`asset_id` text,
	`approval_decision_id` text,
	`source_decision` text NOT NULL,
	`deduplication_key` text NOT NULL,
	`occurred_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_value_events_org_dedup` ON `ops_value_events` (`organization_id`,`deduplication_key`);--> statement-breakpoint
CREATE INDEX `idx_ops_value_events_org_category_time` ON `ops_value_events` (`organization_id`,`category`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `ops_vendor_warranty_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`vendor_id` text NOT NULL,
	`base_labor_days` integer NOT NULL,
	`base_parts_days` integer NOT NULL,
	`base_travel_days` integer NOT NULL,
	`base_diagnostic_days` integer NOT NULL,
	`effective_starts_at` text NOT NULL,
	`effective_ends_at` text,
	`status` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ops_vendor_warranty_profiles_org_vendor_status` ON `ops_vendor_warranty_profiles` (`organization_id`,`vendor_id`,`status`);--> statement-breakpoint
CREATE TABLE `ops_warranty_amendments` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`applied_warranty_id` text NOT NULL,
	`amendment_kind` text NOT NULL,
	`applies_to_repair_only` integer DEFAULT false NOT NULL,
	`amended_terms_json` text NOT NULL,
	`reason` text NOT NULL,
	`decided_by_membership_id` text NOT NULL,
	`decided_by_name` text NOT NULL,
	`decided_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ops_warranty_amendments_org_applied_time` ON `ops_warranty_amendments` (`organization_id`,`applied_warranty_id`,`decided_at`);--> statement-breakpoint
CREATE TABLE `ops_warranty_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`request_id` text,
	`work_order_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`component_id` text,
	`prior_repair_item_id` text,
	`applied_warranty_id` text,
	`manufacturer_warranty_id` text,
	`status` text NOT NULL,
	`confidence` text NOT NULL,
	`detection_explanation` text NOT NULL,
	`diagnosis_required` integer DEFAULT false NOT NULL,
	`coverage_decision` text NOT NULL,
	`customer_charge_status` text NOT NULL,
	`invoice_hold` integer DEFAULT false NOT NULL,
	`routing_rule` text NOT NULL,
	`obligated_vendor_id` text,
	`vendor_response_due_at` text,
	`created_at` text NOT NULL,
	`closed_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_ops_warranty_cases_org_status_vendor_due` ON `ops_warranty_cases` (`organization_id`,`status`,`obligated_vendor_id`,`vendor_response_due_at`);--> statement-breakpoint
CREATE INDEX `idx_ops_warranty_cases_org_asset` ON `ops_warranty_cases` (`organization_id`,`asset_id`);--> statement-breakpoint
CREATE TABLE `ops_warranty_coverage_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`warranty_rule_id` text,
	`vendor_warranty_profile_id` text,
	`coverage_type` text NOT NULL,
	`duration` integer NOT NULL,
	`duration_unit` text NOT NULL,
	`start_event` text NOT NULL,
	`provider` text NOT NULL,
	`obligated_vendor_id` text,
	`routing_rule` text NOT NULL,
	`deductible_minor` integer NOT NULL,
	`maximum_coverage_minor` integer,
	`currency` text NOT NULL,
	`conditions` text,
	`exclusions` text
);
--> statement-breakpoint
CREATE INDEX `idx_ops_warranty_coverage_org_rule_type` ON `ops_warranty_coverage_lines` (`organization_id`,`warranty_rule_id`,`coverage_type`);--> statement-breakpoint
CREATE TABLE `ops_warranty_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`vendor_warranty_profile_id` text NOT NULL,
	`vendor_id` text NOT NULL,
	`contract_version_id` text,
	`trade_key` text,
	`work_type` text,
	`service_type` text,
	`asset_type` text,
	`component_type` text,
	`manufacturer` text,
	`model` text,
	`vendor_supplied_part` integer,
	`customer_supplied_part` integer,
	`region_id` text,
	`store_id` text,
	`priority` integer NOT NULL,
	`effective_starts_at` text NOT NULL,
	`effective_ends_at` text,
	`status` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ops_warranty_rules_org_vendor_status_priority` ON `ops_warranty_rules` (`organization_id`,`vendor_id`,`status`,`priority`);
