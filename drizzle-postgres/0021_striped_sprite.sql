CREATE TABLE "ops_component_lifecycle_events" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"asset_id" text NOT NULL,
	"removed_component_id" text NOT NULL,
	"installed_component_id" text NOT NULL,
	"repair_item_id" text NOT NULL,
	"work_order_id" text NOT NULL,
	"vendor_id" text NOT NULL,
	"part_manufacturer" text NOT NULL,
	"part_model" text NOT NULL,
	"serial_number" text,
	"removed_at" timestamp with time zone NOT NULL,
	"installed_at" timestamp with time zone NOT NULL,
	"failure_mode" text NOT NULL,
	"root_cause" text,
	"labor_cost_minor" bigint NOT NULL,
	"part_cost_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"replacement_kind" text NOT NULL,
	"expected_life_months" integer,
	"warranty_ends_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_ops_component_lifecycle_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "uq_ops_component_lifecycle_org_removed" UNIQUE("organization_id","removed_component_id"),
	CONSTRAINT "uq_ops_component_lifecycle_org_repair" UNIQUE("organization_id","repair_item_id"),
	CONSTRAINT "chk_ops_component_lifecycle_costs" CHECK ("ops_component_lifecycle_events"."labor_cost_minor" >= 0 AND "ops_component_lifecycle_events"."part_cost_minor" >= 0),
	CONSTRAINT "chk_ops_component_lifecycle_kind" CHECK ("ops_component_lifecycle_events"."replacement_kind" IN ('planned', 'reactive')),
	CONSTRAINT "chk_ops_component_lifecycle_life" CHECK ("ops_component_lifecycle_events"."expected_life_months" IS NULL OR "ops_component_lifecycle_events"."expected_life_months" > 0),
	CONSTRAINT "chk_ops_component_lifecycle_dates" CHECK ("ops_component_lifecycle_events"."installed_at" >= "ops_component_lifecycle_events"."removed_at")
);
--> statement-breakpoint
ALTER TABLE "ops_asset_components" ADD COLUMN "removed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ops_asset_components" ADD COLUMN "replaced_by_component_id" text;--> statement-breakpoint
ALTER TABLE "ops_component_lifecycle_events" ADD CONSTRAINT "fk_ops_component_lifecycle_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_component_lifecycle_events" ADD CONSTRAINT "fk_ops_component_lifecycle_asset" FOREIGN KEY ("organization_id","asset_id") REFERENCES "public"."ops_assets"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_component_lifecycle_events" ADD CONSTRAINT "fk_ops_component_lifecycle_removed" FOREIGN KEY ("organization_id","removed_component_id") REFERENCES "public"."ops_asset_components"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_component_lifecycle_events" ADD CONSTRAINT "fk_ops_component_lifecycle_installed" FOREIGN KEY ("organization_id","installed_component_id") REFERENCES "public"."ops_asset_components"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_component_lifecycle_events" ADD CONSTRAINT "fk_ops_component_lifecycle_repair" FOREIGN KEY ("organization_id","repair_item_id") REFERENCES "public"."ops_repair_items"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_component_lifecycle_events" ADD CONSTRAINT "fk_ops_component_lifecycle_work" FOREIGN KEY ("organization_id","work_order_id") REFERENCES "public"."ops_work_orders"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_component_lifecycle_events" ADD CONSTRAINT "fk_ops_component_lifecycle_vendor" FOREIGN KEY ("organization_id","vendor_id") REFERENCES "public"."ops_vendors"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ops_component_lifecycle_org_model_removed" ON "ops_component_lifecycle_events" USING btree ("organization_id","part_manufacturer","part_model","removed_at");--> statement-breakpoint
CREATE INDEX "idx_ops_component_lifecycle_org_vendor_removed" ON "ops_component_lifecycle_events" USING btree ("organization_id","vendor_id","removed_at");--> statement-breakpoint
ALTER TABLE "ops_asset_components" ADD CONSTRAINT "fk_ops_components_replacement" FOREIGN KEY ("organization_id","replaced_by_component_id") REFERENCES "public"."ops_asset_components"("organization_id","id") ON DELETE no action ON UPDATE no action;