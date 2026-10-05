ALTER TABLE `ops_internal_schedules` ADD `stop_order` integer;--> statement-breakpoint
ALTER TABLE `ops_work_orders` ADD `technician_notes` text;--> statement-breakpoint
ALTER TABLE `ops_work_orders` ADD `estimated_minutes` integer;--> statement-breakpoint
ALTER TABLE `ops_work_orders` ADD `confirmation_delay` text;