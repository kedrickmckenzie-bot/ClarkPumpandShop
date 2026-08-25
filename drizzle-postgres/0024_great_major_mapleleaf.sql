CREATE TABLE "ops_saved_views" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"owner_membership_id" text NOT NULL,
	"surface" text NOT NULL,
	"name" text NOT NULL,
	"query_json" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_ops_saved_views_org_id" UNIQUE("organization_id","id")
);
--> statement-breakpoint
ALTER TABLE "ops_saved_views" ADD CONSTRAINT "fk_ops_saved_views_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_saved_views_org_owner_surface_name" ON "ops_saved_views" USING btree ("organization_id","owner_membership_id","surface","name");--> statement-breakpoint
CREATE INDEX "idx_ops_saved_views_org_owner_surface" ON "ops_saved_views" USING btree ("organization_id","owner_membership_id","surface");