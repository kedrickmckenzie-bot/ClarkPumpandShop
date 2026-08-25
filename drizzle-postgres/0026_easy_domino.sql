CREATE TABLE "ops_service_appointments" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"work_order_id" text NOT NULL,
	"assignment_id" text NOT NULL,
	"issuance_id" text,
	"source_vendor_response_id" text,
	"status" text NOT NULL,
	"proposed_by" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"note" text,
	"created_by_membership_id" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ops_service_appointments" ADD CONSTRAINT "fk_ops_service_appointments_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ops_service_appointments_org_work" ON "ops_service_appointments" USING btree ("organization_id","work_order_id","starts_at");