CREATE TABLE "ops_technician_statuses" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"membership_id" text NOT NULL,
	"revision" integer NOT NULL,
	"status" text NOT NULL,
	"work_order_id" text,
	"store_id" text NOT NULL,
	"recorded_at" text NOT NULL,
	CONSTRAINT "chk_ops_technician_status" CHECK ("ops_technician_statuses"."revision" > 0 AND "ops_technician_statuses"."status" IN ('heading','parts','break','done') AND ("ops_technician_statuses"."status" != 'heading' OR "ops_technician_statuses"."work_order_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "ops_technician_statuses" ADD CONSTRAINT "ops_technician_statuses_organization_id_membership_id_ops_memberships_organization_id_id_fk" FOREIGN KEY ("organization_id","membership_id") REFERENCES "public"."ops_memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_technician_statuses" ADD CONSTRAINT "ops_technician_statuses_organization_id_store_id_ops_stores_organization_id_id_fk" FOREIGN KEY ("organization_id","store_id") REFERENCES "public"."ops_stores"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_technician_statuses" ADD CONSTRAINT "ops_technician_statuses_organization_id_work_order_id_ops_work_orders_organization_id_id_fk" FOREIGN KEY ("organization_id","work_order_id") REFERENCES "public"."ops_work_orders"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ops_technician_status_revision" ON "ops_technician_statuses" USING btree ("organization_id","membership_id","revision");