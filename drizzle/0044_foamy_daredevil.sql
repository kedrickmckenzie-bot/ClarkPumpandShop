CREATE TABLE `ops_role_capability_overrides` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`role` text NOT NULL,
	`capability` text NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`updated_by_membership_id` text NOT NULL,
	`updated_by_name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_role_capability_org_role_cap` ON `ops_role_capability_overrides` (`organization_id`,`role`,`capability`);--> statement-breakpoint
CREATE INDEX `idx_ops_role_capability_org_role` ON `ops_role_capability_overrides` (`organization_id`,`role`);--> statement-breakpoint
CREATE TABLE `ops_workflow_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`version` integer NOT NULL,
	`status` text NOT NULL,
	`auto_close_routine_after_verification` integer DEFAULT false NOT NULL,
	`applies_to_active_work` integer DEFAULT false NOT NULL,
	`created_by_membership_id` text NOT NULL,
	`created_by_name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_workflow_policy_org_version` ON `ops_workflow_policies` (`organization_id`,`version`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_workflow_policy_active` ON `ops_workflow_policies` (`organization_id`) WHERE "ops_workflow_policies"."status" = 'active';--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_ops_work_order_verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`site_visit_work_order_id` text NOT NULL,
	`outcome` text NOT NULL,
	`outcome_recorded_at` text NOT NULL,
	`cycle` integer NOT NULL,
	`decision` text NOT NULL,
	`basis` text,
	`verification_scope` text,
	`reason` text,
	`decided_by_membership_id` text NOT NULL,
	`decided_by_name` text NOT NULL,
	`decided_at` text NOT NULL,
	FOREIGN KEY (`organization_id`,`work_order_id`) REFERENCES `ops_work_orders`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`site_visit_work_order_id`,`work_order_id`) REFERENCES `ops_site_visit_work_orders`(`organization_id`,`id`,`work_order_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`decided_by_membership_id`) REFERENCES `ops_memberships`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_ops_work_verifications_outcome" CHECK("__new_ops_work_order_verifications"."outcome" IN ('completed', 'diagnosis_only', 'quote_required', 'parts_required', 'return_visit_required', 'no_issue_found', 'store_access_unavailable', 'work_not_authorized', 'not_addressed')),
	CONSTRAINT "chk_ops_work_verifications_cycle" CHECK("__new_ops_work_order_verifications"."cycle" > 0),
	CONSTRAINT "chk_ops_work_verifications_decision" CHECK("__new_ops_work_order_verifications"."decision" IN ('verified', 'rejected', 'inconclusive')),
	CONSTRAINT "chk_ops_work_verifications_reason" CHECK("__new_ops_work_order_verifications"."decision" = 'verified' OR ("__new_ops_work_order_verifications"."reason" IS NOT NULL AND length(trim("__new_ops_work_order_verifications"."reason")) > 0)),
	CONSTRAINT "chk_ops_work_verifications_basis" CHECK("__new_ops_work_order_verifications"."basis" IS NULL OR "__new_ops_work_order_verifications"."basis" IN ('observable_result', 'technical_evidence', 'operational_review')),
	CONSTRAINT "chk_ops_work_verifications_scope" CHECK("__new_ops_work_order_verifications"."verification_scope" IS NULL OR "__new_ops_work_order_verifications"."verification_scope" IN ('reported_problem', 'pm_task', 'technical_work')),
	CONSTRAINT "chk_ops_work_verifications_actor" CHECK(length(trim("__new_ops_work_order_verifications"."decided_by_name")) > 0),
	CONSTRAINT "chk_ops_work_verifications_time" CHECK("__new_ops_work_order_verifications"."decided_at" >= "__new_ops_work_order_verifications"."outcome_recorded_at")
);
--> statement-breakpoint
INSERT INTO `__new_ops_work_order_verifications`("id", "organization_id", "work_order_id", "site_visit_work_order_id", "outcome", "outcome_recorded_at", "cycle", "decision", "basis", "verification_scope", "reason", "decided_by_membership_id", "decided_by_name", "decided_at") SELECT "id", "organization_id", "work_order_id", "site_visit_work_order_id", "outcome", "outcome_recorded_at", "cycle", "decision", NULL, NULL, "reason", "decided_by_membership_id", "decided_by_name", "decided_at" FROM `ops_work_order_verifications`;--> statement-breakpoint
DROP TABLE `ops_work_order_verifications`;--> statement-breakpoint
ALTER TABLE `__new_ops_work_order_verifications` RENAME TO `ops_work_order_verifications`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_work_verifications_org_id` ON `ops_work_order_verifications` (`organization_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_work_verifications_org_cycle` ON `ops_work_order_verifications` (`organization_id`,`work_order_id`,`cycle`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_work_verifications_org_outcome` ON `ops_work_order_verifications` (`organization_id`,`site_visit_work_order_id`);--> statement-breakpoint
CREATE INDEX `idx_ops_work_verifications_org_work_time` ON `ops_work_order_verifications` (`organization_id`,`work_order_id`,`decided_at`);
