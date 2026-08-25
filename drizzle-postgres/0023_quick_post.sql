CREATE TABLE "ops_job_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"job_type" text NOT NULL,
	"slot_key" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"processed_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"details_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_ops_job_runs_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "chk_ops_job_runs_status" CHECK ("ops_job_runs"."status" IN ('running', 'succeeded', 'failed')),
	CONSTRAINT "chk_ops_job_runs_counts" CHECK ("ops_job_runs"."processed_count" >= 0 AND "ops_job_runs"."failed_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "ops_job_runs" ADD CONSTRAINT "fk_ops_job_runs_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_job_runs_org_type_slot" ON "ops_job_runs" USING btree ("organization_id","job_type","slot_key");--> statement-breakpoint
CREATE INDEX "idx_ops_job_runs_org_type_started" ON "ops_job_runs" USING btree ("organization_id","job_type","started_at");