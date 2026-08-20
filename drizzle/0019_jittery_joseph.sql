CREATE UNIQUE INDEX `uidx_ops_memberships_org_id` ON `ops_memberships` (`organization_id`,`id`);--> statement-breakpoint
CREATE TABLE `ops_work_order_verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`site_visit_work_order_id` text NOT NULL,
	`outcome` text NOT NULL,
	`outcome_recorded_at` text NOT NULL,
	`cycle` integer NOT NULL,
	`decision` text NOT NULL,
	`reason` text,
	`decided_by_membership_id` text NOT NULL,
	`decided_by_name` text NOT NULL,
	`decided_at` text NOT NULL,
	FOREIGN KEY (`organization_id`,`work_order_id`) REFERENCES `ops_work_orders`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`site_visit_work_order_id`,`work_order_id`) REFERENCES `ops_site_visit_work_orders`(`organization_id`,`id`,`work_order_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`decided_by_membership_id`) REFERENCES `ops_memberships`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_ops_work_verifications_outcome" CHECK("ops_work_order_verifications"."outcome" IN ('completed', 'diagnosis_only', 'quote_required', 'parts_required', 'return_visit_required', 'no_issue_found', 'store_access_unavailable', 'work_not_authorized', 'not_addressed')),
	CONSTRAINT "chk_ops_work_verifications_cycle" CHECK("ops_work_order_verifications"."cycle" > 0),
	CONSTRAINT "chk_ops_work_verifications_decision" CHECK("ops_work_order_verifications"."decision" IN ('verified', 'rejected')),
	CONSTRAINT "chk_ops_work_verifications_reason" CHECK("ops_work_order_verifications"."decision" <> 'rejected' OR ("ops_work_order_verifications"."reason" IS NOT NULL AND length(trim("ops_work_order_verifications"."reason")) > 0)),
	CONSTRAINT "chk_ops_work_verifications_actor" CHECK(length(trim("ops_work_order_verifications"."decided_by_name")) > 0),
	CONSTRAINT "chk_ops_work_verifications_time" CHECK("ops_work_order_verifications"."decided_at" >= "ops_work_order_verifications"."outcome_recorded_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_work_verifications_org_id` ON `ops_work_order_verifications` (`organization_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_work_verifications_org_cycle` ON `ops_work_order_verifications` (`organization_id`,`work_order_id`,`cycle`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_work_verifications_org_outcome` ON `ops_work_order_verifications` (`organization_id`,`site_visit_work_order_id`);--> statement-breakpoint
CREATE INDEX `idx_ops_work_verifications_org_work_time` ON `ops_work_order_verifications` (`organization_id`,`work_order_id`,`decided_at`);--> statement-breakpoint
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
	CONSTRAINT "chk_ops_workflow_tasks_type" CHECK("__new_ops_workflow_tasks"."task_type" IN ('review_issue', 'approve_quote', 'vendor_response_required', 'confirm_store_access', 'submit_quote', 'choose_service_provider', 'schedule_service', 'record_service_outcome', 'schedule_return_visit', 'verify_repair', 'close_verified_work', 'review_warranty', 'resolve_invoice_exception', 'respond_service_discrepancy', 'other')),
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
INSERT INTO `__new_ops_workflow_tasks`("id", "organization_id", "work_order_id", "service_request_id", "task_type", "title", "reason", "assignee_type", "assignee_id", "assignee_role", "assignee_name", "priority", "status", "blocking", "required_for_progress", "due_at", "no_sla_reason", "applicable_sla_clock", "completion_criteria", "escalation_destination", "escalation_level", "source_follow_up_id", "source_approval_request_id", "created_by_actor_type", "created_by_actor_id", "created_by_actor_name", "created_at", "started_by_actor_type", "started_by_actor_id", "started_by_actor_name", "started_at", "completed_by_actor_type", "completed_by_actor_id", "completed_by_actor_name", "completed_at", "cancelled_by_actor_type", "cancelled_by_actor_id", "cancelled_by_actor_name", "cancelled_at", "resolution_note") SELECT "id", "organization_id", "work_order_id", "service_request_id", "task_type", "title", "reason", "assignee_type", "assignee_id", "assignee_role", "assignee_name", "priority", "status", "blocking", "required_for_progress", "due_at", "no_sla_reason", "applicable_sla_clock", "completion_criteria", "escalation_destination", "escalation_level", "source_follow_up_id", "source_approval_request_id", "created_by_actor_type", "created_by_actor_id", "created_by_actor_name", "created_at", "started_by_actor_type", "started_by_actor_id", "started_by_actor_name", "started_at", "completed_by_actor_type", "completed_by_actor_id", "completed_by_actor_name", "completed_at", "cancelled_by_actor_type", "cancelled_by_actor_id", "cancelled_by_actor_name", "cancelled_at", "resolution_note" FROM `ops_workflow_tasks`;--> statement-breakpoint
DROP TABLE `ops_workflow_tasks`;--> statement-breakpoint
ALTER TABLE `__new_ops_workflow_tasks` RENAME TO `ops_workflow_tasks`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_workflow_tasks_org_id` ON `ops_workflow_tasks` (`organization_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_workflow_tasks_org_followup` ON `ops_workflow_tasks` (`organization_id`,`source_follow_up_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_workflow_tasks_org_approval` ON `ops_workflow_tasks` (`organization_id`,`source_approval_request_id`);--> statement-breakpoint
CREATE INDEX `idx_ops_workflow_tasks_org_work_status_due` ON `ops_workflow_tasks` (`organization_id`,`work_order_id`,`status`,`due_at`);--> statement-breakpoint
CREATE INDEX `idx_ops_workflow_tasks_org_request_status_due` ON `ops_workflow_tasks` (`organization_id`,`service_request_id`,`status`,`due_at`);--> statement-breakpoint
CREATE INDEX `idx_ops_workflow_tasks_org_assignee_status_due` ON `ops_workflow_tasks` (`organization_id`,`assignee_type`,`assignee_id`,`status`,`due_at`);--> statement-breakpoint
CREATE TABLE `__new_ops_work_orders` (
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
	`version` integer DEFAULT 0 NOT NULL,
	`accountable_party` text NOT NULL,
	`next_action` text NOT NULL,
	`due_at` text,
	`escalation_to` text,
	`nte_amount_minor` integer,
	`nte_currency` text,
	`repair_estimate_amount_minor` integer,
	`repair_estimate_currency` text,
	`estimated_service_extension_months` integer,
	`vendor_service_ticket_number` text,
	`vendor_invoice_number` text,
	`external_accounting_po` text,
	`created_at` text NOT NULL,
	`resolved_at` text,
	`closed_at` text,
	CONSTRAINT "chk_ops_work_orders_status" CHECK("__new_ops_work_orders"."status" IN ('draft', 'awaiting_approval', 'approved', 'issued', 'accepted', 'scheduled', 'in_progress', 'waiting_on_vendor', 'waiting_on_parts', 'completed_pending_review', 'resolved', 'closed', 'cancelled')),
	CONSTRAINT "chk_ops_work_orders_resolution_time" CHECK("__new_ops_work_orders"."resolved_at" IS NULL OR "__new_ops_work_orders"."resolved_at" >= "__new_ops_work_orders"."created_at")
);
--> statement-breakpoint
INSERT INTO `__new_ops_work_orders`("id", "organization_id", "number", "store_id", "request_id", "problem", "authorized_scope", "category_key", "taxonomy_node_id", "asset_id", "component_id", "priority", "status", "version", "accountable_party", "next_action", "due_at", "escalation_to", "nte_amount_minor", "nte_currency", "repair_estimate_amount_minor", "repair_estimate_currency", "estimated_service_extension_months", "vendor_service_ticket_number", "vendor_invoice_number", "external_accounting_po", "created_at", "resolved_at", "closed_at") SELECT "id", "organization_id", "number", "store_id", "request_id", "problem", "authorized_scope", "category_key", "taxonomy_node_id", "asset_id", "component_id", "priority", "status", "version", "accountable_party", "next_action", "due_at", "escalation_to", "nte_amount_minor", "nte_currency", "repair_estimate_amount_minor", "repair_estimate_currency", "estimated_service_extension_months", "vendor_service_ticket_number", "vendor_invoice_number", "external_accounting_po", "created_at", NULL, "closed_at" FROM `ops_work_orders`;--> statement-breakpoint
DROP TABLE `ops_work_orders`;--> statement-breakpoint
ALTER TABLE `__new_ops_work_orders` RENAME TO `ops_work_orders`;--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_work_orders_org_number` ON `ops_work_orders` (`organization_id`,`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_work_orders_org_id` ON `ops_work_orders` (`organization_id`,`id`);--> statement-breakpoint
CREATE INDEX `idx_ops_work_orders_org_status_due` ON `ops_work_orders` (`organization_id`,`status`,`due_at`);--> statement-breakpoint
CREATE INDEX `idx_ops_work_orders_org_store_created` ON `ops_work_orders` (`organization_id`,`store_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_ops_work_orders_org_category_created` ON `ops_work_orders` (`organization_id`,`category_key`,`created_at`);
