CREATE TABLE "ops_capital_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"asset_id" text NOT NULL,
	"store_id" text NOT NULL,
	"version" integer NOT NULL,
	"target_month" text,
	"amount_minor" integer,
	"currency" text NOT NULL,
	"cost_basis" text NOT NULL,
	"source_id" text,
	"priority" text NOT NULL,
	"owner" text NOT NULL,
	"reason" text NOT NULL,
	"status" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ops_capital_plans" ADD CONSTRAINT "fk_ops_capital_plans_asset" FOREIGN KEY ("organization_id","asset_id") REFERENCES "public"."ops_assets"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_capital_plans" ADD CONSTRAINT "fk_ops_capital_plans_store" FOREIGN KEY ("organization_id","store_id") REFERENCES "public"."ops_stores"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_capital_plans_version" ON "ops_capital_plans" USING btree ("organization_id","asset_id","version");--> statement-breakpoint
CREATE INDEX "idx_ops_capital_plans_store_month" ON "ops_capital_plans" USING btree ("organization_id","store_id","target_month");