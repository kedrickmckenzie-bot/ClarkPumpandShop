CREATE TABLE `ops_equipment_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`conversation_id` text NOT NULL,
	`note_json` text NOT NULL,
	`provider` text,
	`model` text,
	`created_by_membership_id` text,
	`created_by_name` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `ops_organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`work_order_id`) REFERENCES `ops_work_orders`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`conversation_id`) REFERENCES `ops_ai_conversations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_ops_equipment_notes_work` ON `ops_equipment_notes` (`organization_id`,`work_order_id`,`created_at`);