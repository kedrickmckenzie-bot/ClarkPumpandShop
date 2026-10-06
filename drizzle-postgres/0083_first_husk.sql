CREATE TABLE "ops_overview_seen_marks" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"membership_id" text NOT NULL,
	"seen_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ops_overview_seen_marks" ADD CONSTRAINT "ops_overview_seen_marks_organization_id_ops_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_overview_seen_marks" ADD CONSTRAINT "ops_overview_seen_marks_organization_id_membership_id_ops_memberships_organization_id_id_fk" FOREIGN KEY ("organization_id","membership_id") REFERENCES "public"."ops_memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ops_overview_seen_marks_person" ON "ops_overview_seen_marks" USING btree ("organization_id","membership_id","seen_at");