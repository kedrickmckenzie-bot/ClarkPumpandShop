CREATE TABLE `ops_work_order_callbacks` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`original_work_order_id` text NOT NULL,
	`source` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`created_by_name` text NOT NULL,
	`created_by_actor_id` text,
	`resolved_at` text,
	`resolved_by_name` text,
	`reason` text,
	FOREIGN KEY (`organization_id`) REFERENCES `ops_organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`work_order_id`) REFERENCES `ops_work_orders`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`original_work_order_id`) REFERENCES `ops_work_orders`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_ops_work_order_callbacks_source" CHECK("ops_work_order_callbacks"."source" IN ('sent','linked','suggested')),
	CONSTRAINT "chk_ops_work_order_callbacks_status" CHECK("ops_work_order_callbacks"."status" IN ('open','no_charge','new_work','not_callback')),
	CONSTRAINT "chk_ops_work_order_callbacks_self" CHECK("ops_work_order_callbacks"."work_order_id" <> "ops_work_order_callbacks"."original_work_order_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_work_order_callbacks_work` ON `ops_work_order_callbacks` (`organization_id`,`work_order_id`);--> statement-breakpoint
CREATE INDEX `idx_ops_work_order_callbacks_original` ON `ops_work_order_callbacks` (`organization_id`,`original_work_order_id`);