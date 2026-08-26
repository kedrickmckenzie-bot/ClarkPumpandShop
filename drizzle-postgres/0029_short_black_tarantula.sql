ALTER TABLE "ops_assets" ADD COLUMN "equipment_template_id" text;--> statement-breakpoint
ALTER TABLE "ops_maintenance_programs" ADD COLUMN "schedule_anchor_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ops_pm_plans" ADD COLUMN "cadence_override_reason" text;--> statement-breakpoint
ALTER TABLE "ops_pm_plans" ADD COLUMN "cadence_overridden_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ops_pm_plans" ADD COLUMN "cadence_overridden_by_membership_id" text;--> statement-breakpoint
ALTER TABLE "ops_assets" ADD CONSTRAINT "fk_ops_assets_equipment_template" FOREIGN KEY ("organization_id","equipment_template_id") REFERENCES "public"."ops_equipment_templates"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ops_assets_org_equipment_template" ON "ops_assets" USING btree ("organization_id","equipment_template_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_pm_plans_org_program_asset" ON "ops_pm_plans" USING btree ("organization_id","program_id","asset_id");