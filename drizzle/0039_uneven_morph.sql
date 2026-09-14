CREATE TABLE `ops_vendor_compliance_alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`vendor_id` text NOT NULL,
	`document_id` text NOT NULL,
	`stage` text NOT NULL,
	`expires_at` text NOT NULL,
	`reminder_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_vendor_compliance_alert_doc_stage` ON `ops_vendor_compliance_alerts` (`organization_id`,`document_id`,`stage`);--> statement-breakpoint
CREATE INDEX `idx_ops_vendor_compliance_alert_org_vendor_created` ON `ops_vendor_compliance_alerts` (`organization_id`,`vendor_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `ops_work_order_visit_holds` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`posture` text NOT NULL,
	`status` text NOT NULL,
	`internal_review_threshold_minor` integer,
	`currency` text,
	`deadline_at` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`claimed_visit_id` text,
	`claimed_vendor_id` text,
	`claimed_at` text,
	`created_by_membership_id` text,
	`created_by_name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_work_order_visit_holds_org_work` ON `ops_work_order_visit_holds` (`organization_id`,`work_order_id`);--> statement-breakpoint
CREATE INDEX `idx_ops_work_order_visit_holds_org_status_deadline` ON `ops_work_order_visit_holds` (`organization_id`,`status`,`deadline_at`);--> statement-breakpoint
-- Preserve verification rows before rebuilding their referenced visit-work table.
-- D1 keeps foreign keys enforced inside the atomic migration transaction.
CREATE TABLE `__migration_0039_verifications` AS SELECT * FROM `ops_work_order_verifications`;--> statement-breakpoint
DROP TABLE `ops_work_order_verifications`;--> statement-breakpoint
CREATE TABLE `__new_ops_site_visit_work_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`visit_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`ordinal` integer NOT NULL,
	`linked_by_actor_type` text NOT NULL,
	`linked_by_actor_id` text,
	`linked_by_actor_name` text NOT NULL,
	`linked_at` text NOT NULL,
	`selection_source` text DEFAULT 'assigned_work' NOT NULL,
	`work_order_hold_id` text,
	`outcome` text,
	`outcome_notes` text,
	`outcome_recorded_by_actor_type` text,
	`outcome_recorded_by_actor_id` text,
	`outcome_recorded_by_actor_name` text,
	`outcome_recorded_at` text,
	`follow_up_id` text,
	`vendor_follow_up_timing` text,
	FOREIGN KEY (`organization_id`,`visit_id`) REFERENCES `ops_visit_sessions`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`work_order_id`) REFERENCES `ops_work_orders`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`follow_up_id`) REFERENCES `ops_follow_ups`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_ops_site_visit_work_ordinal" CHECK("__new_ops_site_visit_work_orders"."ordinal" > 0),
	CONSTRAINT "chk_ops_site_visit_work_link_actor" CHECK("__new_ops_site_visit_work_orders"."linked_by_actor_type" IN ('user', 'vendor_link', 'technician', 'store_device', 'system', 'support') AND length(trim("__new_ops_site_visit_work_orders"."linked_by_actor_name")) > 0),
	CONSTRAINT "chk_ops_site_visit_work_outcome" CHECK("__new_ops_site_visit_work_orders"."outcome" IS NULL OR "__new_ops_site_visit_work_orders"."outcome" IN ('completed', 'temporary_repair', 'diagnosis_only', 'quote_required', 'parts_required', 'return_visit_required', 'no_issue_found', 'store_access_unavailable', 'work_not_authorized', 'not_addressed')),
	CONSTRAINT "chk_ops_site_visit_work_outcome_actor" CHECK("__new_ops_site_visit_work_orders"."outcome_recorded_by_actor_type" IS NULL OR "__new_ops_site_visit_work_orders"."outcome_recorded_by_actor_type" IN ('user', 'vendor_link', 'technician', 'store_device', 'system', 'support')),
	CONSTRAINT "chk_ops_site_visit_work_outcome_state" CHECK(("__new_ops_site_visit_work_orders"."outcome" IS NULL AND "__new_ops_site_visit_work_orders"."outcome_notes" IS NULL AND "__new_ops_site_visit_work_orders"."outcome_recorded_by_actor_type" IS NULL AND "__new_ops_site_visit_work_orders"."outcome_recorded_by_actor_id" IS NULL AND "__new_ops_site_visit_work_orders"."outcome_recorded_by_actor_name" IS NULL AND "__new_ops_site_visit_work_orders"."outcome_recorded_at" IS NULL AND "__new_ops_site_visit_work_orders"."follow_up_id" IS NULL) OR ("__new_ops_site_visit_work_orders"."outcome" IS NOT NULL AND "__new_ops_site_visit_work_orders"."outcome_recorded_by_actor_type" IS NOT NULL AND length(trim("__new_ops_site_visit_work_orders"."outcome_recorded_by_actor_name")) > 0 AND "__new_ops_site_visit_work_orders"."outcome_recorded_at" IS NOT NULL)),
	CONSTRAINT "chk_ops_site_visit_work_followup_outcome" CHECK("__new_ops_site_visit_work_orders"."follow_up_id" IS NULL OR "__new_ops_site_visit_work_orders"."outcome" NOT IN ('completed', 'no_issue_found'))
);
--> statement-breakpoint
INSERT INTO `__new_ops_site_visit_work_orders`("id", "organization_id", "visit_id", "work_order_id", "ordinal", "linked_by_actor_type", "linked_by_actor_id", "linked_by_actor_name", "linked_at", "selection_source", "work_order_hold_id", "outcome", "outcome_notes", "outcome_recorded_by_actor_type", "outcome_recorded_by_actor_id", "outcome_recorded_by_actor_name", "outcome_recorded_at", "follow_up_id", "vendor_follow_up_timing") SELECT "id", "organization_id", "visit_id", "work_order_id", "ordinal", "linked_by_actor_type", "linked_by_actor_id", "linked_by_actor_name", "linked_at", 'assigned_work', NULL, "outcome", "outcome_notes", "outcome_recorded_by_actor_type", "outcome_recorded_by_actor_id", "outcome_recorded_by_actor_name", "outcome_recorded_at", "follow_up_id", NULL FROM `ops_site_visit_work_orders`;--> statement-breakpoint
DROP TABLE `ops_site_visit_work_orders`;--> statement-breakpoint
ALTER TABLE `__new_ops_site_visit_work_orders` RENAME TO `ops_site_visit_work_orders`;--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_site_visit_work_org_id` ON `ops_site_visit_work_orders` (`organization_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_site_visit_work_org_id_work` ON `ops_site_visit_work_orders` (`organization_id`,`id`,`work_order_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_site_visit_work_org_visit_work` ON `ops_site_visit_work_orders` (`organization_id`,`visit_id`,`work_order_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_site_visit_work_org_visit_ordinal` ON `ops_site_visit_work_orders` (`organization_id`,`visit_id`,`ordinal`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_site_visit_work_org_hold_claim` ON `ops_site_visit_work_orders` (`organization_id`,`work_order_hold_id`) WHERE "ops_site_visit_work_orders"."work_order_hold_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_ops_site_visit_work_org_work_time` ON `ops_site_visit_work_orders` (`organization_id`,`work_order_id`,`linked_at`);--> statement-breakpoint
CREATE INDEX `idx_ops_site_visit_work_org_outcome_time` ON `ops_site_visit_work_orders` (`organization_id`,`outcome`,`outcome_recorded_at`);--> statement-breakpoint
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
INSERT INTO `ops_work_order_verifications` ("id", "organization_id", "work_order_id", "site_visit_work_order_id", "outcome", "outcome_recorded_at", "cycle", "decision", "reason", "decided_by_membership_id", "decided_by_name", "decided_at") SELECT "id", "organization_id", "work_order_id", "site_visit_work_order_id", "outcome", "outcome_recorded_at", "cycle", "decision", "reason", "decided_by_membership_id", "decided_by_name", "decided_at" FROM `__migration_0039_verifications`;--> statement-breakpoint
DROP TABLE `__migration_0039_verifications`;
