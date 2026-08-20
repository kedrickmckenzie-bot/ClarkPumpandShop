CREATE UNIQUE INDEX `uidx_ops_requests_org_id` ON `ops_requests` (`organization_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_stores_org_id` ON `ops_stores` (`organization_id`,`id`);--> statement-breakpoint
CREATE TABLE `ops_request_impact_assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`request_id` text NOT NULL,
	`store_id` text NOT NULL,
	`assessment_kind` text NOT NULL,
	`review_disposition` text,
	`store_operating_state` text NOT NULL,
	`safety_concern` text NOT NULL,
	`product_inventory_risk` text NOT NULL,
	`product_inventory_value_minor` integer,
	`product_inventory_currency` text,
	`customers_affected` text NOT NULL,
	`compliance_impact` text NOT NULL,
	`capacity_unavailable_bps` integer,
	`redundant_equipment` text NOT NULL,
	`revenue_function_impact` text,
	`estimated_daily_revenue_exposure_minor` integer,
	`estimated_daily_revenue_exposure_currency` text,
	`estimated_downtime_minutes` integer,
	`confidence` text NOT NULL,
	`source` text NOT NULL,
	`notes` text,
	`assessed_by_actor_type` text NOT NULL,
	`assessed_by_actor_id` text,
	`assessed_by_actor_name` text NOT NULL,
	`assessed_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `ops_organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`request_id`) REFERENCES `ops_requests`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`store_id`) REFERENCES `ops_stores`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_ops_request_impact_kind" CHECK("ops_request_impact_assessments"."assessment_kind" IN ('initial_report', 'review')),
	CONSTRAINT "chk_ops_request_impact_disposition" CHECK("ops_request_impact_assessments"."review_disposition" IS NULL OR "ops_request_impact_assessments"."review_disposition" IN ('confirmed', 'revised')),
	CONSTRAINT "chk_ops_request_impact_review_disposition" CHECK(("ops_request_impact_assessments"."assessment_kind" = 'initial_report' AND "ops_request_impact_assessments"."review_disposition" IS NULL) OR ("ops_request_impact_assessments"."assessment_kind" = 'review' AND "ops_request_impact_assessments"."review_disposition" IS NOT NULL)),
	CONSTRAINT "chk_ops_request_impact_operating_state" CHECK("ops_request_impact_assessments"."store_operating_state" IN ('open', 'partially_operational', 'unable_to_operate', 'unknown')),
	CONSTRAINT "chk_ops_request_impact_safety" CHECK("ops_request_impact_assessments"."safety_concern" IN ('none_reported', 'potential', 'immediate', 'unknown')),
	CONSTRAINT "chk_ops_request_impact_inventory" CHECK("ops_request_impact_assessments"."product_inventory_risk" IN ('none_reported', 'at_risk', 'loss_reported', 'unknown')),
	CONSTRAINT "chk_ops_request_impact_inventory_value" CHECK(("ops_request_impact_assessments"."product_inventory_value_minor" IS NULL AND "ops_request_impact_assessments"."product_inventory_currency" IS NULL) OR ("ops_request_impact_assessments"."product_inventory_value_minor" >= 0 AND length(trim("ops_request_impact_assessments"."product_inventory_currency")) > 0)),
	CONSTRAINT "chk_ops_request_impact_customers" CHECK("ops_request_impact_assessments"."customers_affected" IN ('yes', 'no', 'unknown')),
	CONSTRAINT "chk_ops_request_impact_compliance" CHECK("ops_request_impact_assessments"."compliance_impact" IN ('none_reported', 'potential', 'confirmed', 'unknown')),
	CONSTRAINT "chk_ops_request_impact_capacity" CHECK("ops_request_impact_assessments"."capacity_unavailable_bps" IS NULL OR "ops_request_impact_assessments"."capacity_unavailable_bps" BETWEEN 0 AND 10000),
	CONSTRAINT "chk_ops_request_impact_redundancy" CHECK("ops_request_impact_assessments"."redundant_equipment" IN ('yes', 'no', 'unknown')),
	CONSTRAINT "chk_ops_request_impact_revenue" CHECK("ops_request_impact_assessments"."revenue_function_impact" IS NULL OR "ops_request_impact_assessments"."revenue_function_impact" IN ('fuel', 'foodservice', 'refrigerated_merchandise', 'beverages', 'lottery', 'car_wash', 'other')),
	CONSTRAINT "chk_ops_request_impact_revenue_exposure" CHECK(("ops_request_impact_assessments"."estimated_daily_revenue_exposure_minor" IS NULL AND "ops_request_impact_assessments"."estimated_daily_revenue_exposure_currency" IS NULL) OR ("ops_request_impact_assessments"."estimated_daily_revenue_exposure_minor" >= 0 AND length(trim("ops_request_impact_assessments"."estimated_daily_revenue_exposure_currency")) > 0)),
	CONSTRAINT "chk_ops_request_impact_downtime" CHECK("ops_request_impact_assessments"."estimated_downtime_minutes" IS NULL OR "ops_request_impact_assessments"."estimated_downtime_minutes" BETWEEN 0 AND 525600),
	CONSTRAINT "chk_ops_request_impact_confidence" CHECK("ops_request_impact_assessments"."confidence" IN ('low', 'medium', 'high')),
	CONSTRAINT "chk_ops_request_impact_source" CHECK("ops_request_impact_assessments"."source" IN ('store_report', 'manager_review', 'imported', 'not_assessed')),
	CONSTRAINT "chk_ops_request_impact_actor_type" CHECK("ops_request_impact_assessments"."assessed_by_actor_type" IN ('user', 'vendor_link', 'technician', 'store_device', 'system', 'support'))
);
--> statement-breakpoint
CREATE INDEX `idx_ops_request_impact_org_request_time` ON `ops_request_impact_assessments` (`organization_id`,`request_id`,`assessed_at`);--> statement-breakpoint
CREATE INDEX `idx_ops_request_impact_org_store_time` ON `ops_request_impact_assessments` (`organization_id`,`store_id`,`assessed_at`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_ops_workflow_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`work_order_id` text,
	`service_request_id` text,
	`task_type` text NOT NULL,
	`title` text NOT NULL,
	`reason` text NOT NULL,
	`assignee_type` text NOT NULL,
	`assignee_id` text,
	`assignee_role` text,
	`assignee_name` text NOT NULL,
	`priority` text NOT NULL,
	`status` text NOT NULL,
	`blocking` integer DEFAULT false NOT NULL,
	`required_for_progress` integer DEFAULT false NOT NULL,
	`due_at` text,
	`no_sla_reason` text,
	`applicable_sla_clock` text,
	`completion_criteria` text NOT NULL,
	`escalation_destination` text NOT NULL,
	`escalation_level` integer DEFAULT 0 NOT NULL,
	`source_follow_up_id` text,
	`source_approval_request_id` text,
	`created_by_actor_type` text NOT NULL,
	`created_by_actor_id` text,
	`created_by_actor_name` text NOT NULL,
	`created_at` text NOT NULL,
	`started_by_actor_type` text,
	`started_by_actor_id` text,
	`started_by_actor_name` text,
	`started_at` text,
	`completed_by_actor_type` text,
	`completed_by_actor_id` text,
	`completed_by_actor_name` text,
	`completed_at` text,
	`cancelled_by_actor_type` text,
	`cancelled_by_actor_id` text,
	`cancelled_by_actor_name` text,
	`cancelled_at` text,
	`resolution_note` text,
	FOREIGN KEY (`organization_id`,`work_order_id`) REFERENCES `ops_work_orders`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`service_request_id`) REFERENCES `ops_requests`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_ops_workflow_tasks_subject" CHECK(("__new_ops_workflow_tasks"."work_order_id" IS NOT NULL AND "__new_ops_workflow_tasks"."service_request_id" IS NULL) OR ("__new_ops_workflow_tasks"."work_order_id" IS NULL AND "__new_ops_workflow_tasks"."service_request_id" IS NOT NULL)),
	CONSTRAINT "chk_ops_workflow_tasks_type" CHECK("__new_ops_workflow_tasks"."task_type" IN ('review_issue', 'approve_quote', 'vendor_response_required', 'confirm_store_access', 'submit_quote', 'choose_service_provider', 'schedule_service', 'record_service_outcome', 'schedule_return_visit', 'verify_repair', 'review_warranty', 'resolve_invoice_exception', 'respond_service_discrepancy', 'other')),
	CONSTRAINT "chk_ops_workflow_tasks_assignee_type" CHECK("__new_ops_workflow_tasks"."assignee_type" IN ('user', 'team', 'vendor', 'role')),
	CONSTRAINT "chk_ops_workflow_tasks_assignee_shape" CHECK(("__new_ops_workflow_tasks"."assignee_type" = 'role' AND "__new_ops_workflow_tasks"."assignee_id" IS NULL AND "__new_ops_workflow_tasks"."assignee_role" IS NOT NULL) OR ("__new_ops_workflow_tasks"."assignee_type" <> 'role' AND "__new_ops_workflow_tasks"."assignee_id" IS NOT NULL AND "__new_ops_workflow_tasks"."assignee_role" IS NULL)),
	CONSTRAINT "chk_ops_workflow_tasks_priority" CHECK("__new_ops_workflow_tasks"."priority" IN ('critical', 'high', 'normal', 'low')),
	CONSTRAINT "chk_ops_workflow_tasks_status" CHECK("__new_ops_workflow_tasks"."status" IN ('open', 'in_progress', 'completed', 'cancelled')),
	CONSTRAINT "chk_ops_workflow_tasks_sla_target" CHECK(("__new_ops_workflow_tasks"."due_at" IS NOT NULL AND "__new_ops_workflow_tasks"."no_sla_reason" IS NULL) OR ("__new_ops_workflow_tasks"."due_at" IS NULL AND length(trim("__new_ops_workflow_tasks"."no_sla_reason")) > 0)),
	CONSTRAINT "chk_ops_workflow_tasks_escalation" CHECK("__new_ops_workflow_tasks"."escalation_level" >= 0 AND length(trim("__new_ops_workflow_tasks"."escalation_destination")) > 0),
	CONSTRAINT "chk_ops_workflow_tasks_required_text" CHECK(length(trim("__new_ops_workflow_tasks"."title")) > 0 AND length(trim("__new_ops_workflow_tasks"."reason")) > 0 AND length(trim("__new_ops_workflow_tasks"."assignee_name")) > 0 AND length(trim("__new_ops_workflow_tasks"."completion_criteria")) > 0 AND length(trim("__new_ops_workflow_tasks"."created_by_actor_name")) > 0),
	CONSTRAINT "chk_ops_workflow_tasks_terminal_shape" CHECK(("__new_ops_workflow_tasks"."status" = 'completed' AND "__new_ops_workflow_tasks"."completed_at" IS NOT NULL AND "__new_ops_workflow_tasks"."completed_by_actor_type" IS NOT NULL AND "__new_ops_workflow_tasks"."completed_by_actor_name" IS NOT NULL AND "__new_ops_workflow_tasks"."cancelled_at" IS NULL) OR ("__new_ops_workflow_tasks"."status" = 'cancelled' AND "__new_ops_workflow_tasks"."cancelled_at" IS NOT NULL AND "__new_ops_workflow_tasks"."cancelled_by_actor_type" IS NOT NULL AND "__new_ops_workflow_tasks"."cancelled_by_actor_name" IS NOT NULL AND "__new_ops_workflow_tasks"."completed_at" IS NULL) OR ("__new_ops_workflow_tasks"."status" IN ('open', 'in_progress') AND "__new_ops_workflow_tasks"."completed_at" IS NULL AND "__new_ops_workflow_tasks"."cancelled_at" IS NULL))
);
--> statement-breakpoint
INSERT INTO `__new_ops_workflow_tasks`("id", "organization_id", "work_order_id", "service_request_id", "task_type", "title", "reason", "assignee_type", "assignee_id", "assignee_role", "assignee_name", "priority", "status", "blocking", "required_for_progress", "due_at", "no_sla_reason", "applicable_sla_clock", "completion_criteria", "escalation_destination", "escalation_level", "source_follow_up_id", "source_approval_request_id", "created_by_actor_type", "created_by_actor_id", "created_by_actor_name", "created_at", "started_by_actor_type", "started_by_actor_id", "started_by_actor_name", "started_at", "completed_by_actor_type", "completed_by_actor_id", "completed_by_actor_name", "completed_at", "cancelled_by_actor_type", "cancelled_by_actor_id", "cancelled_by_actor_name", "cancelled_at", "resolution_note") SELECT "id", "organization_id", "work_order_id", NULL, "task_type", "title", "reason", "assignee_type", "assignee_id", "assignee_role", "assignee_name", "priority", "status", "blocking", "required_for_progress", "due_at", "no_sla_reason", "applicable_sla_clock", "completion_criteria", "escalation_destination", "escalation_level", "source_follow_up_id", "source_approval_request_id", "created_by_actor_type", "created_by_actor_id", "created_by_actor_name", "created_at", "started_by_actor_type", "started_by_actor_id", "started_by_actor_name", "started_at", "completed_by_actor_type", "completed_by_actor_id", "completed_by_actor_name", "completed_at", "cancelled_by_actor_type", "cancelled_by_actor_id", "cancelled_by_actor_name", "cancelled_at", "resolution_note" FROM `ops_workflow_tasks`;--> statement-breakpoint
DROP TABLE `ops_workflow_tasks`;--> statement-breakpoint
ALTER TABLE `__new_ops_workflow_tasks` RENAME TO `ops_workflow_tasks`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_workflow_tasks_org_id` ON `ops_workflow_tasks` (`organization_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_workflow_tasks_org_followup` ON `ops_workflow_tasks` (`organization_id`,`source_follow_up_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_workflow_tasks_org_approval` ON `ops_workflow_tasks` (`organization_id`,`source_approval_request_id`);--> statement-breakpoint
CREATE INDEX `idx_ops_workflow_tasks_org_work_status_due` ON `ops_workflow_tasks` (`organization_id`,`work_order_id`,`status`,`due_at`);--> statement-breakpoint
CREATE INDEX `idx_ops_workflow_tasks_org_request_status_due` ON `ops_workflow_tasks` (`organization_id`,`service_request_id`,`status`,`due_at`);--> statement-breakpoint
CREATE INDEX `idx_ops_workflow_tasks_org_assignee_status_due` ON `ops_workflow_tasks` (`organization_id`,`assignee_type`,`assignee_id`,`status`,`due_at`);
