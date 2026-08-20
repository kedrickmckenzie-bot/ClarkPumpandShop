ALTER TABLE `ops_invoices` ADD `submitted_by_membership_id` text;--> statement-breakpoint
ALTER TABLE `ops_warranty_coverage_lines` ADD `start_date` text;--> statement-breakpoint
ALTER TABLE `ops_warranty_coverage_lines` ADD `end_date` text;--> statement-breakpoint
ALTER TABLE `ops_warranty_rules` ADD `quote_id` text;--> statement-breakpoint
ALTER TABLE `ops_warranty_rules` ADD `authorization_id` text;