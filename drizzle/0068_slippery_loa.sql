CREATE TABLE `ops_work_results` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`assignment_id` text,
	`site_visit_work_order_id` text,
	`performer_membership_id` text,
	`performer_name` text NOT NULL,
	`source` text NOT NULL,
	`outcome` text NOT NULL,
	`outcome_notes` text,
	`blocker` text,
	`linked_at` text NOT NULL,
	`outcome_recorded_at` text NOT NULL,
	`cycle_version` integer NOT NULL,
	`outcome_recorded_by_actor_type` text NOT NULL,
	`outcome_recorded_by_actor_id` text,
	`outcome_recorded_by_actor_name` text NOT NULL,
	`reported_performed_at` text,
	`supersedes_result_id` text,
	`correction_reason` text,
	`follow_up_id` text,
	FOREIGN KEY (`organization_id`,`work_order_id`) REFERENCES `ops_work_orders`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`site_visit_work_order_id`,`work_order_id`) REFERENCES `ops_site_visit_work_orders`(`organization_id`,`id`,`work_order_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_ops_work_results_source" CHECK("ops_work_results"."source" IN ('technician_report','visit_checkout','phone','email','in_person','correction')),
	CONSTRAINT "chk_ops_work_results_outcome" CHECK("ops_work_results"."outcome" IN ('completed','temporary_repair','diagnosis_only','quote_required','parts_required','return_visit_required','no_issue_found','store_access_unavailable','work_not_authorized','not_addressed')),
	CONSTRAINT "chk_ops_work_results_cycle" CHECK("ops_work_results"."cycle_version" > 0),
	CONSTRAINT "chk_ops_work_results_correction" CHECK("ops_work_results"."source" <> 'correction' OR ("ops_work_results"."correction_reason" IS NOT NULL AND length(trim("ops_work_results"."correction_reason")) > 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_work_results_org_id_work` ON `ops_work_results` (`organization_id`,`id`,`work_order_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_work_results_org_work_cycle` ON `ops_work_results` (`organization_id`,`work_order_id`,`cycle_version`);--> statement-breakpoint
CREATE INDEX `idx_ops_work_results_org_work_time` ON `ops_work_results` (`organization_id`,`work_order_id`,`outcome_recorded_at`);--> statement-breakpoint
CREATE TABLE `__new_ops_work_order_verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`site_visit_work_order_id` text,
	`work_result_id` text,
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
	FOREIGN KEY (`organization_id`,`work_result_id`,`work_order_id`) REFERENCES `ops_work_results`(`organization_id`,`id`,`work_order_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_ops_work_verifications_target" CHECK(("__new_ops_work_order_verifications"."site_visit_work_order_id" IS NOT NULL AND "__new_ops_work_order_verifications"."work_result_id" IS NULL) OR ("__new_ops_work_order_verifications"."site_visit_work_order_id" IS NULL AND "__new_ops_work_order_verifications"."work_result_id" IS NOT NULL)),
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
INSERT INTO `__new_ops_work_order_verifications`("id", "organization_id", "work_order_id", "site_visit_work_order_id", "work_result_id", "outcome", "outcome_recorded_at", "cycle", "decision", "basis", "verification_scope", "reason", "decided_by_membership_id", "decided_by_name", "decided_at") SELECT "id", "organization_id", "work_order_id", "site_visit_work_order_id", NULL, "outcome", "outcome_recorded_at", "cycle", "decision", "basis", "verification_scope", "reason", "decided_by_membership_id", "decided_by_name", "decided_at" FROM `ops_work_order_verifications`;--> statement-breakpoint
DROP TABLE `ops_work_order_verifications`;--> statement-breakpoint
ALTER TABLE `__new_ops_work_order_verifications` RENAME TO `ops_work_order_verifications`;--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_work_verifications_org_id` ON `ops_work_order_verifications` (`organization_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_work_verifications_org_cycle` ON `ops_work_order_verifications` (`organization_id`,`work_order_id`,`cycle`);--> statement-breakpoint
CREATE INDEX `idx_ops_work_verifications_org_work_time` ON `ops_work_order_verifications` (`organization_id`,`work_order_id`,`decided_at`);--> statement-breakpoint
ALTER TABLE `ops_site_visit_work_orders` ADD `cycle_version` integer;--> statement-breakpoint
ALTER TABLE `ops_workflow_policies` ADD `internal_check_in_required` integer DEFAULT 0 NOT NULL;