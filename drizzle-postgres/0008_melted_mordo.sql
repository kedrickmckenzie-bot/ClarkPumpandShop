CREATE TABLE "ops_component_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"equipment_template_id" text NOT NULL,
	"parent_component_template_id" text,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_ops_component_templates_org_id" UNIQUE("organization_id","id")
);
--> statement-breakpoint
CREATE TABLE "ops_equipment_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"taxonomy_node_id" text NOT NULL,
	"name" text NOT NULL,
	"default_expected_life_years" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_ops_equipment_templates_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "chk_ops_equipment_templates_life" CHECK ("ops_equipment_templates"."default_expected_life_years" IS NULL OR "ops_equipment_templates"."default_expected_life_years" > 0)
);
--> statement-breakpoint
ALTER TABLE "ops_component_templates" ADD CONSTRAINT "fk_ops_component_templates_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_component_templates" ADD CONSTRAINT "fk_ops_component_templates_equipment" FOREIGN KEY ("organization_id","equipment_template_id") REFERENCES "public"."ops_equipment_templates"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_component_templates" ADD CONSTRAINT "fk_ops_component_templates_parent" FOREIGN KEY ("organization_id","parent_component_template_id") REFERENCES "public"."ops_component_templates"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_equipment_templates" ADD CONSTRAINT "fk_ops_equipment_templates_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_equipment_templates" ADD CONSTRAINT "fk_ops_equipment_templates_taxonomy" FOREIGN KEY ("organization_id","taxonomy_node_id") REFERENCES "public"."ops_taxonomy_nodes"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_component_templates_org_equipment_parent_name" ON "ops_component_templates" USING btree ("organization_id","equipment_template_id","parent_component_template_id","name");--> statement-breakpoint
CREATE INDEX "idx_ops_component_templates_org_equipment_sort" ON "ops_component_templates" USING btree ("organization_id","equipment_template_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_equipment_templates_org_group_name" ON "ops_equipment_templates" USING btree ("organization_id","taxonomy_node_id","name");--> statement-breakpoint
CREATE INDEX "idx_ops_equipment_templates_org_group_active" ON "ops_equipment_templates" USING btree ("organization_id","taxonomy_node_id","active");