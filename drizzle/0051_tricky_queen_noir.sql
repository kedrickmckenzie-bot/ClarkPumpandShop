ALTER TABLE `ops_manufacturer_warranties` ADD `provider_kind` text DEFAULT 'manufacturer' NOT NULL;--> statement-breakpoint
ALTER TABLE `ops_manufacturer_warranties` ADD `vendor_id` text;--> statement-breakpoint
ALTER TABLE `ops_manufacturer_warranties` ADD `work_order_id` text;--> statement-breakpoint
ALTER TABLE `ops_manufacturer_warranties` ADD `title` text;--> statement-breakpoint
ALTER TABLE `ops_work_orders` ADD `internal_review_threshold_minor` integer;--> statement-breakpoint
ALTER TABLE `ops_work_orders` ADD `internal_review_currency` text;