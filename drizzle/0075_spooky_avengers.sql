CREATE TABLE `ops_technician_statuses` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`membership_id` text NOT NULL,
	`revision` integer NOT NULL,
	`status` text NOT NULL,
	`work_order_id` text,
	`store_id` text NOT NULL,
	`recorded_at` text NOT NULL,
	FOREIGN KEY (`organization_id`,`membership_id`) REFERENCES `ops_memberships`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`store_id`) REFERENCES `ops_stores`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`work_order_id`) REFERENCES `ops_work_orders`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_ops_technician_status" CHECK("ops_technician_statuses"."revision" > 0 AND "ops_technician_statuses"."status" IN ('heading','parts','break','done') AND ("ops_technician_statuses"."status" != 'heading' OR "ops_technician_statuses"."work_order_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ops_technician_status_revision` ON `ops_technician_statuses` (`organization_id`,`membership_id`,`revision`);