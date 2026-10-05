CREATE TABLE "ops_route_legs" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"from_lat_e6" integer NOT NULL,
	"from_lng_e6" integer NOT NULL,
	"to_lat_e6" integer NOT NULL,
	"to_lng_e6" integer NOT NULL,
	"distance_m" integer NOT NULL,
	"duration_s" integer NOT NULL,
	"geometry" text NOT NULL,
	"provider" text NOT NULL,
	"fetched_at" text NOT NULL,
	CONSTRAINT "chk_ops_route_legs" CHECK ("ops_route_legs"."distance_m" >= 0 AND "ops_route_legs"."duration_s" >= 0)
);
--> statement-breakpoint
ALTER TABLE "ops_route_legs" ADD CONSTRAINT "ops_route_legs_organization_id_ops_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ops_route_legs_points" ON "ops_route_legs" USING btree ("organization_id","from_lat_e6","from_lng_e6","to_lat_e6","to_lng_e6");