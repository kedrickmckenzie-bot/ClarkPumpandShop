CREATE TABLE "ops_spend_totals" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"period_start" text NOT NULL,
	"period_end" text NOT NULL,
	"kind" text NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" text NOT NULL,
	"note" text,
	"entered_by_name" text NOT NULL,
	"entered_by_actor_id" text,
	"created_at" text NOT NULL,
	"withdrawn_at" text,
	"withdrawn_by_name" text,
	"withdrawn_reason" text,
	CONSTRAINT "chk_ops_spend_totals_kind" CHECK ("ops_spend_totals"."kind" IN ('total','in_house')),
	CONSTRAINT "chk_ops_spend_totals_amount" CHECK ("ops_spend_totals"."amount_minor" >= 0),
	CONSTRAINT "chk_ops_spend_totals_range" CHECK ("ops_spend_totals"."period_end" >= "ops_spend_totals"."period_start")
);
--> statement-breakpoint
ALTER TABLE "ops_spend_totals" ADD CONSTRAINT "ops_spend_totals_organization_id_ops_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ops_spend_totals_period" ON "ops_spend_totals" USING btree ("organization_id","period_start","period_end");