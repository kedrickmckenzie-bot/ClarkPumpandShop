CREATE TABLE "ops_technician_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"membership_id" text NOT NULL,
	"home_region_id" text,
	"skills_json" text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ops_technician_profiles" ADD CONSTRAINT "ops_technician_profiles_organization_id_membership_id_ops_memberships_organization_id_id_fk" FOREIGN KEY ("organization_id","membership_id") REFERENCES "public"."ops_memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_technician_profiles" ADD CONSTRAINT "ops_technician_profiles_organization_id_home_region_id_ops_regions_organization_id_id_fk" FOREIGN KEY ("organization_id","home_region_id") REFERENCES "public"."ops_regions"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ops_technician_profiles_member" ON "ops_technician_profiles" USING btree ("organization_id","membership_id");