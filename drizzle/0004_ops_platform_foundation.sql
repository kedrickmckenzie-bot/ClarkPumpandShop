CREATE TABLE `ops_asset_components` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`parent_component_id` text,
	`name` text NOT NULL,
	`part_number` text,
	`serial_number` text,
	`installed_at` text,
	`warranty_ends_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ops_components_org_asset_parent` ON `ops_asset_components` (`organization_id`,`asset_id`,`parent_component_id`);--> statement-breakpoint
CREATE TABLE `ops_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`store_id` text NOT NULL,
	`category_key` text NOT NULL,
	`taxonomy_node_id` text,
	`group_path_json` text DEFAULT '[]' NOT NULL,
	`asset_tag` text NOT NULL,
	`name` text NOT NULL,
	`manufacturer` text,
	`model` text,
	`serial_number` text,
	`supplier` text,
	`installed_at` text,
	`expected_life_years` integer,
	`warranty_ends_at` text,
	`replacement_estimate_minor` integer,
	`replacement_currency` text,
	`status` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_assets_org_store_tag` ON `ops_assets` (`organization_id`,`store_id`,`asset_tag`);--> statement-breakpoint
CREATE INDEX `idx_ops_assets_org_store_category` ON `ops_assets` (`organization_id`,`store_id`,`category_key`);--> statement-breakpoint
CREATE INDEX `idx_ops_assets_org_status` ON `ops_assets` (`organization_id`,`status`);--> statement-breakpoint
CREATE TABLE `ops_audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`aggregate_type` text NOT NULL,
	`aggregate_id` text NOT NULL,
	`event_type` text NOT NULL,
	`actor_type` text NOT NULL,
	`actor_id` text,
	`actor_name` text NOT NULL,
	`occurred_at` text NOT NULL,
	`payload_json` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ops_audit_org_aggregate_time` ON `ops_audit_events` (`organization_id`,`aggregate_type`,`aggregate_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_ops_audit_org_event_time` ON `ops_audit_events` (`organization_id`,`event_type`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `ops_cost_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`kind` text NOT NULL,
	`description` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`service_date` text NOT NULL,
	`recorded_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ops_cost_lines_org_work_date` ON `ops_cost_lines` (`organization_id`,`work_order_id`,`service_date`);--> statement-breakpoint
CREATE INDEX `idx_ops_cost_lines_org_date_kind` ON `ops_cost_lines` (`organization_id`,`service_date`,`kind`);--> statement-breakpoint
CREATE TABLE `ops_divisions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_divisions_org_code` ON `ops_divisions` (`organization_id`,`code`);--> statement-breakpoint
CREATE INDEX `idx_ops_divisions_org_name` ON `ops_divisions` (`organization_id`,`name`);--> statement-breakpoint
CREATE TABLE `ops_entity_files` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`file_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`purpose` text NOT NULL,
	`visibility` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_entity_files_org_file_entity` ON `ops_entity_files` (`organization_id`,`file_id`,`entity_type`,`entity_id`,`purpose`);--> statement-breakpoint
CREATE INDEX `idx_ops_entity_files_org_entity` ON `ops_entity_files` (`organization_id`,`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `ops_exceptions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`kind` text NOT NULL,
	`store_id` text,
	`work_order_id` text,
	`visit_id` text,
	`vendor_id` text,
	`severity` text NOT NULL,
	`status` text NOT NULL,
	`summary` text NOT NULL,
	`detected_at` text NOT NULL,
	`resolved_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_ops_exceptions_org_status_time` ON `ops_exceptions` (`organization_id`,`status`,`detected_at`);--> statement-breakpoint
CREATE INDEX `idx_ops_exceptions_org_store_status` ON `ops_exceptions` (`organization_id`,`store_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_ops_exceptions_org_vendor_status` ON `ops_exceptions` (`organization_id`,`vendor_id`,`status`);--> statement-breakpoint
CREATE TABLE `ops_files` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`storage_key` text NOT NULL,
	`sha256` text NOT NULL,
	`original_name` text NOT NULL,
	`content_type` text NOT NULL,
	`byte_length` integer NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_files_org_storage_key` ON `ops_files` (`organization_id`,`storage_key`);--> statement-breakpoint
CREATE INDEX `idx_ops_files_org_sha256` ON `ops_files` (`organization_id`,`sha256`);--> statement-breakpoint
CREATE TABLE `ops_follow_ups` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`source_visit_id` text,
	`accountable_party` text NOT NULL,
	`next_action` text NOT NULL,
	`due_at` text NOT NULL,
	`escalation_to` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_ops_followups_org_status_due` ON `ops_follow_ups` (`organization_id`,`status`,`due_at`);--> statement-breakpoint
CREATE INDEX `idx_ops_followups_org_work` ON `ops_follow_ups` (`organization_id`,`work_order_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `ops_idempotency_keys` (
	`organization_id` text NOT NULL,
	`key` text NOT NULL,
	`command` text NOT NULL,
	`result_id` text NOT NULL,
	`request_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	PRIMARY KEY(`organization_id`, `key`)
);
--> statement-breakpoint
CREATE INDEX `idx_ops_idempotency_org_expiry` ON `ops_idempotency_keys` (`organization_id`,`expires_at`);--> statement-breakpoint
CREATE TABLE `ops_invoice_allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`invoice_reference_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`confirmed_by_membership_id` text,
	`confirmed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_invoice_allocations_org_invoice_work` ON `ops_invoice_allocations` (`organization_id`,`invoice_reference_id`,`work_order_id`);--> statement-breakpoint
CREATE INDEX `idx_ops_invoice_allocations_org_work` ON `ops_invoice_allocations` (`organization_id`,`work_order_id`);--> statement-breakpoint
CREATE TABLE `ops_invoice_references` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`vendor_id` text NOT NULL,
	`invoice_number` text NOT NULL,
	`invoice_date` text NOT NULL,
	`gross_amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`operator_work_order_number` text,
	`match_status` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_invoices_org_vendor_number` ON `ops_invoice_references` (`organization_id`,`vendor_id`,`invoice_number`);--> statement-breakpoint
CREATE INDEX `idx_ops_invoices_org_match_date` ON `ops_invoice_references` (`organization_id`,`match_status`,`invoice_date`);--> statement-breakpoint
CREATE INDEX `idx_ops_invoices_org_wo_number` ON `ops_invoice_references` (`organization_id`,`operator_work_order_number`);--> statement-breakpoint
CREATE TABLE `ops_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_memberships_org_user_role` ON `ops_memberships` (`organization_id`,`user_id`,`role`);--> statement-breakpoint
CREATE INDEX `idx_ops_memberships_org_status` ON `ops_memberships` (`organization_id`,`status`);--> statement-breakpoint
CREATE TABLE `ops_organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`time_zone` text DEFAULT 'America/New_York' NOT NULL,
	`work_order_prefix` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_org_slug` ON `ops_organizations` (`slug`);--> statement-breakpoint
CREATE TABLE `ops_outbox_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`topic` text NOT NULL,
	`aggregate_type` text NOT NULL,
	`aggregate_id` text NOT NULL,
	`payload_json` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`available_at` text NOT NULL,
	`created_at` text NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`delivered_at` text,
	`last_error` text
);
--> statement-breakpoint
CREATE INDEX `idx_ops_outbox_org_status_available` ON `ops_outbox_messages` (`organization_id`,`status`,`available_at`);--> statement-breakpoint
CREATE TABLE `ops_pm_occurrences` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`store_id` text NOT NULL,
	`asset_id` text,
	`work_order_id` text,
	`due_at` text NOT NULL,
	`window_starts_at` text NOT NULL,
	`window_ends_at` text NOT NULL,
	`status` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_ops_pm_occurrences_org_status_due` ON `ops_pm_occurrences` (`organization_id`,`status`,`due_at`);--> statement-breakpoint
CREATE INDEX `idx_ops_pm_occurrences_org_store_due` ON `ops_pm_occurrences` (`organization_id`,`store_id`,`due_at`);--> statement-breakpoint
CREATE INDEX `idx_ops_pm_occurrences_org_asset_due` ON `ops_pm_occurrences` (`organization_id`,`asset_id`,`due_at`);--> statement-breakpoint
CREATE TABLE `ops_pm_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`store_id` text,
	`asset_id` text,
	`category_key` text,
	`cadence_days` integer NOT NULL,
	`completion_window_days` integer NOT NULL,
	`active` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ops_pm_plans_org_active_store` ON `ops_pm_plans` (`organization_id`,`active`,`store_id`);--> statement-breakpoint
CREATE INDEX `idx_ops_pm_plans_org_asset` ON `ops_pm_plans` (`organization_id`,`asset_id`);--> statement-breakpoint
CREATE TABLE `ops_public_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`purpose` text NOT NULL,
	`subject_type` text NOT NULL,
	`subject_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`used_at` text,
	`revoked_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_public_tokens_hash` ON `ops_public_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_ops_public_tokens_org_subject` ON `ops_public_tokens` (`organization_id`,`subject_type`,`subject_id`);--> statement-breakpoint
CREATE INDEX `idx_ops_public_tokens_org_purpose_expiry` ON `ops_public_tokens` (`organization_id`,`purpose`,`expires_at`);--> statement-breakpoint
CREATE TABLE `ops_regions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`division_id` text,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_regions_org_code` ON `ops_regions` (`organization_id`,`code`);--> statement-breakpoint
CREATE INDEX `idx_ops_regions_org_name` ON `ops_regions` (`organization_id`,`name`);--> statement-breakpoint
CREATE TABLE `ops_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`reference` text NOT NULL,
	`store_id` text NOT NULL,
	`reporter_name` text NOT NULL,
	`reporter_employee_id` text,
	`problem` text NOT NULL,
	`priority` text NOT NULL,
	`status` text NOT NULL,
	`submitted_at` text NOT NULL,
	`converted_work_order_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_requests_org_reference` ON `ops_requests` (`organization_id`,`reference`);--> statement-breakpoint
CREATE INDEX `idx_ops_requests_org_store_status_time` ON `ops_requests` (`organization_id`,`store_id`,`status`,`submitted_at`);--> statement-breakpoint
CREATE TABLE `ops_scope_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`membership_id` text NOT NULL,
	`scope_kind` text NOT NULL,
	`scope_id` text NOT NULL,
	`permission` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_scopes_org_member_scope_perm` ON `ops_scope_grants` (`organization_id`,`membership_id`,`scope_kind`,`scope_id`,`permission`);--> statement-breakpoint
CREATE INDEX `idx_ops_scopes_org_kind_id` ON `ops_scope_grants` (`organization_id`,`scope_kind`,`scope_id`);--> statement-breakpoint
CREATE TABLE `ops_stores` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`division_id` text,
	`region_id` text,
	`store_number` text NOT NULL,
	`name` text NOT NULL,
	`address_1` text NOT NULL,
	`address_2` text,
	`city` text NOT NULL,
	`state` text NOT NULL,
	`postal_code` text NOT NULL,
	`aliases_json` text DEFAULT '[]' NOT NULL,
	`search_text` text NOT NULL,
	`latitude_e6` integer,
	`longitude_e6` integer,
	`geofence_radius_m` integer DEFAULT 200 NOT NULL,
	`location_policy_enabled` integer DEFAULT false NOT NULL,
	`time_zone` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_stores_org_number` ON `ops_stores` (`organization_id`,`store_number`);--> statement-breakpoint
CREATE INDEX `idx_ops_stores_org_region_number` ON `ops_stores` (`organization_id`,`region_id`,`store_number`);--> statement-breakpoint
CREATE INDEX `idx_ops_stores_org_status_number` ON `ops_stores` (`organization_id`,`status`,`store_number`);--> statement-breakpoint
CREATE TABLE `ops_taxonomy_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`parent_node_id` text,
	`node_kind` text NOT NULL,
	`canonical_key` text,
	`name` text NOT NULL,
	`aliases_json` text DEFAULT '[]' NOT NULL,
	`depth` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_taxonomy_org_parent_name` ON `ops_taxonomy_nodes` (`organization_id`,`parent_node_id`,`name`);--> statement-breakpoint
CREATE INDEX `idx_ops_taxonomy_org_parent_sort` ON `ops_taxonomy_nodes` (`organization_id`,`parent_node_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_ops_taxonomy_org_kind_active` ON `ops_taxonomy_nodes` (`organization_id`,`node_kind`,`active`);--> statement-breakpoint
CREATE TABLE `ops_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_users_email` ON `ops_users` (`email`);--> statement-breakpoint
CREATE TABLE `ops_vendor_coverage` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`vendor_id` text NOT NULL,
	`scope_kind` text NOT NULL,
	`scope_id` text NOT NULL,
	`preferred_rank` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_vendor_coverage_org_vendor_scope` ON `ops_vendor_coverage` (`organization_id`,`vendor_id`,`scope_kind`,`scope_id`);--> statement-breakpoint
CREATE INDEX `idx_ops_vendor_coverage_org_scope` ON `ops_vendor_coverage` (`organization_id`,`scope_kind`,`scope_id`);--> statement-breakpoint
CREATE TABLE `ops_vendor_responses` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`assignment_id` text NOT NULL,
	`issuance_id` text NOT NULL,
	`response` text NOT NULL,
	`responder_name` text NOT NULL,
	`proposed_at` text,
	`message` text,
	`responded_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ops_vendor_responses_org_assignment_time` ON `ops_vendor_responses` (`organization_id`,`assignment_id`,`responded_at`);--> statement-breakpoint
CREATE INDEX `idx_ops_vendor_responses_org_work_time` ON `ops_vendor_responses` (`organization_id`,`work_order_id`,`responded_at`);--> statement-breakpoint
CREATE TABLE `ops_vendor_specialties` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`vendor_id` text NOT NULL,
	`canonical_key` text NOT NULL,
	`display_name` text NOT NULL,
	`search_aliases_json` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_vendor_specialties_org_vendor_key` ON `ops_vendor_specialties` (`organization_id`,`vendor_id`,`canonical_key`);--> statement-breakpoint
CREATE INDEX `idx_ops_vendor_specialties_org_key` ON `ops_vendor_specialties` (`organization_id`,`canonical_key`);--> statement-breakpoint
CREATE TABLE `ops_vendors` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`dispatch_email` text NOT NULL,
	`dispatch_phone` text,
	`status` text DEFAULT 'approved' NOT NULL,
	`preferred` integer DEFAULT false NOT NULL,
	`search_text` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_vendors_org_code` ON `ops_vendors` (`organization_id`,`code`);--> statement-breakpoint
CREATE INDEX `idx_ops_vendors_org_status_name` ON `ops_vendors` (`organization_id`,`status`,`name`);--> statement-breakpoint
CREATE TABLE `ops_visit_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`visit_id` text NOT NULL,
	`kind` text NOT NULL,
	`channel` text NOT NULL,
	`observed_at` text NOT NULL,
	`location_result` text,
	`latitude_e6` integer,
	`longitude_e6` integer,
	`accuracy_m` integer,
	`distance_m` integer,
	`payload_json` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ops_visit_evidence_org_visit_time` ON `ops_visit_evidence` (`organization_id`,`visit_id`,`observed_at`);--> statement-breakpoint
CREATE INDEX `idx_ops_visit_evidence_org_kind_time` ON `ops_visit_evidence` (`organization_id`,`kind`,`observed_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_visit_boundary_evidence` ON `ops_visit_evidence` (`organization_id`,`visit_id`,`kind`) WHERE "ops_visit_evidence"."kind" IN ('check_in', 'check_out');--> statement-breakpoint
CREATE TABLE `ops_visit_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`store_id` text NOT NULL,
	`provider_kind` text NOT NULL,
	`vendor_id` text,
	`internal_membership_id` text,
	`work_order_id` text,
	`unmatched_reason` text,
	`technician_name` text NOT NULL,
	`provider_name` text NOT NULL,
	`purpose` text NOT NULL,
	`status` text NOT NULL,
	`started_channel` text NOT NULL,
	`ended_channel` text,
	`checked_in_at` text NOT NULL,
	`checked_out_at` text,
	`outcome` text,
	`outcome_notes` text,
	`observed_duration_seconds` integer
);
--> statement-breakpoint
CREATE INDEX `idx_ops_visits_org_store_status_time` ON `ops_visit_sessions` (`organization_id`,`store_id`,`status`,`checked_in_at`);--> statement-breakpoint
CREATE INDEX `idx_ops_visits_org_vendor_status_time` ON `ops_visit_sessions` (`organization_id`,`vendor_id`,`status`,`checked_in_at`);--> statement-breakpoint
CREATE INDEX `idx_ops_visits_org_work_time` ON `ops_visit_sessions` (`organization_id`,`work_order_id`,`checked_in_at`);--> statement-breakpoint
CREATE TABLE `ops_work_order_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`kind` text NOT NULL,
	`vendor_id` text,
	`internal_membership_id` text,
	`status` text NOT NULL,
	`assigned_at` text NOT NULL,
	`supersedes_assignment_id` text
);
--> statement-breakpoint
CREATE INDEX `idx_ops_assignments_org_work_status` ON `ops_work_order_assignments` (`organization_id`,`work_order_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_ops_assignments_org_vendor_status` ON `ops_work_order_assignments` (`organization_id`,`vendor_id`,`status`);--> statement-breakpoint
CREATE TABLE `ops_work_order_counters` (
	`organization_id` text NOT NULL,
	`counter_year` integer NOT NULL,
	`next_value` integer NOT NULL,
	PRIMARY KEY(`organization_id`, `counter_year`)
);
--> statement-breakpoint
CREATE TABLE `ops_work_order_issuances` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`assignment_id` text NOT NULL,
	`revision` integer NOT NULL,
	`immutable_payload_json` text NOT NULL,
	`channel` text NOT NULL,
	`issued_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_issuances_org_work_revision` ON `ops_work_order_issuances` (`organization_id`,`work_order_id`,`revision`);--> statement-breakpoint
CREATE INDEX `idx_ops_issuances_org_assignment` ON `ops_work_order_issuances` (`organization_id`,`assignment_id`,`issued_at`);--> statement-breakpoint
CREATE TABLE `ops_work_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`number` text NOT NULL,
	`store_id` text NOT NULL,
	`request_id` text,
	`problem` text NOT NULL,
	`authorized_scope` text,
	`category_key` text,
	`taxonomy_node_id` text,
	`asset_id` text,
	`component_id` text,
	`priority` text NOT NULL,
	`status` text NOT NULL,
	`accountable_party` text NOT NULL,
	`next_action` text NOT NULL,
	`due_at` text,
	`escalation_to` text,
	`nte_amount_minor` integer,
	`nte_currency` text,
	`vendor_service_ticket_number` text,
	`vendor_invoice_number` text,
	`external_accounting_po` text,
	`created_at` text NOT NULL,
	`closed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_work_orders_org_number` ON `ops_work_orders` (`organization_id`,`number`);--> statement-breakpoint
CREATE INDEX `idx_ops_work_orders_org_status_due` ON `ops_work_orders` (`organization_id`,`status`,`due_at`);--> statement-breakpoint
CREATE INDEX `idx_ops_work_orders_org_store_created` ON `ops_work_orders` (`organization_id`,`store_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_ops_work_orders_org_category_created` ON `ops_work_orders` (`organization_id`,`category_key`,`created_at`);