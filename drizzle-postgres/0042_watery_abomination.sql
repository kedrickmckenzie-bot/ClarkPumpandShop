CREATE TABLE "ops_accounting_invoice_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"connection_key" text NOT NULL,
	"company_key" text NOT NULL,
	"external_invoice_id" text NOT NULL,
	"source_revision" integer NOT NULL,
	"version" integer NOT NULL,
	"payload_json" text NOT NULL,
	"invoice_id" text,
	"match_state" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_accounting_source_identity" ON "ops_accounting_invoice_sources" USING btree ("organization_id","connection_key","company_key","external_invoice_id");--> statement-breakpoint
CREATE INDEX "idx_ops_accounting_source_updated" ON "ops_accounting_invoice_sources" USING btree ("organization_id","updated_at","id");