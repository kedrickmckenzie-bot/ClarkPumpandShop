CREATE TABLE `ops_workflow_task_sla_pauses` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`workflow_task_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`reason_code` text NOT NULL,
	`reason_detail` text NOT NULL,
	`owner_type` text NOT NULL,
	`owner_id` text,
	`owner_name` text NOT NULL,
	`affected_clocks_json` text NOT NULL,
	`expected_resume_at` text,
	`paused_by_actor_type` text NOT NULL,
	`paused_by_actor_id` text,
	`paused_by_actor_name` text NOT NULL,
	`paused_at` text NOT NULL,
	FOREIGN KEY (`organization_id`,`workflow_task_id`) REFERENCES `ops_workflow_tasks`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`work_order_id`) REFERENCES `ops_work_orders`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_ops_workflow_task_pauses_reason" CHECK("ops_workflow_task_sla_pauses"."reason_code" IN ('awaiting_vendor', 'awaiting_parts', 'awaiting_approval', 'awaiting_store_access', 'awaiting_customer', 'weather_or_site_condition', 'scheduled_future_event', 'external_dependency', 'other')),
	CONSTRAINT "chk_ops_workflow_task_pauses_owner" CHECK("ops_workflow_task_sla_pauses"."owner_type" IN ('membership', 'team', 'vendor', 'store', 'external_party', 'system')),
	CONSTRAINT "chk_ops_workflow_task_pauses_text" CHECK(length(trim("ops_workflow_task_sla_pauses"."reason_detail")) > 0 AND length(trim("ops_workflow_task_sla_pauses"."owner_name")) > 0 AND length(trim("ops_workflow_task_sla_pauses"."paused_by_actor_name")) > 0 AND length(trim("ops_workflow_task_sla_pauses"."affected_clocks_json")) > 2),
	CONSTRAINT "chk_ops_workflow_task_pauses_expected" CHECK("ops_workflow_task_sla_pauses"."expected_resume_at" IS NULL OR "ops_workflow_task_sla_pauses"."expected_resume_at" > "ops_workflow_task_sla_pauses"."paused_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_workflow_task_pauses_org_id` ON `ops_workflow_task_sla_pauses` (`organization_id`,`id`);--> statement-breakpoint
