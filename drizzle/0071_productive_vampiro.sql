ALTER TABLE `ops_stores` ADD `phone` text;--> statement-breakpoint
ALTER TABLE `ops_stores` ADD `access_notes` text;--> statement-breakpoint
ALTER TABLE `ops_stores` ADD `access_notes_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ops_users` ADD `phone` text;