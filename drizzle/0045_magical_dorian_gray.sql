ALTER TABLE `ops_requests` ADD `acknowledged_at` text;--> statement-breakpoint
ALTER TABLE `ops_requests` ADD `acknowledged_by_actor_type` text;--> statement-breakpoint
ALTER TABLE `ops_requests` ADD `acknowledged_by_actor_id` text;--> statement-breakpoint
ALTER TABLE `ops_requests` ADD `acknowledged_by_actor_name` text;--> statement-breakpoint
ALTER TABLE `ops_requests` ADD `linked_work_order_id` text;--> statement-breakpoint
ALTER TABLE `ops_requests` ADD `linked_at` text;--> statement-breakpoint
ALTER TABLE `ops_requests` ADD `linked_by_actor_type` text;--> statement-breakpoint
ALTER TABLE `ops_requests` ADD `linked_by_actor_id` text;--> statement-breakpoint
ALTER TABLE `ops_requests` ADD `linked_by_actor_name` text;