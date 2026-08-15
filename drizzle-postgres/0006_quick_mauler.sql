CREATE TABLE "ops_asset_replacement_overrides" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"asset_id" text NOT NULL,
	"source_benchmark_id" text,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"reason" text NOT NULL,
	"status" text NOT NULL,
	"superseded_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_ops_asset_replacement_overrides_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "chk_ops_asset_replacement_overrides_status" CHECK ("ops_asset_replacement_overrides"."status" IN ('active', 'superseded')),
	CONSTRAINT "chk_ops_asset_replacement_overrides_amount" CHECK ("ops_asset_replacement_overrides"."amount_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "ops_replacement_benchmarks" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"profile_id" text NOT NULL,
	"source_type" text NOT NULL,
	"source_work_order_id" text,
	"source_estimate_proposal_id" text,
	"source_asset_id" text,
	"source_vendor_id" text,
	"equipment_amount_minor" bigint NOT NULL,
	"installation_amount_minor" bigint NOT NULL,
	"other_amount_minor" bigint NOT NULL,
	"total_amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"superseded_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_ops_replacement_benchmarks_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "chk_ops_replacement_benchmarks_source" CHECK ("ops_replacement_benchmarks"."source_type" IN ('approved_quote', 'final_cost', 'manual', 'catalog')),
	CONSTRAINT "chk_ops_replacement_benchmarks_status" CHECK ("ops_replacement_benchmarks"."status" IN ('published', 'superseded')),
	CONSTRAINT "chk_ops_replacement_benchmarks_amounts" CHECK ("ops_replacement_benchmarks"."equipment_amount_minor" >= 0 AND "ops_replacement_benchmarks"."installation_amount_minor" >= 0 AND "ops_replacement_benchmarks"."other_amount_minor" >= 0 AND "ops_replacement_benchmarks"."total_amount_minor" = "ops_replacement_benchmarks"."equipment_amount_minor" + "ops_replacement_benchmarks"."installation_amount_minor" + "ops_replacement_benchmarks"."other_amount_minor")
);
--> statement-breakpoint
CREATE TABLE "ops_replacement_events" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"asset_id" text NOT NULL,
	"work_order_id" text NOT NULL,
	"profile_id" text NOT NULL,
	"source_estimate_proposal_id" text NOT NULL,
	"status" text NOT NULL,
	"approved_amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"approved_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"final_amount_minor" bigint,
	"replacement_asset_id" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_ops_replacement_events_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "chk_ops_replacement_events_status" CHECK ("ops_replacement_events"."status" IN ('approved', 'completed', 'cancelled')),
	CONSTRAINT "chk_ops_replacement_events_amounts" CHECK ("ops_replacement_events"."approved_amount_minor" > 0 AND ("ops_replacement_events"."final_amount_minor" IS NULL OR "ops_replacement_events"."final_amount_minor" > 0))
);
--> statement-breakpoint
CREATE TABLE "ops_replacement_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"category_key" text NOT NULL,
	"taxonomy_node_id" text,
	"match_keys_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"attributes_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expected_life_years" integer,
	"annual_escalation_bps" integer DEFAULT 300 NOT NULL,
	"low_variance_bps" integer DEFAULT 1000 NOT NULL,
	"high_variance_bps" integer DEFAULT 2000 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_ops_replacement_profiles_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "chk_ops_replacement_profiles_life" CHECK ("ops_replacement_profiles"."expected_life_years" IS NULL OR "ops_replacement_profiles"."expected_life_years" > 0),
	CONSTRAINT "chk_ops_replacement_profiles_escalation" CHECK ("ops_replacement_profiles"."annual_escalation_bps" BETWEEN -9000 AND 50000),
	CONSTRAINT "chk_ops_replacement_profiles_variance" CHECK ("ops_replacement_profiles"."low_variance_bps" BETWEEN 0 AND 10000 AND "ops_replacement_profiles"."high_variance_bps" BETWEEN 0 AND 50000)
);
--> statement-breakpoint
ALTER TABLE "ops_assets" ADD COLUMN "replacement_profile_id" text;--> statement-breakpoint
ALTER TABLE "ops_assets" ADD COLUMN "replacement_attributes_json" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "ops_assets" ADD COLUMN "replacement_adjustment_bps" integer;--> statement-breakpoint
ALTER TABLE "ops_assets" ADD COLUMN "retired_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ops_assets" ADD COLUMN "replaced_by_asset_id" text;--> statement-breakpoint
ALTER TABLE "ops_work_order_estimate_requests" ADD COLUMN "decision_kind" text DEFAULT 'service_bid' NOT NULL;--> statement-breakpoint
ALTER TABLE "ops_asset_replacement_overrides" ADD CONSTRAINT "fk_ops_asset_replacement_overrides_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_asset_replacement_overrides" ADD CONSTRAINT "fk_ops_asset_replacement_overrides_asset" FOREIGN KEY ("organization_id","asset_id") REFERENCES "public"."ops_assets"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_asset_replacement_overrides" ADD CONSTRAINT "fk_ops_asset_replacement_overrides_benchmark" FOREIGN KEY ("organization_id","source_benchmark_id") REFERENCES "public"."ops_replacement_benchmarks"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_replacement_benchmarks" ADD CONSTRAINT "fk_ops_replacement_benchmarks_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_replacement_benchmarks" ADD CONSTRAINT "fk_ops_replacement_benchmarks_profile" FOREIGN KEY ("organization_id","profile_id") REFERENCES "public"."ops_replacement_profiles"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_replacement_benchmarks" ADD CONSTRAINT "fk_ops_replacement_benchmarks_work" FOREIGN KEY ("organization_id","source_work_order_id") REFERENCES "public"."ops_work_orders"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_replacement_benchmarks" ADD CONSTRAINT "fk_ops_replacement_benchmarks_proposal" FOREIGN KEY ("organization_id","source_estimate_proposal_id") REFERENCES "public"."ops_vendor_estimate_proposals"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_replacement_benchmarks" ADD CONSTRAINT "fk_ops_replacement_benchmarks_asset" FOREIGN KEY ("organization_id","source_asset_id") REFERENCES "public"."ops_assets"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_replacement_benchmarks" ADD CONSTRAINT "fk_ops_replacement_benchmarks_vendor" FOREIGN KEY ("organization_id","source_vendor_id") REFERENCES "public"."ops_vendors"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_replacement_events" ADD CONSTRAINT "fk_ops_replacement_events_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_replacement_events" ADD CONSTRAINT "fk_ops_replacement_events_asset" FOREIGN KEY ("organization_id","asset_id") REFERENCES "public"."ops_assets"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_replacement_events" ADD CONSTRAINT "fk_ops_replacement_events_work" FOREIGN KEY ("organization_id","work_order_id") REFERENCES "public"."ops_work_orders"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_replacement_events" ADD CONSTRAINT "fk_ops_replacement_events_profile" FOREIGN KEY ("organization_id","profile_id") REFERENCES "public"."ops_replacement_profiles"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_replacement_events" ADD CONSTRAINT "fk_ops_replacement_events_proposal" FOREIGN KEY ("organization_id","source_estimate_proposal_id") REFERENCES "public"."ops_vendor_estimate_proposals"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_replacement_events" ADD CONSTRAINT "fk_ops_replacement_events_successor" FOREIGN KEY ("organization_id","replacement_asset_id") REFERENCES "public"."ops_assets"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_replacement_profiles" ADD CONSTRAINT "fk_ops_replacement_profiles_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_replacement_profiles" ADD CONSTRAINT "fk_ops_replacement_profiles_taxonomy" FOREIGN KEY ("organization_id","taxonomy_node_id") REFERENCES "public"."ops_taxonomy_nodes"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ops_asset_replacement_overrides_org_asset_status_effective" ON "ops_asset_replacement_overrides" USING btree ("organization_id","asset_id","status","effective_at");--> statement-breakpoint
CREATE INDEX "idx_ops_replacement_benchmarks_org_profile_status_effective" ON "ops_replacement_benchmarks" USING btree ("organization_id","profile_id","status","effective_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_replacement_benchmarks_org_source_proposal" ON "ops_replacement_benchmarks" USING btree ("organization_id","source_estimate_proposal_id");--> statement-breakpoint
CREATE INDEX "idx_ops_replacement_events_org_asset_status" ON "ops_replacement_events" USING btree ("organization_id","asset_id","status");--> statement-breakpoint
CREATE INDEX "idx_ops_replacement_events_org_work" ON "ops_replacement_events" USING btree ("organization_id","work_order_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_replacement_events_org_proposal" ON "ops_replacement_events" USING btree ("organization_id","source_estimate_proposal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_replacement_profiles_org_code" ON "ops_replacement_profiles" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "idx_ops_replacement_profiles_org_category_active" ON "ops_replacement_profiles" USING btree ("organization_id","category_key","active");--> statement-breakpoint
ALTER TABLE "ops_assets" ADD CONSTRAINT "fk_ops_assets_replacement_profile" FOREIGN KEY ("organization_id","replacement_profile_id") REFERENCES "public"."ops_replacement_profiles"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_assets" ADD CONSTRAINT "fk_ops_assets_successor" FOREIGN KEY ("organization_id","replaced_by_asset_id") REFERENCES "public"."ops_assets"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ops_assets_org_replacement_profile" ON "ops_assets" USING btree ("organization_id","replacement_profile_id","status");--> statement-breakpoint
ALTER TABLE "ops_assets" ADD CONSTRAINT "chk_ops_assets_replacement_adjustment" CHECK ("ops_assets"."replacement_adjustment_bps" IS NULL OR "ops_assets"."replacement_adjustment_bps" BETWEEN -9000 AND 50000);--> statement-breakpoint
ALTER TABLE "ops_work_order_estimate_requests" ADD CONSTRAINT "chk_ops_estimate_requests_decision_kind" CHECK ("ops_work_order_estimate_requests"."decision_kind" IN ('service_bid', 'replacement_quote'));