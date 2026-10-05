CREATE TABLE "ops_equipment_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"work_order_id" text NOT NULL,
	"conversation_id" text NOT NULL,
	"note_json" text NOT NULL,
	"provider" text,
	"model" text,
	"created_by_membership_id" text,
	"created_by_name" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ops_equipment_notes" ADD CONSTRAINT "ops_equipment_notes_organization_id_ops_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_equipment_notes" ADD CONSTRAINT "ops_equipment_notes_organization_id_work_order_id_ops_work_orders_organization_id_id_fk" FOREIGN KEY ("organization_id","work_order_id") REFERENCES "public"."ops_work_orders"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_equipment_notes" ADD CONSTRAINT "ops_equipment_notes_conversation_id_ops_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ops_ai_conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ops_equipment_notes_work" ON "ops_equipment_notes" USING btree ("organization_id","work_order_id","created_at");