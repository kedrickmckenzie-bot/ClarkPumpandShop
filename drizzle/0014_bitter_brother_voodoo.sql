CREATE TABLE `ops_component_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`equipment_template_id` text NOT NULL,
	`parent_component_template_id` text,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_component_templates_org_equipment_parent_name` ON `ops_component_templates` (`organization_id`,`equipment_template_id`,`parent_component_template_id`,`name`);--> statement-breakpoint
CREATE INDEX `idx_ops_component_templates_org_equipment_sort` ON `ops_component_templates` (`organization_id`,`equipment_template_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `ops_equipment_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`taxonomy_node_id` text NOT NULL,
	`name` text NOT NULL,
	`default_expected_life_years` integer,
	`active` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_ops_equipment_templates_org_group_name` ON `ops_equipment_templates` (`organization_id`,`taxonomy_node_id`,`name`);--> statement-breakpoint
CREATE INDEX `idx_ops_equipment_templates_org_group_active` ON `ops_equipment_templates` (`organization_id`,`taxonomy_node_id`,`active`);