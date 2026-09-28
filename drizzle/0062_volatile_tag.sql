CREATE UNIQUE INDEX `uidx_ops_files_org_id` ON `ops_files` (`organization_id`,`id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_invoice_records_org_id` ON `ops_invoices` (`organization_id`,`id`);
--> statement-breakpoint
CREATE TABLE `ops_invoice_uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`file_id` text NOT NULL,
	`sha256` text NOT NULL,
	`filename` text NOT NULL,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`extracted_json` text,
	`issues_json` text NOT NULL,
	`invoice_id` text,
	`uploaded_by_membership_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`,`file_id`) REFERENCES `ops_files`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`invoice_id`) REFERENCES `ops_invoices`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_ops_invoice_upload_status" CHECK("ops_invoice_uploads"."status" IN ('queued','review','recorded','dismissed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ops_invoice_upload_org_hash` ON `ops_invoice_uploads` (`organization_id`,`sha256`);--> statement-breakpoint
CREATE INDEX `idx_ops_invoice_upload_queue` ON `ops_invoice_uploads` (`organization_id`,`status`,`created_at`,`id`);