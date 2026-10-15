CREATE TABLE "ops_work_order_callbacks" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"work_order_id" text NOT NULL,
	"original_work_order_id" text NOT NULL,
	"source" text NOT NULL,
	"status" text NOT NULL,
	"created_at" text NOT NULL,
	"created_by_name" text NOT NULL,
	"created_by_actor_id" text,
	"resolved_at" text,
	"resolved_by_name" text,
	"reason" text,
	CONSTRAINT "chk_ops_work_order_callbacks_source" CHECK ("ops_work_order_callbacks"."source" IN ('sent','linked','suggested')),
	CONSTRAINT "chk_ops_work_order_callbacks_status" CHECK ("ops_work_order_callbacks"."status" IN ('open','no_charge','new_work','not_callback')),
	CONSTRAINT "chk_ops_work_order_callbacks_self" CHECK ("ops_work_order_callbacks"."work_order_id" <> "ops_work_order_callbacks"."original_work_order_id")
);
--> statement-breakpoint
ALTER TABLE "ops_work_order_callbacks" ADD CONSTRAINT "ops_work_order_callbacks_organization_id_ops_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_work_order_callbacks" ADD CONSTRAINT "fk_ops_work_order_callbacks_work" FOREIGN KEY ("organization_id","work_order_id") REFERENCES "public"."ops_work_orders"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_work_order_callbacks" ADD CONSTRAINT "fk_ops_work_order_callbacks_original" FOREIGN KEY ("organization_id","original_work_order_id") REFERENCES "public"."ops_work_orders"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_work_order_callbacks_work" ON "ops_work_order_callbacks" USING btree ("organization_id","work_order_id");--> statement-breakpoint
CREATE INDEX "idx_ops_work_order_callbacks_original" ON "ops_work_order_callbacks" USING btree ("organization_id","original_work_order_id");