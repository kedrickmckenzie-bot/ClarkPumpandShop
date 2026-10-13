CREATE TABLE "ops_ust_operators" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"store_id" text NOT NULL,
	"operator_class" text NOT NULL,
	"name" text NOT NULL,
	"certificate_number" text,
	"trained_on" text,
	"expires_on" text,
	"recorded_by_name" text NOT NULL,
	"created_at" text NOT NULL,
	"removed_at" text,
	"removed_by_name" text,
	CONSTRAINT "chk_ops_ust_operators_class" CHECK ("ops_ust_operators"."operator_class" IN ('A','B','C'))
);
--> statement-breakpoint
ALTER TABLE "ops_compliance_schedules" ADD COLUMN "program" text;--> statement-breakpoint
ALTER TABLE "ops_ust_operators" ADD CONSTRAINT "ops_ust_operators_organization_id_ops_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_ust_operators" ADD CONSTRAINT "ops_ust_operators_organization_id_store_id_ops_stores_organization_id_id_fk" FOREIGN KEY ("organization_id","store_id") REFERENCES "public"."ops_stores"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ops_ust_operators_store" ON "ops_ust_operators" USING btree ("organization_id","store_id","operator_class");