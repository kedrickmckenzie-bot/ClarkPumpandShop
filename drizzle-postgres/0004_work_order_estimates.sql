CREATE TABLE "ops_vendor_estimate_proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"request_id" text NOT NULL,
	"work_order_id" text NOT NULL,
	"vendor_id" text NOT NULL,
	"revision" integer NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"scope" text NOT NULL,
	"exclusions" text,
	"lead_time_days" integer,
	"valid_until" timestamp with time zone,
	"submitted_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_ops_estimate_proposals_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "uq_ops_estimate_proposals_org_request_revision" UNIQUE("organization_id","request_id","revision"),
	CONSTRAINT "chk_ops_estimate_proposals_revision" CHECK ("ops_vendor_estimate_proposals"."revision" > 0),
	CONSTRAINT "chk_ops_estimate_proposals_amount" CHECK ("ops_vendor_estimate_proposals"."amount_minor" BETWEEN 0 AND 9007199254740991),
	CONSTRAINT "chk_ops_estimate_proposals_currency" CHECK (nullif(btrim("ops_vendor_estimate_proposals"."currency"), '') IS NOT NULL),
	CONSTRAINT "chk_ops_estimate_proposals_scope" CHECK (nullif(btrim("ops_vendor_estimate_proposals"."scope"), '') IS NOT NULL),
	CONSTRAINT "chk_ops_estimate_proposals_lead_time" CHECK ("ops_vendor_estimate_proposals"."lead_time_days" IS NULL OR "ops_vendor_estimate_proposals"."lead_time_days" BETWEEN 0 AND 3650),
	CONSTRAINT "chk_ops_estimate_proposals_valid_until" CHECK ("ops_vendor_estimate_proposals"."valid_until" IS NULL OR "ops_vendor_estimate_proposals"."valid_until" > "ops_vendor_estimate_proposals"."submitted_at")
);
--> statement-breakpoint
CREATE TABLE "ops_work_order_estimate_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"work_order_id" text NOT NULL,
	"vendor_id" text NOT NULL,
	"kind" text NOT NULL,
	"requested_scope" text NOT NULL,
	"status" text NOT NULL,
	"channel" text NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"due_at" timestamp with time zone,
	"opened_at" timestamp with time zone,
	"responded_at" timestamp with time zone,
	"decision_at" timestamp with time zone,
	CONSTRAINT "uq_ops_estimate_requests_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "uq_ops_estimate_requests_org_context" UNIQUE("organization_id","id","work_order_id","vendor_id"),
	CONSTRAINT "chk_ops_estimate_requests_kind" CHECK ("ops_work_order_estimate_requests"."kind" IN ('estimate_only', 'diagnostic_and_estimate')),
	CONSTRAINT "chk_ops_estimate_requests_status" CHECK ("ops_work_order_estimate_requests"."status" IN ('requested', 'opened', 'submitted', 'declined', 'expired', 'withdrawn', 'selected', 'not_selected')),
	CONSTRAINT "chk_ops_estimate_requests_channel" CHECK ("ops_work_order_estimate_requests"."channel" IN ('email', 'sms', 'manual')),
	CONSTRAINT "chk_ops_estimate_requests_scope" CHECK (nullif(btrim("ops_work_order_estimate_requests"."requested_scope"), '') IS NOT NULL),
	CONSTRAINT "chk_ops_estimate_requests_due" CHECK ("ops_work_order_estimate_requests"."due_at" IS NULL OR "ops_work_order_estimate_requests"."due_at" >= "ops_work_order_estimate_requests"."requested_at"),
	CONSTRAINT "chk_ops_estimate_requests_opened" CHECK ("ops_work_order_estimate_requests"."opened_at" IS NULL OR "ops_work_order_estimate_requests"."opened_at" >= "ops_work_order_estimate_requests"."requested_at"),
	CONSTRAINT "chk_ops_estimate_requests_responded" CHECK ("ops_work_order_estimate_requests"."responded_at" IS NULL OR "ops_work_order_estimate_requests"."responded_at" >= "ops_work_order_estimate_requests"."requested_at"),
	CONSTRAINT "chk_ops_estimate_requests_decision" CHECK ("ops_work_order_estimate_requests"."decision_at" IS NULL OR "ops_work_order_estimate_requests"."decision_at" >= "ops_work_order_estimate_requests"."requested_at")
);
--> statement-breakpoint
ALTER TABLE "ops_visit_sessions" DROP CONSTRAINT "chk_ops_visits_outcome";--> statement-breakpoint
ALTER TABLE "ops_work_order_assignments" DROP CONSTRAINT "chk_ops_assignments_status";--> statement-breakpoint
ALTER TABLE "ops_vendor_estimate_proposals" ADD CONSTRAINT "fk_ops_estimate_proposals_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_vendor_estimate_proposals" ADD CONSTRAINT "fk_ops_estimate_proposals_work" FOREIGN KEY ("organization_id","work_order_id") REFERENCES "public"."ops_work_orders"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_vendor_estimate_proposals" ADD CONSTRAINT "fk_ops_estimate_proposals_vendor" FOREIGN KEY ("organization_id","vendor_id") REFERENCES "public"."ops_vendors"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_vendor_estimate_proposals" ADD CONSTRAINT "fk_ops_estimate_proposals_request_context" FOREIGN KEY ("organization_id","request_id","work_order_id","vendor_id") REFERENCES "public"."ops_work_order_estimate_requests"("organization_id","id","work_order_id","vendor_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_work_order_estimate_requests" ADD CONSTRAINT "fk_ops_estimate_requests_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_work_order_estimate_requests" ADD CONSTRAINT "fk_ops_estimate_requests_work" FOREIGN KEY ("organization_id","work_order_id") REFERENCES "public"."ops_work_orders"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_work_order_estimate_requests" ADD CONSTRAINT "fk_ops_estimate_requests_vendor" FOREIGN KEY ("organization_id","vendor_id") REFERENCES "public"."ops_vendors"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ops_estimate_proposals_org_work_submitted" ON "ops_vendor_estimate_proposals" USING btree ("organization_id","work_order_id","submitted_at");--> statement-breakpoint
CREATE INDEX "idx_ops_estimate_proposals_org_vendor_submitted" ON "ops_vendor_estimate_proposals" USING btree ("organization_id","vendor_id","submitted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_estimate_requests_org_work_vendor_active" ON "ops_work_order_estimate_requests" USING btree ("organization_id","work_order_id","vendor_id") WHERE "ops_work_order_estimate_requests"."status" IN ('requested', 'opened', 'submitted');--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_estimate_requests_org_work_selected" ON "ops_work_order_estimate_requests" USING btree ("organization_id","work_order_id") WHERE "ops_work_order_estimate_requests"."status" = 'selected';--> statement-breakpoint
CREATE INDEX "idx_ops_estimate_requests_org_work_status_requested" ON "ops_work_order_estimate_requests" USING btree ("organization_id","work_order_id","status","requested_at");--> statement-breakpoint
CREATE INDEX "idx_ops_estimate_requests_org_vendor_status_due" ON "ops_work_order_estimate_requests" USING btree ("organization_id","vendor_id","status","due_at");--> statement-breakpoint
CREATE INDEX "idx_ops_estimate_requests_org_status_due" ON "ops_work_order_estimate_requests" USING btree ("organization_id","status","due_at");--> statement-breakpoint
ALTER TABLE "ops_visit_sessions" ADD CONSTRAINT "chk_ops_visits_outcome" CHECK ("ops_visit_sessions"."outcome" IS NULL OR "ops_visit_sessions"."outcome" IN ('resolved', 'temporary_repair', 'diagnosed_waiting_parts', 'return_required', 'unable_to_complete', 'unable_to_reproduce', 'no_issue_found', 'inspection_complete', 'pm_complete', 'other'));--> statement-breakpoint
ALTER TABLE "ops_work_order_assignments" ADD CONSTRAINT "chk_ops_assignments_status" CHECK ("ops_work_order_assignments"."status" IN ('pending', 'issued', 'opened', 'accepted', 'declined', 'completed', 'cancelled', 'superseded'));