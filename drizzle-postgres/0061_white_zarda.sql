CREATE TABLE "ops_invoice_uploads" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"file_id" text NOT NULL,
	"sha256" text NOT NULL,
	"filename" text NOT NULL,
	"status" text NOT NULL,
	"version" integer NOT NULL,
	"extracted_json" text,
	"issues_json" text NOT NULL,
	"invoice_id" text,
	"uploaded_by_membership_id" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "chk_ops_invoice_upload_status" CHECK ("ops_invoice_uploads"."status" IN ('queued','review','recorded','dismissed'))
);
--> statement-breakpoint
ALTER TABLE "ops_invoice_uploads" ADD CONSTRAINT "ops_invoice_uploads_organization_id_file_id_ops_files_organization_id_id_fk" FOREIGN KEY ("organization_id","file_id") REFERENCES "public"."ops_files"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_invoice_uploads" ADD CONSTRAINT "ops_invoice_uploads_organization_id_invoice_id_ops_invoices_organization_id_id_fk" FOREIGN KEY ("organization_id","invoice_id") REFERENCES "public"."ops_invoices"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ops_invoice_upload_org_hash" ON "ops_invoice_uploads" USING btree ("organization_id","sha256");--> statement-breakpoint
CREATE INDEX "idx_ops_invoice_upload_queue" ON "ops_invoice_uploads" USING btree ("organization_id","status","created_at","id");