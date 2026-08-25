CREATE TABLE `ops_job_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`job_type` text NOT NULL,
	`slot_key` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`processed_count` integer DEFAULT 0 NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`details_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_job_runs_org_type_slot` ON `ops_job_runs` (`organization_id`,`job_type`,`slot_key`);--> statement-breakpoint
CREATE INDEX `idx_ops_job_runs_org_type_started` ON `ops_job_runs` (`organization_id`,`job_type`,`started_at`);