CREATE TABLE `ops_ust_operators` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`store_id` text NOT NULL,
	`operator_class` text NOT NULL,
	`name` text NOT NULL,
	`certificate_number` text,
	`trained_on` text,
	`expires_on` text,
	`recorded_by_name` text NOT NULL,
	`created_at` text NOT NULL,
	`removed_at` text,
	`removed_by_name` text,
	FOREIGN KEY (`organization_id`) REFERENCES `ops_organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`store_id`) REFERENCES `ops_stores`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_ops_ust_operators_class" CHECK("ops_ust_operators"."operator_class" IN ('A','B','C'))
);
--> statement-breakpoint
CREATE INDEX `idx_ops_ust_operators_store` ON `ops_ust_operators` (`organization_id`,`store_id`,`operator_class`);--> statement-breakpoint
ALTER TABLE `ops_compliance_schedules` ADD `program` text;