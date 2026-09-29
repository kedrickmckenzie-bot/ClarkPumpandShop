CREATE TABLE "ops_store_task_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"task_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"actor_name" text NOT NULL,
	"kind" text NOT NULL,
	"body" text NOT NULL,
	"findings_json" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops_store_task_people" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"task_id" text NOT NULL,
	"membership_id" text NOT NULL,
	"seen_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops_store_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"store_id" text NOT NULL,
	"title" text NOT NULL,
	"instructions" text NOT NULL,
	"kind" text NOT NULL,
	"assignment" text NOT NULL,
	"assignee_id" text,
	"claimant_id" text,
	"requester_id" text NOT NULL,
	"fallback_id" text NOT NULL,
	"status" text NOT NULL,
	"priority" text NOT NULL,
	"due_at" text NOT NULL,
	"notify_requester" integer NOT NULL,
	"work_order_id" text,
	"invoice_id" text,
	"visit_id" text,
	"asset_id" text,
	"windows_json" text NOT NULL,
	"result" text,
	"version" integer NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "chk_ops_store_task_state" CHECK ("ops_store_tasks"."status" IN ('open','review','closed') AND "ops_store_tasks"."kind" IN ('general','camera','equipment') AND "ops_store_tasks"."priority" IN ('routine','urgent') AND "ops_store_tasks"."notify_requester" IN (0,1) AND "ops_store_tasks"."version" >= 1),
	CONSTRAINT "chk_ops_store_task_assignment" CHECK (("ops_store_tasks"."assignment" = 'person' AND "ops_store_tasks"."assignee_id" IS NOT NULL) OR ("ops_store_tasks"."assignment" IN ('responsible','local') AND "ops_store_tasks"."assignee_id" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ops_store_task_org_id" ON "ops_store_tasks" USING btree ("organization_id","id");--> statement-breakpoint
ALTER TABLE "ops_store_task_messages" ADD CONSTRAINT "ops_store_task_messages_organization_id_task_id_ops_store_tasks_organization_id_id_fk" FOREIGN KEY ("organization_id","task_id") REFERENCES "public"."ops_store_tasks"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_store_task_people" ADD CONSTRAINT "ops_store_task_people_organization_id_task_id_ops_store_tasks_organization_id_id_fk" FOREIGN KEY ("organization_id","task_id") REFERENCES "public"."ops_store_tasks"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_store_task_people" ADD CONSTRAINT "ops_store_task_people_organization_id_membership_id_ops_memberships_organization_id_id_fk" FOREIGN KEY ("organization_id","membership_id") REFERENCES "public"."ops_memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_store_tasks" ADD CONSTRAINT "ops_store_tasks_organization_id_store_id_ops_stores_organization_id_id_fk" FOREIGN KEY ("organization_id","store_id") REFERENCES "public"."ops_stores"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_store_tasks" ADD CONSTRAINT "ops_store_tasks_organization_id_work_order_id_ops_work_orders_organization_id_id_fk" FOREIGN KEY ("organization_id","work_order_id") REFERENCES "public"."ops_work_orders"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_store_tasks" ADD CONSTRAINT "ops_store_tasks_organization_id_invoice_id_ops_invoices_organization_id_id_fk" FOREIGN KEY ("organization_id","invoice_id") REFERENCES "public"."ops_invoices"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_store_tasks" ADD CONSTRAINT "ops_store_tasks_organization_id_visit_id_ops_visit_sessions_organization_id_id_fk" FOREIGN KEY ("organization_id","visit_id") REFERENCES "public"."ops_visit_sessions"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_store_tasks" ADD CONSTRAINT "ops_store_tasks_organization_id_asset_id_ops_assets_organization_id_id_fk" FOREIGN KEY ("organization_id","asset_id") REFERENCES "public"."ops_assets"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_store_tasks" ADD CONSTRAINT "ops_store_tasks_organization_id_requester_id_ops_memberships_organization_id_id_fk" FOREIGN KEY ("organization_id","requester_id") REFERENCES "public"."ops_memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_store_tasks" ADD CONSTRAINT "ops_store_tasks_organization_id_fallback_id_ops_memberships_organization_id_id_fk" FOREIGN KEY ("organization_id","fallback_id") REFERENCES "public"."ops_memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_store_tasks" ADD CONSTRAINT "ops_store_tasks_organization_id_assignee_id_ops_memberships_organization_id_id_fk" FOREIGN KEY ("organization_id","assignee_id") REFERENCES "public"."ops_memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_store_tasks" ADD CONSTRAINT "ops_store_tasks_organization_id_claimant_id_ops_memberships_organization_id_id_fk" FOREIGN KEY ("organization_id","claimant_id") REFERENCES "public"."ops_memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ops_task_messages" ON "ops_store_task_messages" USING btree ("organization_id","task_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ops_task_person" ON "ops_store_task_people" USING btree ("organization_id","task_id","membership_id");--> statement-breakpoint
CREATE INDEX "idx_ops_store_task_queue" ON "ops_store_tasks" USING btree ("organization_id","store_id","status","due_at","id");--> statement-breakpoint
CREATE INDEX "idx_ops_store_task_requester" ON "ops_store_tasks" USING btree ("organization_id","requester_id","status","updated_at","id");