CREATE INDEX `idx_ops_workflow_task_pauses_org_task_time` ON `ops_workflow_task_sla_pauses` (`organization_id`,`workflow_task_id`,`paused_at`);--> statement-breakpoint
CREATE TABLE `ops_workflow_task_sla_resumes` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`workflow_task_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`pause_id` text NOT NULL,
	`resumed_by_actor_type` text NOT NULL,
	`resumed_by_actor_id` text,
	`resumed_by_actor_name` text NOT NULL,
	`resumed_at` text NOT NULL,
	`note` text,
	FOREIGN KEY (`organization_id`,`workflow_task_id`) REFERENCES `ops_workflow_tasks`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`pause_id`) REFERENCES `ops_workflow_task_sla_pauses`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`work_order_id`) REFERENCES `ops_work_orders`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_ops_workflow_task_resumes_actor" CHECK(length(trim("ops_workflow_task_sla_resumes"."resumed_by_actor_name")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_workflow_task_resumes_org_id` ON `ops_workflow_task_sla_resumes` (`organization_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_workflow_task_resumes_org_pause` ON `ops_workflow_task_sla_resumes` (`organization_id`,`pause_id`);--> statement-breakpoint
CREATE INDEX `idx_ops_workflow_task_resumes_org_task_time` ON `ops_workflow_task_sla_resumes` (`organization_id`,`workflow_task_id`,`resumed_at`);--> statement-breakpoint
CREATE TABLE `ops_workflow_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`work_order_id` text NOT NULL,
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
	CONSTRAINT "chk_ops_workflow_tasks_type" CHECK("ops_workflow_tasks"."task_type" IN ('review_issue', 'approve_quote', 'vendor_response_required', 'confirm_store_access', 'submit_quote', 'choose_service_provider', 'schedule_service', 'record_service_outcome', 'schedule_return_visit', 'verify_repair', 'review_warranty', 'resolve_invoice_exception', 'respond_service_discrepancy', 'other')),
	CONSTRAINT "chk_ops_workflow_tasks_assignee_type" CHECK("ops_workflow_tasks"."assignee_type" IN ('user', 'team', 'vendor', 'role')),
	CONSTRAINT "chk_ops_workflow_tasks_assignee_shape" CHECK(("ops_workflow_tasks"."assignee_type" = 'role' AND "ops_workflow_tasks"."assignee_id" IS NULL AND "ops_workflow_tasks"."assignee_role" IS NOT NULL) OR ("ops_workflow_tasks"."assignee_type" <> 'role' AND "ops_workflow_tasks"."assignee_id" IS NOT NULL AND "ops_workflow_tasks"."assignee_role" IS NULL)),
	CONSTRAINT "chk_ops_workflow_tasks_priority" CHECK("ops_workflow_tasks"."priority" IN ('critical', 'high', 'normal', 'low')),
	CONSTRAINT "chk_ops_workflow_tasks_status" CHECK("ops_workflow_tasks"."status" IN ('open', 'in_progress', 'completed', 'cancelled')),
	CONSTRAINT "chk_ops_workflow_tasks_sla_target" CHECK(("ops_workflow_tasks"."due_at" IS NOT NULL AND "ops_workflow_tasks"."no_sla_reason" IS NULL) OR ("ops_workflow_tasks"."due_at" IS NULL AND length(trim("ops_workflow_tasks"."no_sla_reason")) > 0)),
	CONSTRAINT "chk_ops_workflow_tasks_escalation" CHECK("ops_workflow_tasks"."escalation_level" >= 0 AND length(trim("ops_workflow_tasks"."escalation_destination")) > 0),
	CONSTRAINT "chk_ops_workflow_tasks_required_text" CHECK(length(trim("ops_workflow_tasks"."title")) > 0 AND length(trim("ops_workflow_tasks"."reason")) > 0 AND length(trim("ops_workflow_tasks"."assignee_name")) > 0 AND length(trim("ops_workflow_tasks"."completion_criteria")) > 0 AND length(trim("ops_workflow_tasks"."created_by_actor_name")) > 0),
	CONSTRAINT "chk_ops_workflow_tasks_terminal_shape" CHECK(("ops_workflow_tasks"."status" = 'completed' AND "ops_workflow_tasks"."completed_at" IS NOT NULL AND "ops_workflow_tasks"."completed_by_actor_type" IS NOT NULL AND "ops_workflow_tasks"."completed_by_actor_name" IS NOT NULL AND "ops_workflow_tasks"."cancelled_at" IS NULL) OR ("ops_workflow_tasks"."status" = 'cancelled' AND "ops_workflow_tasks"."cancelled_at" IS NOT NULL AND "ops_workflow_tasks"."cancelled_by_actor_type" IS NOT NULL AND "ops_workflow_tasks"."cancelled_by_actor_name" IS NOT NULL AND "ops_workflow_tasks"."completed_at" IS NULL) OR ("ops_workflow_tasks"."status" IN ('open', 'in_progress') AND "ops_workflow_tasks"."completed_at" IS NULL AND "ops_workflow_tasks"."cancelled_at" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_workflow_tasks_org_id` ON `ops_workflow_tasks` (`organization_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_workflow_tasks_org_followup` ON `ops_workflow_tasks` (`organization_id`,`source_follow_up_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_workflow_tasks_org_approval` ON `ops_workflow_tasks` (`organization_id`,`source_approval_request_id`);--> statement-breakpoint
CREATE INDEX `idx_ops_workflow_tasks_org_work_status_due` ON `ops_workflow_tasks` (`organization_id`,`work_order_id`,`status`,`due_at`);--> statement-breakpoint
CREATE INDEX `idx_ops_workflow_tasks_org_assignee_status_due` ON `ops_workflow_tasks` (`organization_id`,`assignee_type`,`assignee_id`,`status`,`due_at`);