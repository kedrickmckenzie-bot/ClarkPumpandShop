CREATE TABLE `asset_classes` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`service_category_id` text NOT NULL,
	`name` text NOT NULL,
	`expected_life_years` integer
);
--> statement-breakpoint
CREATE INDEX `idx_asset_classes_org_category` ON `asset_classes` (`organization_id`,`service_category_id`);--> statement-breakpoint
CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`store_system_id` text NOT NULL,
	`asset_class_id` text NOT NULL,
	`name` text NOT NULL,
	`manufacturer` text,
	`model` text,
	`serial` text,
	`installed_at` text,
	`expected_life_years` integer,
	`replacement_cost_cents` integer,
	`warranty_ends_at` text,
	`criticality` text DEFAULT 'standard' NOT NULL,
	`state` text DEFAULT 'operational' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_assets_org_system` ON `assets` (`organization_id`,`store_system_id`);--> statement-breakpoint
CREATE INDEX `idx_assets_org_class` ON `assets` (`organization_id`,`asset_class_id`);--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`event_type` text NOT NULL,
	`actor_type` text NOT NULL,
	`actor_id` text,
	`actor_name` text NOT NULL,
	`occurred_at` text NOT NULL,
	`visibility` text NOT NULL,
	`details_json` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_org_entity_occurred` ON `audit_events` (`organization_id`,`entity_type`,`entity_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_org_event_occurred` ON `audit_events` (`organization_id`,`event_type`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `authorizations` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`quote_id` text,
	`type` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`status` text NOT NULL,
	`approved_at` text NOT NULL,
	`approver_id` text
);
--> statement-breakpoint
CREATE INDEX `idx_authorizations_org_wo_status` ON `authorizations` (`organization_id`,`work_order_id`,`status`);--> statement-breakpoint
CREATE TABLE `communications` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`work_order_id` text,
	`channel` text NOT NULL,
	`direction` text NOT NULL,
	`visibility` text NOT NULL,
	`subject` text,
	`body` text NOT NULL,
	`delivery_state` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_communications_org_wo_created` ON `communications` (`organization_id`,`work_order_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `component_types` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`service_category_id` text NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_component_types_org_category` ON `component_types` (`organization_id`,`service_category_id`);--> statement-breakpoint
CREATE TABLE `components` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`component_type_id` text NOT NULL,
	`name` text NOT NULL,
	`part_number` text,
	`installed_at` text,
	`warranty_ends_at` text,
	`vendor_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_components_org_asset` ON `components` (`organization_id`,`asset_id`);--> statement-breakpoint
CREATE TABLE `cost_allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`financial_type` text NOT NULL,
	`financial_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`store_id` text NOT NULL,
	`service_category_id` text NOT NULL,
	`store_system_id` text,
	`asset_id` text,
	`component_id` text,
	`amount_cents` integer NOT NULL,
	`work_class` text NOT NULL,
	`cost_category` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_alloc_org_financial` ON `cost_allocations` (`organization_id`,`financial_type`,`financial_id`);--> statement-breakpoint
CREATE INDEX `idx_alloc_org_store_category` ON `cost_allocations` (`organization_id`,`store_id`,`service_category_id`);--> statement-breakpoint
CREATE INDEX `idx_alloc_org_system` ON `cost_allocations` (`organization_id`,`store_system_id`);--> statement-breakpoint
CREATE INDEX `idx_alloc_org_asset` ON `cost_allocations` (`organization_id`,`asset_id`);--> statement-breakpoint
CREATE INDEX `idx_alloc_org_component` ON `cost_allocations` (`organization_id`,`component_id`);--> statement-breakpoint
CREATE TABLE `credits` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`invoice_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`status` text NOT NULL,
	`issued_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_credits_org_invoice_status` ON `credits` (`organization_id`,`invoice_id`,`status`);--> statement-breakpoint
CREATE TABLE `document_links` (
	`organization_id` text NOT NULL,
	`document_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	PRIMARY KEY(`organization_id`, `document_id`, `entity_type`, `entity_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_document_links_org_entity` ON `document_links` (`organization_id`,`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`object_key` text NOT NULL,
	`name` text NOT NULL,
	`classification` text NOT NULL,
	`mime_type` text NOT NULL,
	`bytes` integer NOT NULL,
	`uploaded_by_id` text,
	`uploaded_by_name` text NOT NULL,
	`uploaded_at` text NOT NULL,
	`visibility` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_documents_org_object_key` ON `documents` (`organization_id`,`object_key`);--> statement-breakpoint
CREATE INDEX `idx_documents_org_class_uploaded` ON `documents` (`organization_id`,`classification`,`uploaded_at`);--> statement-breakpoint
CREATE TABLE `employee_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`reference` text NOT NULL,
	`store_id` text NOT NULL,
	`store_area_id` text,
	`reporter_id` text,
	`reporter_name` text NOT NULL,
	`original_description` text NOT NULL,
	`urgency` text NOT NULL,
	`status` text NOT NULL,
	`submitted_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_reports_org_reference` ON `employee_reports` (`organization_id`,`reference`);--> statement-breakpoint
CREATE INDEX `idx_reports_org_store_status` ON `employee_reports` (`organization_id`,`store_id`,`status`,`submitted_at`);--> statement-breakpoint
CREATE TABLE `follow_ups` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`source_visit_id` text,
	`accountable_party` text NOT NULL,
	`next_action` text NOT NULL,
	`due_at` text NOT NULL,
	`escalation` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_followups_org_status_due` ON `follow_ups` (`organization_id`,`status`,`due_at`);--> statement-breakpoint
CREATE INDEX `idx_followups_org_wo` ON `follow_ups` (`organization_id`,`work_order_id`);--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`vendor_id` text NOT NULL,
	`number` text NOT NULL,
	`total_cents` integer NOT NULL,
	`status` text NOT NULL,
	`issued_at` text NOT NULL,
	`paid_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_invoices_org_vendor_number` ON `invoices` (`organization_id`,`vendor_id`,`number`);--> statement-breakpoint
CREATE INDEX `idx_invoices_org_status_issued` ON `invoices` (`organization_id`,`status`,`issued_at`);--> statement-breakpoint
CREATE TABLE `memberships` (
	`organization_id` text NOT NULL,
	`person_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`organization_id`, `person_id`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`work_order_prefix` text NOT NULL,
	`time_zone` text DEFAULT 'America/New_York' NOT NULL,
	`review_policy` text DEFAULT 'required_store_manager' NOT NULL,
	`settings_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `outbox_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`work_order_id` text,
	`recipient` text NOT NULL,
	`subject` text NOT NULL,
	`text_body` text NOT NULL,
	`html_body` text NOT NULL,
	`delivery_state` text NOT NULL,
	`provider_message_id` text,
	`created_at` text NOT NULL,
	`delivered_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_outbox_org_state_created` ON `outbox_messages` (`organization_id`,`delivery_state`,`created_at`);--> statement-breakpoint
CREATE TABLE `people` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`kind` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_people_org_email` ON `people` (`organization_id`,`email`);--> statement-breakpoint
CREATE TABLE `pm_occurrences` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`pm_plan_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`store_id` text NOT NULL,
	`work_order_id` text,
	`due_at` text NOT NULL,
	`window_start` text NOT NULL,
	`window_end` text NOT NULL,
	`status` text NOT NULL,
	`completed_at` text,
	`verified` integer DEFAULT false NOT NULL,
	`waiver_reason` text,
	`waiver_approver_id` text,
	`waiver_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_pm_occurrence_target_due` ON `pm_occurrences` (`organization_id`,`pm_plan_id`,`target_type`,`target_id`,`due_at`);--> statement-breakpoint
CREATE INDEX `idx_pm_occurrences_org_status_due` ON `pm_occurrences` (`organization_id`,`status`,`due_at`);--> statement-breakpoint
CREATE INDEX `idx_pm_occurrences_org_store_due` ON `pm_occurrences` (`organization_id`,`store_id`,`due_at`);--> statement-breakpoint
CREATE TABLE `pm_plan_targets` (
	`organization_id` text NOT NULL,
	`pm_plan_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	PRIMARY KEY(`organization_id`, `pm_plan_id`, `target_type`, `target_id`)
);
--> statement-breakpoint
CREATE TABLE `pm_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`service_category_id` text NOT NULL,
	`scope_type` text NOT NULL,
	`frequency` text NOT NULL,
	`start_at` text NOT NULL,
	`early_window_days` integer NOT NULL,
	`late_window_days` integer NOT NULL,
	`vendor_id` text,
	`required_document` text,
	`authorization_policy` text,
	`escalation_rule` text,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_pm_plans_org_category_active` ON `pm_plans` (`organization_id`,`service_category_id`,`active`);--> statement-breakpoint
CREATE TABLE `public_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`purpose` text NOT NULL,
	`token_hash` text NOT NULL,
	`record_type` text NOT NULL,
	`record_id` text NOT NULL,
	`expires_at` text,
	`used_at` text,
	`revoked_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_public_tokens_hash` ON `public_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_public_tokens_org_record` ON `public_tokens` (`organization_id`,`record_type`,`record_id`);--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`vendor_id` text NOT NULL,
	`number` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`status` text NOT NULL,
	`submitted_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_quotes_org_wo_status` ON `quotes` (`organization_id`,`work_order_id`,`status`);--> statement-breakpoint
CREATE TABLE `regions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_regions_org` ON `regions` (`organization_id`);--> statement-breakpoint
CREATE TABLE `report_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`report_id` text NOT NULL,
	`reviewer_id` text,
	`reviewer_name` text NOT NULL,
	`decision` text NOT NULL,
	`context` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_report_reviews_org_report` ON `report_reviews` (`organization_id`,`report_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `role_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`person_id` text NOT NULL,
	`role` text NOT NULL,
	`region_id` text,
	`store_id` text,
	`vendor_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_roles_org_person` ON `role_assignments` (`organization_id`,`person_id`);--> statement-breakpoint
CREATE INDEX `idx_roles_scope` ON `role_assignments` (`organization_id`,`role`,`region_id`,`store_id`);--> statement-breakpoint
CREATE TABLE `service_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_categories_org_name` ON `service_categories` (`organization_id`,`name`);--> statement-breakpoint
CREATE TABLE `service_visits` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`vendor_id` text NOT NULL,
	`technician_entered_name` text NOT NULL,
	`session_hash` text NOT NULL,
	`checked_in_at` text NOT NULL,
	`checked_out_at` text,
	`check_in_state` text NOT NULL,
	`check_in_latitude_e6` integer,
	`check_in_longitude_e6` integer,
	`check_in_accuracy_m` integer,
	`check_in_distance_m` integer,
	`check_out_state` text,
	`check_out_latitude_e6` integer,
	`check_out_longitude_e6` integer,
	`check_out_accuracy_m` integer,
	`check_out_distance_m` integer,
	`outcome` text,
	`simulated` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_visits_org_wo` ON `service_visits` (`organization_id`,`work_order_id`,`checked_in_at`);--> statement-breakpoint
CREATE INDEX `idx_visits_org_session` ON `service_visits` (`organization_id`,`session_hash`,`checked_out_at`);--> statement-breakpoint
CREATE TABLE `store_areas` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`store_id` text NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_store_areas_org_store` ON `store_areas` (`organization_id`,`store_id`);--> statement-breakpoint
CREATE TABLE `store_systems` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`store_id` text NOT NULL,
	`service_category_id` text NOT NULL,
	`system_type_id` text,
	`name` text NOT NULL,
	`state` text DEFAULT 'normal' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_store_systems_org_store_category` ON `store_systems` (`organization_id`,`store_id`,`service_category_id`);--> statement-breakpoint
CREATE TABLE `stores` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`region_id` text,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`city` text,
	`state` text,
	`latitude_e6` integer,
	`longitude_e6` integer,
	`geofence_radius_m` integer DEFAULT 200 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_stores_org_code` ON `stores` (`organization_id`,`code`);--> statement-breakpoint
CREATE INDEX `idx_stores_org_region` ON `stores` (`organization_id`,`region_id`);--> statement-breakpoint
CREATE TABLE `system_types` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`service_category_id` text NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_system_types_org_category` ON `system_types` (`organization_id`,`service_category_id`);--> statement-breakpoint
CREATE TABLE `vendor_contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`vendor_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`role` text
);
--> statement-breakpoint
CREATE INDEX `idx_vendor_contacts_org_vendor` ON `vendor_contacts` (`organization_id`,`vendor_id`);--> statement-breakpoint
CREATE TABLE `vendor_responses` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`vendor_id` text NOT NULL,
	`response` text NOT NULL,
	`responder` text NOT NULL,
	`token_id` text,
	`issued_at` text NOT NULL,
	`responded_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_vendor_responses_org_wo` ON `vendor_responses` (`organization_id`,`work_order_id`,`responded_at`);--> statement-breakpoint
CREATE TABLE `vendors` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`trade` text NOT NULL,
	`dispatch_email` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_vendors_org_active` ON `vendors` (`organization_id`,`active`);--> statement-breakpoint
CREATE TABLE `work_order_classification_events` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`prior_system_id` text,
	`prior_asset_id` text,
	`prior_component_id` text,
	`new_system_id` text,
	`new_asset_id` text,
	`new_component_id` text,
	`actor_id` text,
	`reason` text NOT NULL,
	`occurred_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_classification_events_org_wo` ON `work_order_classification_events` (`organization_id`,`work_order_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `work_order_reports` (
	`organization_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`report_id` text NOT NULL,
	PRIMARY KEY(`organization_id`, `work_order_id`, `report_id`)
);
--> statement-breakpoint
CREATE TABLE `work_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`number` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`origin` text NOT NULL,
	`store_id` text NOT NULL,
	`service_category_id` text NOT NULL,
	`store_system_id` text,
	`asset_id` text,
	`component_id` text,
	`priority` text NOT NULL,
	`work_type` text NOT NULL,
	`status` text NOT NULL,
	`accountable_party` text NOT NULL,
	`next_action` text NOT NULL,
	`due_at` text,
	`escalation` text NOT NULL,
	`vendor_id` text,
	`vendor_acceptance` text NOT NULL,
	`requested_service_at` text,
	`nte_cents` integer DEFAULT 0 NOT NULL,
	`cost_exposure_cents` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`closed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_work_orders_org_number` ON `work_orders` (`organization_id`,`number`);--> statement-breakpoint
CREATE INDEX `idx_wo_org_status_due` ON `work_orders` (`organization_id`,`status`,`due_at`);--> statement-breakpoint
CREATE INDEX `idx_wo_org_store_category_created` ON `work_orders` (`organization_id`,`store_id`,`service_category_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_wo_org_vendor_acceptance` ON `work_orders` (`organization_id`,`vendor_id`,`vendor_acceptance`);--> statement-breakpoint
CREATE TRIGGER `trg_employee_reports_preserve_original`
BEFORE UPDATE ON `employee_reports`
WHEN OLD.`organization_id` IS NOT NEW.`organization_id`
  OR OLD.`reference` IS NOT NEW.`reference`
  OR OLD.`store_id` IS NOT NEW.`store_id`
  OR OLD.`store_area_id` IS NOT NEW.`store_area_id`
  OR OLD.`reporter_id` IS NOT NEW.`reporter_id`
  OR OLD.`reporter_name` IS NOT NEW.`reporter_name`
  OR OLD.`original_description` IS NOT NEW.`original_description`
  OR OLD.`urgency` IS NOT NEW.`urgency`
  OR OLD.`submitted_at` IS NOT NEW.`submitted_at`
BEGIN
  SELECT RAISE(ABORT, 'original employee report fields are immutable');
END;--> statement-breakpoint
CREATE TRIGGER `trg_employee_reports_no_delete`
BEFORE DELETE ON `employee_reports`
BEGIN
  SELECT RAISE(ABORT, 'employee reports cannot be deleted');
END;--> statement-breakpoint
CREATE TRIGGER `trg_audit_events_no_update`
BEFORE UPDATE ON `audit_events`
BEGIN
  SELECT RAISE(ABORT, 'audit events are append-only');
END;--> statement-breakpoint
CREATE TRIGGER `trg_audit_events_no_delete`
BEFORE DELETE ON `audit_events`
BEGIN
  SELECT RAISE(ABORT, 'audit events are append-only');
END;--> statement-breakpoint
CREATE TRIGGER `trg_allocations_invoice_limit_insert`
BEFORE INSERT ON `cost_allocations`
WHEN NEW.`financial_type` = 'invoice'
  AND (
    SELECT COALESCE(SUM(`amount_cents`), 0) + NEW.`amount_cents`
    FROM `cost_allocations`
    WHERE `organization_id` = NEW.`organization_id`
      AND `financial_type` = 'invoice'
      AND `financial_id` = NEW.`financial_id`
  ) > (
    SELECT `total_cents`
    FROM `invoices`
    WHERE `organization_id` = NEW.`organization_id`
      AND `id` = NEW.`financial_id`
  )
BEGIN
  SELECT RAISE(ABORT, 'invoice allocations cannot exceed invoice total');
END;--> statement-breakpoint
PRAGMA optimize;
