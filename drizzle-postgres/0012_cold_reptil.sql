CREATE TABLE "ops_site_visit_work_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"visit_id" text NOT NULL,
	"work_order_id" text NOT NULL,
	"ordinal" integer NOT NULL,
	"linked_by_actor_type" text NOT NULL,
	"linked_by_actor_id" text,
	"linked_by_actor_name" text NOT NULL,
	"linked_at" timestamp with time zone NOT NULL,
	"outcome" text,
	"outcome_notes" text,
	"outcome_recorded_by_actor_type" text,
	"outcome_recorded_by_actor_id" text,
	"outcome_recorded_by_actor_name" text,
	"outcome_recorded_at" timestamp with time zone,
	"follow_up_id" text,
	CONSTRAINT "uq_ops_site_visit_work_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "uq_ops_site_visit_work_org_id_work" UNIQUE("organization_id","id","work_order_id"),
	CONSTRAINT "uq_ops_site_visit_work_org_visit_work" UNIQUE("organization_id","visit_id","work_order_id"),
	CONSTRAINT "uq_ops_site_visit_work_org_visit_ordinal" UNIQUE("organization_id","visit_id","ordinal"),
	CONSTRAINT "chk_ops_site_visit_work_ordinal" CHECK ("ops_site_visit_work_orders"."ordinal" > 0),
	CONSTRAINT "chk_ops_site_visit_work_link_actor" CHECK ("ops_site_visit_work_orders"."linked_by_actor_type" IN ('user', 'vendor_link', 'technician', 'store_device', 'system', 'support') AND length(btrim("ops_site_visit_work_orders"."linked_by_actor_name")) > 0),
	CONSTRAINT "chk_ops_site_visit_work_outcome" CHECK ("ops_site_visit_work_orders"."outcome" IS NULL OR "ops_site_visit_work_orders"."outcome" IN ('completed', 'diagnosis_only', 'quote_required', 'parts_required', 'return_visit_required', 'no_issue_found', 'store_access_unavailable', 'work_not_authorized', 'not_addressed')),
	CONSTRAINT "chk_ops_site_visit_work_outcome_actor" CHECK ("ops_site_visit_work_orders"."outcome_recorded_by_actor_type" IS NULL OR "ops_site_visit_work_orders"."outcome_recorded_by_actor_type" IN ('user', 'vendor_link', 'technician', 'store_device', 'system', 'support')),
	CONSTRAINT "chk_ops_site_visit_work_outcome_state" CHECK (("ops_site_visit_work_orders"."outcome" IS NULL AND "ops_site_visit_work_orders"."outcome_notes" IS NULL AND "ops_site_visit_work_orders"."outcome_recorded_by_actor_type" IS NULL AND "ops_site_visit_work_orders"."outcome_recorded_by_actor_id" IS NULL AND "ops_site_visit_work_orders"."outcome_recorded_by_actor_name" IS NULL AND "ops_site_visit_work_orders"."outcome_recorded_at" IS NULL AND "ops_site_visit_work_orders"."follow_up_id" IS NULL) OR ("ops_site_visit_work_orders"."outcome" IS NOT NULL AND "ops_site_visit_work_orders"."outcome_recorded_by_actor_type" IS NOT NULL AND length(btrim("ops_site_visit_work_orders"."outcome_recorded_by_actor_name")) > 0 AND "ops_site_visit_work_orders"."outcome_recorded_at" IS NOT NULL)),
	CONSTRAINT "chk_ops_site_visit_work_followup_outcome" CHECK ("ops_site_visit_work_orders"."follow_up_id" IS NULL OR "ops_site_visit_work_orders"."outcome" NOT IN ('completed', 'no_issue_found'))
);
--> statement-breakpoint
ALTER TABLE "ops_visit_sessions" DROP CONSTRAINT "chk_ops_visits_work_or_reason";--> statement-breakpoint
ALTER TABLE "ops_visit_sessions" ADD COLUMN "technician_phone_or_pin" text;--> statement-breakpoint
ALTER TABLE "ops_visit_sessions" ADD COLUMN "crew_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "ops_visit_sessions" ADD COLUMN "additional_technician_names_json" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "ops_visit_sessions" ADD COLUMN "vehicle_identifier" text;--> statement-breakpoint
ALTER TABLE "ops_visit_sessions" ADD COLUMN "arrival_note" text;--> statement-breakpoint
ALTER TABLE "ops_site_visit_work_orders" ADD CONSTRAINT "fk_ops_site_visit_work_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_site_visit_work_orders" ADD CONSTRAINT "fk_ops_site_visit_work_visit" FOREIGN KEY ("organization_id","visit_id") REFERENCES "public"."ops_visit_sessions"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_site_visit_work_orders" ADD CONSTRAINT "fk_ops_site_visit_work_work" FOREIGN KEY ("organization_id","work_order_id") REFERENCES "public"."ops_work_orders"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_site_visit_work_orders" ADD CONSTRAINT "fk_ops_site_visit_work_followup" FOREIGN KEY ("organization_id","follow_up_id") REFERENCES "public"."ops_follow_ups"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ops_site_visit_work_org_work_time" ON "ops_site_visit_work_orders" USING btree ("organization_id","work_order_id","linked_at");--> statement-breakpoint
CREATE INDEX "idx_ops_site_visit_work_org_outcome_time" ON "ops_site_visit_work_orders" USING btree ("organization_id","outcome","outcome_recorded_at");--> statement-breakpoint
ALTER TABLE "ops_visit_sessions" ADD CONSTRAINT "chk_ops_visits_crew_count" CHECK ("ops_visit_sessions"."crew_count" BETWEEN 1 AND 100);--> statement-breakpoint
ALTER TABLE "ops_visit_sessions" ADD CONSTRAINT "chk_ops_visits_additional_technicians" CHECK (jsonb_typeof("ops_visit_sessions"."additional_technician_names_json") = 'array' AND jsonb_array_length("ops_visit_sessions"."additional_technician_names_json") < "ops_visit_sessions"."crew_count");--> statement-breakpoint
INSERT INTO "ops_site_visit_work_orders" (
	"id", "organization_id", "visit_id", "work_order_id", "ordinal",
	"linked_by_actor_type", "linked_by_actor_name", "linked_at",
	"outcome", "outcome_notes", "outcome_recorded_by_actor_type",
	"outcome_recorded_by_actor_name", "outcome_recorded_at", "follow_up_id"
)
SELECT
	'site-visit-work-backfill-' || v."id", v."organization_id", v."id", v."work_order_id", 1,
	'system', 'Migration backfill', v."checked_in_at",
	CASE v."outcome"
		WHEN 'resolved' THEN 'completed'
		WHEN 'temporary_repair' THEN 'return_visit_required'
		WHEN 'diagnosed_waiting_parts' THEN 'parts_required'
		WHEN 'return_required' THEN 'return_visit_required'
		WHEN 'unable_to_complete' THEN 'not_addressed'
		WHEN 'unable_to_reproduce' THEN 'no_issue_found'
		WHEN 'no_issue_found' THEN 'no_issue_found'
		WHEN 'inspection_complete' THEN 'completed'
		WHEN 'pm_complete' THEN 'completed'
		WHEN 'other' THEN 'not_addressed'
		ELSE NULL
	END,
	v."outcome_notes",
	CASE WHEN v."outcome" IS NOT NULL THEN 'system' ELSE NULL END,
	CASE WHEN v."outcome" IS NOT NULL THEN 'Migration backfill' ELSE NULL END,
	CASE WHEN v."outcome" IS NOT NULL THEN COALESCE(v."checked_out_at", v."checked_in_at") ELSE NULL END,
	CASE WHEN v."outcome" IN ('temporary_repair', 'diagnosed_waiting_parts', 'return_required', 'unable_to_complete', 'other') THEN (
		SELECT f."id" FROM "ops_follow_ups" f
		WHERE f."organization_id" = v."organization_id"
			AND f."source_visit_id" = v."id"
			AND f."work_order_id" = v."work_order_id"
		ORDER BY f."created_at", f."id" LIMIT 1
	) ELSE NULL END
FROM "ops_visit_sessions" v
WHERE v."work_order_id" IS NOT NULL;
