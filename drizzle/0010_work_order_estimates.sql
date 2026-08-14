CREATE TABLE `ops_vendor_estimate_proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`request_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`vendor_id` text NOT NULL,
	`revision` integer NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`scope` text NOT NULL,
	`exclusions` text,
	`lead_time_days` integer,
	`valid_until` text,
	`submitted_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `ops_organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`work_order_id`) REFERENCES `ops_work_orders`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`vendor_id`) REFERENCES `ops_vendors`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`request_id`,`work_order_id`,`vendor_id`) REFERENCES `ops_work_order_estimate_requests`(`organization_id`,`id`,`work_order_id`,`vendor_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_ops_estimate_proposals_revision" CHECK("ops_vendor_estimate_proposals"."revision" > 0),
	CONSTRAINT "chk_ops_estimate_proposals_amount" CHECK("ops_vendor_estimate_proposals"."amount_minor" BETWEEN 0 AND 9007199254740991),
	CONSTRAINT "chk_ops_estimate_proposals_currency" CHECK(length(trim("ops_vendor_estimate_proposals"."currency")) > 0),
	CONSTRAINT "chk_ops_estimate_proposals_scope" CHECK(length(trim("ops_vendor_estimate_proposals"."scope")) > 0),
	CONSTRAINT "chk_ops_estimate_proposals_lead_time" CHECK("ops_vendor_estimate_proposals"."lead_time_days" IS NULL OR "ops_vendor_estimate_proposals"."lead_time_days" BETWEEN 0 AND 3650),
	CONSTRAINT "chk_ops_estimate_proposals_valid_until" CHECK("ops_vendor_estimate_proposals"."valid_until" IS NULL OR "ops_vendor_estimate_proposals"."valid_until" > "ops_vendor_estimate_proposals"."submitted_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_estimate_proposals_org_id` ON `ops_vendor_estimate_proposals` (`organization_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_estimate_proposals_org_request_revision` ON `ops_vendor_estimate_proposals` (`organization_id`,`request_id`,`revision`);--> statement-breakpoint
CREATE INDEX `idx_ops_estimate_proposals_org_work_submitted` ON `ops_vendor_estimate_proposals` (`organization_id`,`work_order_id`,`submitted_at`);--> statement-breakpoint
CREATE INDEX `idx_ops_estimate_proposals_org_vendor_submitted` ON `ops_vendor_estimate_proposals` (`organization_id`,`vendor_id`,`submitted_at`);--> statement-breakpoint
CREATE TABLE `ops_work_order_estimate_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`vendor_id` text NOT NULL,
	`kind` text NOT NULL,
	`requested_scope` text NOT NULL,
	`status` text NOT NULL,
	`channel` text NOT NULL,
	`requested_at` text NOT NULL,
	`due_at` text,
	`opened_at` text,
	`responded_at` text,
	`decision_at` text,
	FOREIGN KEY (`organization_id`) REFERENCES `ops_organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`work_order_id`) REFERENCES `ops_work_orders`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`vendor_id`) REFERENCES `ops_vendors`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_ops_estimate_requests_kind" CHECK("ops_work_order_estimate_requests"."kind" IN ('estimate_only', 'diagnostic_and_estimate')),
	CONSTRAINT "chk_ops_estimate_requests_status" CHECK("ops_work_order_estimate_requests"."status" IN ('requested', 'opened', 'submitted', 'declined', 'expired', 'withdrawn', 'selected', 'not_selected')),
	CONSTRAINT "chk_ops_estimate_requests_channel" CHECK("ops_work_order_estimate_requests"."channel" IN ('email', 'sms', 'manual')),
	CONSTRAINT "chk_ops_estimate_requests_scope" CHECK(length(trim("ops_work_order_estimate_requests"."requested_scope")) > 0),
	CONSTRAINT "chk_ops_estimate_requests_due" CHECK("ops_work_order_estimate_requests"."due_at" IS NULL OR "ops_work_order_estimate_requests"."due_at" >= "ops_work_order_estimate_requests"."requested_at"),
	CONSTRAINT "chk_ops_estimate_requests_opened" CHECK("ops_work_order_estimate_requests"."opened_at" IS NULL OR "ops_work_order_estimate_requests"."opened_at" >= "ops_work_order_estimate_requests"."requested_at"),
	CONSTRAINT "chk_ops_estimate_requests_responded" CHECK("ops_work_order_estimate_requests"."responded_at" IS NULL OR "ops_work_order_estimate_requests"."responded_at" >= "ops_work_order_estimate_requests"."requested_at"),
	CONSTRAINT "chk_ops_estimate_requests_decision" CHECK("ops_work_order_estimate_requests"."decision_at" IS NULL OR "ops_work_order_estimate_requests"."decision_at" >= "ops_work_order_estimate_requests"."requested_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_estimate_requests_org_id` ON `ops_work_order_estimate_requests` (`organization_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_estimate_requests_org_context` ON `ops_work_order_estimate_requests` (`organization_id`,`id`,`work_order_id`,`vendor_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_estimate_requests_org_work_vendor_active` ON `ops_work_order_estimate_requests` (`organization_id`,`work_order_id`,`vendor_id`) WHERE "ops_work_order_estimate_requests"."status" IN ('requested', 'opened', 'submitted');--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_estimate_requests_org_work_selected` ON `ops_work_order_estimate_requests` (`organization_id`,`work_order_id`) WHERE "ops_work_order_estimate_requests"."status" = 'selected';--> statement-breakpoint
CREATE INDEX `idx_ops_estimate_requests_org_work_status_requested` ON `ops_work_order_estimate_requests` (`organization_id`,`work_order_id`,`status`,`requested_at`);--> statement-breakpoint
CREATE INDEX `idx_ops_estimate_requests_org_vendor_status_due` ON `ops_work_order_estimate_requests` (`organization_id`,`vendor_id`,`status`,`due_at`);--> statement-breakpoint
CREATE INDEX `idx_ops_estimate_requests_org_status_due` ON `ops_work_order_estimate_requests` (`organization_id`,`status`,`due_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_vendors_org_id` ON `ops_vendors` (`organization_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_work_orders_org_id` ON `ops_work_orders` (`organization_id`,`id`);