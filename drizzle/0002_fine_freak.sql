CREATE TABLE `accounting_cost_centers` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`scope_type` text NOT NULL,
	`parent_cost_center_id` text,
	`region_id` text,
	`store_id` text,
	`external_reference` text,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_cost_centers_org_code_effective` ON `accounting_cost_centers` (`organization_id`,`code`,`effective_from`);--> statement-breakpoint
CREATE INDEX `idx_cost_centers_org_active_code` ON `accounting_cost_centers` (`organization_id`,`active`,`code`);--> statement-breakpoint
CREATE INDEX `idx_cost_centers_org_parent` ON `accounting_cost_centers` (`organization_id`,`parent_cost_center_id`);--> statement-breakpoint
CREATE INDEX `idx_cost_centers_org_store` ON `accounting_cost_centers` (`organization_id`,`store_id`);--> statement-breakpoint
CREATE INDEX `idx_cost_centers_org_region` ON `accounting_cost_centers` (`organization_id`,`region_id`);--> statement-breakpoint
CREATE TABLE `accruals` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`accrual_number` text NOT NULL,
	`accounting_period` text NOT NULL,
	`work_order_id` text NOT NULL,
	`provider_id` text,
	`basis` text NOT NULL,
	`status` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`gl_account_id` text,
	`accounting_cost_center_id` text,
	`service_through_at` text NOT NULL,
	`recorded_at` text NOT NULL,
	`reverses_accrual_id` text,
	`reversal_invoice_id` text,
	`recorded_by_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_accruals_org_number` ON `accruals` (`organization_id`,`accrual_number`);--> statement-breakpoint
CREATE INDEX `idx_accruals_org_period_status` ON `accruals` (`organization_id`,`accounting_period`,`status`);--> statement-breakpoint
CREATE INDEX `idx_accruals_org_work` ON `accruals` (`organization_id`,`work_order_id`);--> statement-breakpoint
CREATE INDEX `idx_accruals_org_provider` ON `accruals` (`organization_id`,`provider_id`,`accounting_period`);--> statement-breakpoint
CREATE TABLE `approval_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`decision_key` text NOT NULL,
	`subject_type` text NOT NULL,
	`subject_id` text NOT NULL,
	`policy_key` text,
	`step_sequence` integer DEFAULT 1 NOT NULL,
	`decision` text NOT NULL,
	`amount_cents` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`decided_by_id` text,
	`decided_by_name` text NOT NULL,
	`reason` text,
	`supersedes_decision_id` text,
	`decided_at` text NOT NULL,
	`context_json` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_approval_decisions_org_key` ON `approval_decisions` (`organization_id`,`decision_key`);--> statement-breakpoint
CREATE INDEX `idx_approval_decisions_org_subject` ON `approval_decisions` (`organization_id`,`subject_type`,`subject_id`,`decided_at`);--> statement-breakpoint
CREATE INDEX `idx_approval_decisions_org_decision` ON `approval_decisions` (`organization_id`,`decision`,`decided_at`);--> statement-breakpoint
CREATE TABLE `budget_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`budget_id` text NOT NULL,
	`line_number` integer NOT NULL,
	`description` text,
	`region_id` text,
	`store_id` text,
	`service_category_id` text,
	`gl_account_id` text NOT NULL,
	`accounting_cost_center_id` text NOT NULL,
	`approved_cents` integer DEFAULT 0 NOT NULL,
	`revised_cents` integer DEFAULT 0 NOT NULL,
	`dimensions_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_budget_lines_org_budget_line` ON `budget_lines` (`organization_id`,`budget_id`,`line_number`);--> statement-breakpoint
