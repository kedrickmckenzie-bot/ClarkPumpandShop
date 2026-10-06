CREATE TABLE "ops_equipment_document_pages" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"document_id" text NOT NULL,
	"page_number" integer NOT NULL,
	"page_label" text NOT NULL,
	"text" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ops_equipment_document_pages" ADD CONSTRAINT "ops_equipment_document_pages_organization_id_ops_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_equipment_document_pages" ADD CONSTRAINT "ops_equipment_document_pages_document_id_ops_equipment_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."ops_equipment_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ops_equipment_document_pages" ON "ops_equipment_document_pages" USING btree ("organization_id","document_id","page_number");