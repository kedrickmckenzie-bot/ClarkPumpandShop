CREATE TABLE `ops_vendor_continuations` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`work_order_id` text NOT NULL,
	`vendor_response_id` text NOT NULL,
	`action` text NOT NULL,
	`message` text,
	`created_by_membership_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_vendor_continuations_resp_action` ON `ops_vendor_continuations` (`organization_id`,`vendor_response_id`,`action`);