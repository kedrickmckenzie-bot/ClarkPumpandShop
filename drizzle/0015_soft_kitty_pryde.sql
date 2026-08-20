CREATE TABLE `ops_approval_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`approval_request_id` text NOT NULL,
	`decision` text NOT NULL,
	`decided_by_membership_id` text,
	`decided_by_name` text NOT NULL,
	`decided_by_role` text NOT NULL,
	`reason` text,
	`escalated_to_role` text,
	`decided_at` text NOT NULL,
	FOREIGN KEY (`organization_id`,`approval_request_id`) REFERENCES `ops_approval_requests`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_ops_approval_decisions_kind" CHECK("ops_approval_decisions"."decision" IN ('approved', 'rejected', 'escalated', 'cancelled')),
	CONSTRAINT "chk_ops_approval_decisions_role" CHECK("ops_approval_decisions"."decided_by_role" IN ('executive', 'facilities_admin', 'regional_manager', 'store_manager', 'finance_reviewer')),
	CONSTRAINT "chk_ops_approval_decisions_escalated" CHECK(("ops_approval_decisions"."decision" = 'escalated' AND "ops_approval_decisions"."escalated_to_role" IS NOT NULL) OR ("ops_approval_decisions"."decision" <> 'escalated' AND "ops_approval_decisions"."escalated_to_role" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_approval_decisions_org_id` ON `ops_approval_decisions` (`organization_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_approval_decisions_org_request` ON `ops_approval_decisions` (`organization_id`,`approval_request_id`);--> statement-breakpoint
CREATE INDEX `idx_ops_approval_decisions_org_time` ON `ops_approval_decisions` (`organization_id`,`decided_at`);--> statement-breakpoint
CREATE TABLE `ops_approval_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`policy_key` text NOT NULL,
	`version` integer NOT NULL,
	`name` text NOT NULL,
	`scope_kind` text NOT NULL,
	`scope_id` text NOT NULL,
	`category_key` text,
	`min_amount_minor` integer NOT NULL,
	`max_amount_minor` integer,
	`currency` text NOT NULL,
	`required_role` text NOT NULL,
	`escalation_role` text,
	`status` text NOT NULL,
	`supersedes_policy_id` text,
	`created_by_membership_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `ops_organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`supersedes_policy_id`) REFERENCES `ops_approval_policies`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_ops_approval_policies_version" CHECK("ops_approval_policies"."version" > 0),
	CONSTRAINT "chk_ops_approval_policies_scope" CHECK("ops_approval_policies"."scope_kind" IN ('organization', 'region', 'store')),
	CONSTRAINT "chk_ops_approval_policies_amount" CHECK("ops_approval_policies"."min_amount_minor" BETWEEN 0 AND 9007199254740991 AND ("ops_approval_policies"."max_amount_minor" IS NULL OR "ops_approval_policies"."max_amount_minor" BETWEEN "ops_approval_policies"."min_amount_minor" AND 9007199254740991)),
	CONSTRAINT "chk_ops_approval_policies_currency" CHECK(length(trim("ops_approval_policies"."currency")) > 0),
	CONSTRAINT "chk_ops_approval_policies_required_role" CHECK("ops_approval_policies"."required_role" IN ('executive', 'facilities_admin', 'regional_manager', 'store_manager', 'finance_reviewer')),
	CONSTRAINT "chk_ops_approval_policies_escalation_role" CHECK("ops_approval_policies"."escalation_role" IS NULL OR "ops_approval_policies"."escalation_role" IN ('executive', 'facilities_admin', 'regional_manager', 'store_manager', 'finance_reviewer')),
	CONSTRAINT "chk_ops_approval_policies_status" CHECK("ops_approval_policies"."status" IN ('active', 'superseded', 'inactive'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_approval_policies_org_id` ON `ops_approval_policies` (`organization_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_approval_policies_org_key_version` ON `ops_approval_policies` (`organization_id`,`policy_key`,`version`);--> statement-breakpoint
CREATE INDEX `idx_ops_approval_policies_org_status_scope` ON `ops_approval_policies` (`organization_id`,`status`,`scope_kind`,`scope_id`);--> statement-breakpoint
CREATE INDEX `idx_ops_approval_policies_org_category_amount` ON `ops_approval_policies` (`organization_id`,`category_key`,`min_amount_minor`);--> statement-breakpoint
CREATE TABLE `ops_approval_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`subject_type` text NOT NULL,
	`subject_id` text NOT NULL,
	`store_id` text NOT NULL,
	`category_key` text,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`policy_id` text NOT NULL,
	`policy_key` text NOT NULL,
	`policy_version` integer NOT NULL,
	`policy_name` text NOT NULL,
	`policy_scope_kind` text NOT NULL,
	`policy_scope_id` text NOT NULL,
	`required_role` text NOT NULL,
	`escalation_role` text,
	`requested_by_membership_id` text,
	`requested_by_name` text NOT NULL,
	`reason` text,
	`requested_at` text NOT NULL,
	`due_at` text,
	`parent_approval_request_id` text,
	FOREIGN KEY (`organization_id`) REFERENCES `ops_organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`policy_id`) REFERENCES `ops_approval_policies`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`store_id`) REFERENCES `ops_stores`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`parent_approval_request_id`) REFERENCES `ops_approval_requests`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_ops_approval_requests_subject" CHECK("ops_approval_requests"."subject_type" IN ('service_request', 'work_order')),
	CONSTRAINT "chk_ops_approval_requests_amount" CHECK("ops_approval_requests"."amount_minor" BETWEEN 0 AND 9007199254740991),
	CONSTRAINT "chk_ops_approval_requests_policy_version" CHECK("ops_approval_requests"."policy_version" > 0),
	CONSTRAINT "chk_ops_approval_requests_scope" CHECK("ops_approval_requests"."policy_scope_kind" IN ('organization', 'region', 'store')),
	CONSTRAINT "chk_ops_approval_requests_required_role" CHECK("ops_approval_requests"."required_role" IN ('executive', 'facilities_admin', 'regional_manager', 'store_manager', 'finance_reviewer')),
	CONSTRAINT "chk_ops_approval_requests_due" CHECK("ops_approval_requests"."due_at" IS NULL OR "ops_approval_requests"."due_at" >= "ops_approval_requests"."requested_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_approval_requests_org_id` ON `ops_approval_requests` (`organization_id`,`id`);--> statement-breakpoint
CREATE INDEX `idx_ops_approval_requests_org_subject_time` ON `ops_approval_requests` (`organization_id`,`subject_type`,`subject_id`,`requested_at`);--> statement-breakpoint
CREATE INDEX `idx_ops_approval_requests_org_role_due` ON `ops_approval_requests` (`organization_id`,`required_role`,`due_at`);