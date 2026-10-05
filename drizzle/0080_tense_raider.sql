CREATE TABLE `ops_ai_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`kind` text NOT NULL,
	`messages_json` text NOT NULL,
	`summary` text,
	`provider` text,
	`model` text,
	`created_by_membership_id` text,
	`created_by_name` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `ops_organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`work_order_id`) REFERENCES `ops_work_orders`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_ops_ai_conversations" CHECK("ops_ai_conversations"."kind" IN ('checkout','diagnostic'))
);
--> statement-breakpoint
CREATE INDEX `idx_ops_ai_conversations_work` ON `ops_ai_conversations` (`organization_id`,`work_order_id`,`created_at`);