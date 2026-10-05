CREATE TABLE "ops_equipment_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"file_id" text NOT NULL,
	"title" text NOT NULL,
	"doc_type" text NOT NULL,
	"manufacturer_key" text,
	"model_key" text,
	"asset_id" text,
	"uploaded_by_membership_id" text,
	"uploaded_by_name" text NOT NULL,
	"created_at" text NOT NULL,
	"removed_at" text,
	"removed_by_name" text,
	CONSTRAINT "chk_ops_equipment_documents" CHECK ("ops_equipment_documents"."doc_type" IN ('manual','wiring_diagram','parts_list','spec_sheet','other') AND ("ops_equipment_documents"."asset_id" IS NOT NULL OR "ops_equipment_documents"."model_key" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "ops_equipment_documents" ADD CONSTRAINT "ops_equipment_documents_organization_id_ops_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_equipment_documents" ADD CONSTRAINT "ops_equipment_documents_organization_id_file_id_ops_files_organization_id_id_fk" FOREIGN KEY ("organization_id","file_id") REFERENCES "public"."ops_files"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_equipment_documents" ADD CONSTRAINT "ops_equipment_documents_organization_id_asset_id_ops_assets_organization_id_id_fk" FOREIGN KEY ("organization_id","asset_id") REFERENCES "public"."ops_assets"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ops_equipment_documents_model" ON "ops_equipment_documents" USING btree ("organization_id","model_key","manufacturer_key");--> statement-breakpoint
CREATE INDEX "idx_ops_equipment_documents_asset" ON "ops_equipment_documents" USING btree ("organization_id","asset_id");