CREATE TABLE "ops_lifecycle_recommendations" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"asset_id" text NOT NULL,
	"work_order_id" text,
	"version" integer NOT NULL,
	"model_version" text NOT NULL,
	"recommendation" text NOT NULL,
	"confidence" text NOT NULL,
	"inputs_json" jsonb NOT NULL,
	"explanation" text NOT NULL,
	"missing_data_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"user_decision" text NOT NULL,
	"user_reason" text NOT NULL,
	"decided_by_membership_id" text NOT NULL,
	"decided_at" timestamp with time zone NOT NULL,
	"actual_outcome" text,
	"actual_outcome_at" timestamp with time zone,
	"replacement_event_id" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_ops_lifecycle_recommendations_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "chk_ops_lifecycle_recommendations_version" CHECK ("ops_lifecycle_recommendations"."version" > 0),
	CONSTRAINT "chk_ops_lifecycle_recommendations_recommendation" CHECK ("ops_lifecycle_recommendations"."recommendation" IN ('repair', 'replace', 'capital_review')),
	CONSTRAINT "chk_ops_lifecycle_recommendations_confidence" CHECK ("ops_lifecycle_recommendations"."confidence" IN ('low', 'medium', 'high')),
	CONSTRAINT "chk_ops_lifecycle_recommendations_decision" CHECK ("ops_lifecycle_recommendations"."user_decision" IN ('repair', 'replace', 'defer', 'investigate')),
	CONSTRAINT "chk_ops_lifecycle_recommendations_outcome" CHECK ("ops_lifecycle_recommendations"."actual_outcome" IS NULL OR "ops_lifecycle_recommendations"."actual_outcome" IN ('repaired', 'replaced', 'retired_without_replacement', 'still_in_service'))
);
--> statement-breakpoint
ALTER TABLE "ops_lifecycle_recommendations" ADD CONSTRAINT "fk_ops_lifecycle_recommendations_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_lifecycle_recommendations" ADD CONSTRAINT "fk_ops_lifecycle_recommendations_asset" FOREIGN KEY ("organization_id","asset_id") REFERENCES "public"."ops_assets"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_lifecycle_recommendations" ADD CONSTRAINT "fk_ops_lifecycle_recommendations_work" FOREIGN KEY ("organization_id","work_order_id") REFERENCES "public"."ops_work_orders"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_lifecycle_recommendations" ADD CONSTRAINT "fk_ops_lifecycle_recommendations_membership" FOREIGN KEY ("organization_id","decided_by_membership_id") REFERENCES "public"."ops_memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_lifecycle_recommendations" ADD CONSTRAINT "fk_ops_lifecycle_recommendations_event" FOREIGN KEY ("organization_id","replacement_event_id") REFERENCES "public"."ops_replacement_events"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_lifecycle_recommendations_org_asset_version" ON "ops_lifecycle_recommendations" USING btree ("organization_id","asset_id","version");--> statement-breakpoint
CREATE INDEX "idx_ops_lifecycle_recommendations_org_asset_created" ON "ops_lifecycle_recommendations" USING btree ("organization_id","asset_id","created_at");