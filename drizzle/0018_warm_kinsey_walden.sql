PRAGMA defer_foreign_keys = ON;--> statement-breakpoint
CREATE TABLE `ops_site_visit_work_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`visit_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`ordinal` integer NOT NULL,
	`linked_by_actor_type` text NOT NULL,
	`linked_by_actor_id` text,
	`linked_by_actor_name` text NOT NULL,
	`linked_at` text NOT NULL,
	`outcome` text,
	`outcome_notes` text,
	`outcome_recorded_by_actor_type` text,
	`outcome_recorded_by_actor_id` text,
	`outcome_recorded_by_actor_name` text,
	`outcome_recorded_at` text,
	`follow_up_id` text,
	FOREIGN KEY (`organization_id`,`visit_id`) REFERENCES `ops_visit_sessions`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`work_order_id`) REFERENCES `ops_work_orders`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`follow_up_id`) REFERENCES `ops_follow_ups`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_ops_site_visit_work_ordinal" CHECK("ops_site_visit_work_orders"."ordinal" > 0),
	CONSTRAINT "chk_ops_site_visit_work_link_actor" CHECK("ops_site_visit_work_orders"."linked_by_actor_type" IN ('user', 'vendor_link', 'technician', 'store_device', 'system', 'support') AND length(trim("ops_site_visit_work_orders"."linked_by_actor_name")) > 0),
	CONSTRAINT "chk_ops_site_visit_work_outcome" CHECK("ops_site_visit_work_orders"."outcome" IS NULL OR "ops_site_visit_work_orders"."outcome" IN ('completed', 'diagnosis_only', 'quote_required', 'parts_required', 'return_visit_required', 'no_issue_found', 'store_access_unavailable', 'work_not_authorized', 'not_addressed')),
	CONSTRAINT "chk_ops_site_visit_work_outcome_actor" CHECK("ops_site_visit_work_orders"."outcome_recorded_by_actor_type" IS NULL OR "ops_site_visit_work_orders"."outcome_recorded_by_actor_type" IN ('user', 'vendor_link', 'technician', 'store_device', 'system', 'support')),
	CONSTRAINT "chk_ops_site_visit_work_outcome_state" CHECK(("ops_site_visit_work_orders"."outcome" IS NULL AND "ops_site_visit_work_orders"."outcome_notes" IS NULL AND "ops_site_visit_work_orders"."outcome_recorded_by_actor_type" IS NULL AND "ops_site_visit_work_orders"."outcome_recorded_by_actor_id" IS NULL AND "ops_site_visit_work_orders"."outcome_recorded_by_actor_name" IS NULL AND "ops_site_visit_work_orders"."outcome_recorded_at" IS NULL AND "ops_site_visit_work_orders"."follow_up_id" IS NULL) OR ("ops_site_visit_work_orders"."outcome" IS NOT NULL AND "ops_site_visit_work_orders"."outcome_recorded_by_actor_type" IS NOT NULL AND length(trim("ops_site_visit_work_orders"."outcome_recorded_by_actor_name")) > 0 AND "ops_site_visit_work_orders"."outcome_recorded_at" IS NOT NULL)),
	CONSTRAINT "chk_ops_site_visit_work_followup_outcome" CHECK("ops_site_visit_work_orders"."follow_up_id" IS NULL OR "ops_site_visit_work_orders"."outcome" NOT IN ('completed', 'no_issue_found'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_site_visit_work_org_id` ON `ops_site_visit_work_orders` (`organization_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_site_visit_work_org_id_work` ON `ops_site_visit_work_orders` (`organization_id`,`id`,`work_order_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_site_visit_work_org_visit_work` ON `ops_site_visit_work_orders` (`organization_id`,`visit_id`,`work_order_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_site_visit_work_org_visit_ordinal` ON `ops_site_visit_work_orders` (`organization_id`,`visit_id`,`ordinal`);--> statement-breakpoint
CREATE INDEX `idx_ops_site_visit_work_org_work_time` ON `ops_site_visit_work_orders` (`organization_id`,`work_order_id`,`linked_at`);--> statement-breakpoint
CREATE INDEX `idx_ops_site_visit_work_org_outcome_time` ON `ops_site_visit_work_orders` (`organization_id`,`outcome`,`outcome_recorded_at`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_ops_visit_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`store_id` text NOT NULL,
	`provider_kind` text NOT NULL,
	`vendor_id` text,
	`internal_membership_id` text,
	`work_order_id` text,
	`unmatched_reason` text,
	`technician_name` text NOT NULL,
	`technician_phone_or_pin` text,
	`crew_count` integer DEFAULT 1 NOT NULL,
	`additional_technician_names_json` text DEFAULT '[]' NOT NULL,
	`vehicle_identifier` text,
	`arrival_note` text,
	`provider_name` text NOT NULL,
	`purpose` text NOT NULL,
	`status` text NOT NULL,
	`started_channel` text NOT NULL,
	`ended_channel` text,
	`checked_in_at` text NOT NULL,
	`checked_out_at` text,
	`outcome` text,
	`outcome_notes` text,
	`observed_duration_seconds` integer,
	CONSTRAINT "chk_ops_visits_crew_count" CHECK("__new_ops_visit_sessions"."crew_count" BETWEEN 1 AND 100),
	CONSTRAINT "chk_ops_visits_additional_technicians" CHECK(json_valid("__new_ops_visit_sessions"."additional_technician_names_json") AND json_type("__new_ops_visit_sessions"."additional_technician_names_json") = 'array' AND json_array_length("__new_ops_visit_sessions"."additional_technician_names_json") < "__new_ops_visit_sessions"."crew_count")
);
--> statement-breakpoint
INSERT INTO `__new_ops_visit_sessions`("id", "organization_id", "store_id", "provider_kind", "vendor_id", "internal_membership_id", "work_order_id", "unmatched_reason", "technician_name", "technician_phone_or_pin", "crew_count", "additional_technician_names_json", "vehicle_identifier", "arrival_note", "provider_name", "purpose", "status", "started_channel", "ended_channel", "checked_in_at", "checked_out_at", "outcome", "outcome_notes", "observed_duration_seconds") SELECT "id", "organization_id", "store_id", "provider_kind", "vendor_id", "internal_membership_id", "work_order_id", "unmatched_reason", "technician_name", NULL, 1, '[]', NULL, NULL, "provider_name", "purpose", "status", "started_channel", "ended_channel", "checked_in_at", "checked_out_at", "outcome", "outcome_notes", "observed_duration_seconds" FROM `ops_visit_sessions`;--> statement-breakpoint
DROP TABLE `ops_visit_sessions`;--> statement-breakpoint
ALTER TABLE `__new_ops_visit_sessions` RENAME TO `ops_visit_sessions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_visits_org_id` ON `ops_visit_sessions` (`organization_id`,`id`);--> statement-breakpoint
CREATE INDEX `idx_ops_visits_org_store_status_time` ON `ops_visit_sessions` (`organization_id`,`store_id`,`status`,`checked_in_at`);--> statement-breakpoint
CREATE INDEX `idx_ops_visits_org_vendor_status_time` ON `ops_visit_sessions` (`organization_id`,`vendor_id`,`status`,`checked_in_at`);--> statement-breakpoint
CREATE INDEX `idx_ops_visits_org_work_time` ON `ops_visit_sessions` (`organization_id`,`work_order_id`,`checked_in_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_followups_org_id` ON `ops_follow_ups` (`organization_id`,`id`);--> statement-breakpoint
INSERT INTO `ops_site_visit_work_orders` (
	`id`, `organization_id`, `visit_id`, `work_order_id`, `ordinal`,
	`linked_by_actor_type`, `linked_by_actor_name`, `linked_at`,
	`outcome`, `outcome_notes`, `outcome_recorded_by_actor_type`,
	`outcome_recorded_by_actor_name`, `outcome_recorded_at`, `follow_up_id`
)
SELECT
	'site-visit-work-backfill-' || v.`id`, v.`organization_id`, v.`id`, v.`work_order_id`, 1,
	'system', 'Migration backfill', v.`checked_in_at`,
	CASE v.`outcome`
		WHEN 'resolved' THEN 'completed'
		WHEN 'temporary_repair' THEN 'return_visit_required'
		WHEN 'diagnosed_waiting_parts' THEN 'parts_required'
		WHEN 'return_required' THEN 'return_visit_required'
		WHEN 'unable_to_complete' THEN 'not_addressed'
		WHEN 'unable_to_reproduce' THEN 'no_issue_found'
		WHEN 'no_issue_found' THEN 'no_issue_found'
		WHEN 'inspection_complete' THEN 'completed'
		WHEN 'pm_complete' THEN 'completed'
		WHEN 'other' THEN 'not_addressed'
		ELSE NULL
	END,
	v.`outcome_notes`,
	CASE WHEN v.`outcome` IS NOT NULL THEN 'system' ELSE NULL END,
	CASE WHEN v.`outcome` IS NOT NULL THEN 'Migration backfill' ELSE NULL END,
	CASE WHEN v.`outcome` IS NOT NULL THEN COALESCE(v.`checked_out_at`, v.`checked_in_at`) ELSE NULL END,
	CASE WHEN v.`outcome` IN ('temporary_repair', 'diagnosed_waiting_parts', 'return_required', 'unable_to_complete', 'other') THEN (
		SELECT f.`id` FROM `ops_follow_ups` f
		WHERE f.`organization_id` = v.`organization_id`
			AND f.`source_visit_id` = v.`id`
			AND f.`work_order_id` = v.`work_order_id`
		ORDER BY f.`created_at`, f.`id` LIMIT 1
	) ELSE NULL END
FROM `ops_visit_sessions` v
WHERE v.`work_order_id` IS NOT NULL;
