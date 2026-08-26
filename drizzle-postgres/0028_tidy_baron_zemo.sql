CREATE TABLE "ops_vendor_reminders" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"vendor_id" text NOT NULL,
	"title" text NOT NULL,
	"note" text,
	"accountable_party" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"escalation_to" text NOT NULL,
	"status" text NOT NULL,
	"created_by_actor_type" text NOT NULL,
	"created_by_actor_id" text,
	"created_by_actor_name" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"completed_by_actor_type" text,
	"completed_by_actor_id" text,
	"completed_by_actor_name" text,
	"completed_at" timestamp with time zone,
	"completion_note" text,
	CONSTRAINT "uq_ops_vendor_reminders_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "chk_ops_vendor_reminders_status" CHECK ("ops_vendor_reminders"."status" IN ('open', 'completed', 'cancelled')),
	CONSTRAINT "chk_ops_vendor_reminders_completion" CHECK (("ops_vendor_reminders"."status" = 'completed') = ("ops_vendor_reminders"."completed_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "ops_vendor_reminders" ADD CONSTRAINT "fk_ops_vendor_reminders_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_vendor_reminders" ADD CONSTRAINT "fk_ops_vendor_reminders_vendor" FOREIGN KEY ("organization_id","vendor_id") REFERENCES "public"."ops_vendors"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ops_vendor_reminders_org_vendor_status_due" ON "ops_vendor_reminders" USING btree ("organization_id","vendor_id","status","due_at");--> statement-breakpoint
CREATE INDEX "idx_ops_vendor_reminders_org_status_due" ON "ops_vendor_reminders" USING btree ("organization_id","status","due_at");