CREATE INDEX `idx_budget_lines_org_accounting` ON `budget_lines` (`organization_id`,`accounting_cost_center_id`,`gl_account_id`);--> statement-breakpoint
CREATE INDEX `idx_budget_lines_org_store_category` ON `budget_lines` (`organization_id`,`store_id`,`service_category_id`);--> statement-breakpoint
CREATE TABLE `budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`code` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`name` text NOT NULL,
	`fiscal_year` integer NOT NULL,
	`status` text NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`approved_cents` integer DEFAULT 0 NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`approved_by_id` text,
	`approved_at` text,
	`supersedes_budget_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_budgets_org_year_code_version` ON `budgets` (`organization_id`,`fiscal_year`,`code`,`version`);--> statement-breakpoint
CREATE INDEX `idx_budgets_org_year_status` ON `budgets` (`organization_id`,`fiscal_year`,`status`);--> statement-breakpoint
CREATE TABLE `canonical_taxonomy_concepts` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`concept_type` text NOT NULL,
	`canonical_key` text NOT NULL,
	`canonical_name` text NOT NULL,
	`parent_concept_id` text,
	`description` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`retired_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_taxonomy_concepts_org_type_key` ON `canonical_taxonomy_concepts` (`organization_id`,`concept_type`,`canonical_key`);--> statement-breakpoint
CREATE INDEX `idx_taxonomy_concepts_org_parent` ON `canonical_taxonomy_concepts` (`organization_id`,`concept_type`,`parent_concept_id`);--> statement-breakpoint
CREATE INDEX `idx_taxonomy_concepts_org_active` ON `canonical_taxonomy_concepts` (`organization_id`,`concept_type`,`active`);--> statement-breakpoint
CREATE TABLE `gl_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`account_type` text NOT NULL,
	`parent_gl_account_id` text,
	`external_reference` text,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_gl_accounts_org_code_effective` ON `gl_accounts` (`organization_id`,`code`,`effective_from`);--> statement-breakpoint
CREATE INDEX `idx_gl_accounts_org_active_code` ON `gl_accounts` (`organization_id`,`active`,`code`);--> statement-breakpoint
CREATE INDEX `idx_gl_accounts_org_parent` ON `gl_accounts` (`organization_id`,`parent_gl_account_id`);--> statement-breakpoint
CREATE TABLE `invoice_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`invoice_id` text NOT NULL,
	`line_number` integer NOT NULL,
	`purchase_order_line_id` text,
	`description` text NOT NULL,
	`quantity_milli` integer DEFAULT 1000 NOT NULL,
	`unit_cost_cents` integer DEFAULT 0 NOT NULL,
	`line_total_cents` integer DEFAULT 0 NOT NULL,
	`cost_category` text NOT NULL,
	`service_started_at` text,
	`service_ended_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_invoice_lines_org_invoice_line` ON `invoice_lines` (`organization_id`,`invoice_id`,`line_number`);--> statement-breakpoint
CREATE INDEX `idx_invoice_lines_org_po_line` ON `invoice_lines` (`organization_id`,`purchase_order_line_id`);--> statement-breakpoint
CREATE TABLE `organization_labels` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`semantic_key` text NOT NULL,
	`singular_label` text NOT NULL,
	`plural_label` text NOT NULL,
	`short_label` text,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`created_by_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_org_labels_semantic_effective` ON `organization_labels` (`organization_id`,`semantic_key`,`effective_from`);--> statement-breakpoint
CREATE INDEX `idx_org_labels_org_current` ON `organization_labels` (`organization_id`,`semantic_key`,`effective_to`);--> statement-breakpoint
CREATE TABLE `payment_records` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`source_system` text NOT NULL,
	`external_reference` text NOT NULL,
	`invoice_id` text,
	`provider_id` text NOT NULL,
	`status` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`payment_date` text,
	`observed_at` text NOT NULL,
	`reverses_payment_record_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_payment_records_org_source_ref` ON `payment_records` (`organization_id`,`source_system`,`external_reference`);--> statement-breakpoint
