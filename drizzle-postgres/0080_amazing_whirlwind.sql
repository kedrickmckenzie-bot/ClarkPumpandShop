CREATE TABLE "ops_ai_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"work_order_id" text NOT NULL,
	"kind" text NOT NULL,
	"messages_json" text NOT NULL,
	"summary" text,
	"provider" text,
	"model" text,
	"created_by_membership_id" text,
	"created_by_name" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "chk_ops_ai_conversations" CHECK ("ops_ai_conversations"."kind" IN ('checkout','diagnostic'))
);
--> statement-breakpoint
ALTER TABLE "ops_ai_conversations" ADD CONSTRAINT "ops_ai_conversations_organization_id_ops_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_ai_conversations" ADD CONSTRAINT "ops_ai_conversations_organization_id_work_order_id_ops_work_orders_organization_id_id_fk" FOREIGN KEY ("organization_id","work_order_id") REFERENCES "public"."ops_work_orders"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ops_ai_conversations_work" ON "ops_ai_conversations" USING btree ("organization_id","work_order_id","created_at");