CREATE INDEX `idx_payment_records_org_invoice_status` ON `payment_records` (`organization_id`,`invoice_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_payment_records_org_provider_date` ON `payment_records` (`organization_id`,`provider_id`,`payment_date`);--> statement-breakpoint
CREATE TABLE `proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`proposal_number` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`work_order_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`status` text NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`requested_estimate_cents` integer DEFAULT 0 NOT NULL,
	`quoted_cents` integer DEFAULT 0 NOT NULL,
	`approved_cents` integer DEFAULT 0 NOT NULL,
	`submitted_at` text,
	`valid_through` text,
	`decided_at` text,
	`supersedes_proposal_id` text,
	`document_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_proposals_org_provider_number_rev` ON `proposals` (`organization_id`,`provider_id`,`proposal_number`,`revision`);--> statement-breakpoint
CREATE INDEX `idx_proposals_org_work_status` ON `proposals` (`organization_id`,`work_order_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_proposals_org_provider_status` ON `proposals` (`organization_id`,`provider_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_proposals_org_valid` ON `proposals` (`organization_id`,`status`,`valid_through`);--> statement-breakpoint
CREATE TABLE `purchase_order_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`purchase_order_id` text NOT NULL,
	`line_number` integer NOT NULL,
	`description` text NOT NULL,
	`quantity_milli` integer DEFAULT 1000 NOT NULL,
	`unit_cost_cents` integer DEFAULT 0 NOT NULL,
	`line_total_cents` integer DEFAULT 0 NOT NULL,
	`cost_category` text NOT NULL,
	`work_order_id` text,
	`store_id` text,
	`gl_account_id` text,
	`accounting_cost_center_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_po_lines_org_order_line` ON `purchase_order_lines` (`organization_id`,`purchase_order_id`,`line_number`);--> statement-breakpoint
CREATE INDEX `idx_po_lines_org_work` ON `purchase_order_lines` (`organization_id`,`work_order_id`);--> statement-breakpoint
CREATE INDEX `idx_po_lines_org_accounting` ON `purchase_order_lines` (`organization_id`,`accounting_cost_center_id`,`gl_account_id`);--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`number` text NOT NULL,
	`work_order_id` text,
	`provider_id` text NOT NULL,
	`proposal_id` text,
	`status` text NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`committed_cents` integer DEFAULT 0 NOT NULL,
	`issued_at` text,
	`expected_completion_at` text,
	`closed_at` text,
	`created_by_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_purchase_orders_org_number` ON `purchase_orders` (`organization_id`,`number`);--> statement-breakpoint
CREATE INDEX `idx_purchase_orders_org_provider_status` ON `purchase_orders` (`organization_id`,`provider_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_purchase_orders_org_work_status` ON `purchase_orders` (`organization_id`,`work_order_id`,`status`);--> statement-breakpoint
CREATE TABLE `service_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`assignment_number` text NOT NULL,
	`work_order_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`assignment_role` text DEFAULT 'primary' NOT NULL,
	`fulfillment_mode` text NOT NULL,
	`status` text NOT NULL,
	`requested_start_at` text,
	`requested_end_at` text,
	`assigned_at` text NOT NULL,
	`acknowledged_at` text,
	`completed_at` text,
	`cancelled_at` text,
	`supersedes_assignment_id` text,
	`created_by_id` text,
	`context_json` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_service_assignments_org_number` ON `service_assignments` (`organization_id`,`assignment_number`);--> statement-breakpoint
CREATE INDEX `idx_service_assignments_org_work_status` ON `service_assignments` (`organization_id`,`work_order_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_service_assignments_org_provider_status` ON `service_assignments` (`organization_id`,`provider_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_service_assignments_org_status_start` ON `service_assignments` (`organization_id`,`status`,`requested_start_at`);--> statement-breakpoint
CREATE TABLE `service_channel_events` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`event_key` text NOT NULL,
	`assignment_id` text,
	`work_order_id` text NOT NULL,
	`provider_id` text,
	`channel` text NOT NULL,
	`event_type` text NOT NULL,
	`actor_type` text NOT NULL,
	`actor_id` text,
	`actor_name` text NOT NULL,
	`token_id` text,
	`external_message_id` text,
	`occurred_at` text NOT NULL,
	`payload_json` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_service_channel_events_org_key` ON `service_channel_events` (`organization_id`,`event_key`);--> statement-breakpoint
CREATE INDEX `idx_service_channel_events_org_assignment` ON `service_channel_events` (`organization_id`,`assignment_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_service_channel_events_org_work` ON `service_channel_events` (`organization_id`,`work_order_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_service_channel_events_org_provider` ON `service_channel_events` (`organization_id`,`provider_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `service_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`provider_type` text NOT NULL,
	`vendor_id` text,
	`person_id` text,
	`internal_team_key` text,
	`default_currency` text DEFAULT 'USD' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`retired_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_service_providers_org_code` ON `service_providers` (`organization_id`,`code`);--> statement-breakpoint
CREATE INDEX `idx_service_providers_org_type_status` ON `service_providers` (`organization_id`,`provider_type`,`status`);--> statement-breakpoint
CREATE INDEX `idx_service_providers_org_vendor` ON `service_providers` (`organization_id`,`vendor_id`);--> statement-breakpoint
CREATE INDEX `idx_service_providers_org_person` ON `service_providers` (`organization_id`,`person_id`);--> statement-breakpoint
CREATE TABLE `taxonomy_concept_aliases` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`concept_id` text NOT NULL,
	`concept_type` text NOT NULL,
	`alias` text NOT NULL,
	`normalized_alias` text NOT NULL,
	`locale` text DEFAULT 'en-US' NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`retired_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_taxonomy_aliases_org_type_alias` ON `taxonomy_concept_aliases` (`organization_id`,`concept_type`,`normalized_alias`);--> statement-breakpoint
CREATE INDEX `idx_taxonomy_aliases_org_concept` ON `taxonomy_concept_aliases` (`organization_id`,`concept_id`,`active`);--> statement-breakpoint
ALTER TABLE `cost_allocations` ADD `source_line_key` text;--> statement-breakpoint
ALTER TABLE `cost_allocations` ADD `financial_stage` text DEFAULT 'invoiced' NOT NULL;--> statement-breakpoint
ALTER TABLE `cost_allocations` ADD `entry_type` text DEFAULT 'original' NOT NULL;--> statement-breakpoint
ALTER TABLE `cost_allocations` ADD `reverses_allocation_id` text;--> statement-breakpoint
ALTER TABLE `cost_allocations` ADD `provider_id` text;--> statement-breakpoint
ALTER TABLE `cost_allocations` ADD `region_id` text;--> statement-breakpoint
ALTER TABLE `cost_allocations` ADD `gl_account_id` text;--> statement-breakpoint
ALTER TABLE `cost_allocations` ADD `accounting_cost_center_id` text;--> statement-breakpoint
ALTER TABLE `cost_allocations` ADD `budget_id` text;--> statement-breakpoint
ALTER TABLE `cost_allocations` ADD `budget_line_id` text;--> statement-breakpoint
ALTER TABLE `cost_allocations` ADD `proposal_id` text;--> statement-breakpoint
ALTER TABLE `cost_allocations` ADD `purchase_order_id` text;--> statement-breakpoint
ALTER TABLE `cost_allocations` ADD `purchase_order_line_id` text;--> statement-breakpoint
ALTER TABLE `cost_allocations` ADD `invoice_id` text;--> statement-breakpoint
ALTER TABLE `cost_allocations` ADD `invoice_line_id` text;--> statement-breakpoint
ALTER TABLE `cost_allocations` ADD `credit_id` text;--> statement-breakpoint
ALTER TABLE `cost_allocations` ADD `payment_record_id` text;--> statement-breakpoint
ALTER TABLE `cost_allocations` ADD `accrual_id` text;--> statement-breakpoint
ALTER TABLE `cost_allocations` ADD `currency` text DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE `cost_allocations` ADD `dimensions_json` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `cost_allocations` ADD `effective_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_alloc_org_financial_line` ON `cost_allocations` (`organization_id`,`financial_type`,`financial_id`,`source_line_key`);--> statement-breakpoint
CREATE INDEX `idx_alloc_org_stage_effective` ON `cost_allocations` (`organization_id`,`financial_stage`,`effective_at`);--> statement-breakpoint
CREATE INDEX `idx_alloc_org_provider_stage` ON `cost_allocations` (`organization_id`,`provider_id`,`financial_stage`);--> statement-breakpoint
CREATE INDEX `idx_alloc_org_accounting_dims` ON `cost_allocations` (`organization_id`,`accounting_cost_center_id`,`gl_account_id`,`financial_stage`);--> statement-breakpoint
CREATE INDEX `idx_alloc_org_budget_stage` ON `cost_allocations` (`organization_id`,`budget_id`,`budget_line_id`,`financial_stage`);--> statement-breakpoint
CREATE INDEX `idx_alloc_org_region_store_stage` ON `cost_allocations` (`organization_id`,`region_id`,`store_id`,`financial_stage`);--> statement-breakpoint
CREATE INDEX `idx_alloc_org_po_line` ON `cost_allocations` (`organization_id`,`purchase_order_id`,`purchase_order_line_id`);--> statement-breakpoint
CREATE INDEX `idx_alloc_org_invoice_line` ON `cost_allocations` (`organization_id`,`invoice_id`,`invoice_line_id`);