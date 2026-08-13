CREATE EXTENSION IF NOT EXISTS "pg_trgm";--> statement-breakpoint
CREATE TABLE "ops_asset_components" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"asset_id" text NOT NULL,
	"parent_component_id" text,
	"name" text NOT NULL,
	"part_number" text,
	"serial_number" text,
	"installed_at" timestamp with time zone,
	"warranty_ends_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_ops_components_org_id" UNIQUE("organization_id","id")
);
--> statement-breakpoint
CREATE TABLE "ops_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"store_id" text NOT NULL,
	"category_key" text NOT NULL,
	"taxonomy_node_id" text,
	"group_path_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"asset_tag" text NOT NULL,
	"name" text NOT NULL,
	"manufacturer" text,
	"model" text,
	"serial_number" text,
	"supplier" text,
	"installed_at" timestamp with time zone,
	"expected_life_years" integer,
	"warranty_ends_at" timestamp with time zone,
	"replacement_estimate_minor" bigint,
	"replacement_currency" text,
	"status" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_ops_assets_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "chk_ops_assets_status" CHECK ("ops_assets"."status" IN ('operational', 'watch', 'out_of_service', 'retired')),
	CONSTRAINT "chk_ops_assets_life" CHECK ("ops_assets"."expected_life_years" IS NULL OR "ops_assets"."expected_life_years" > 0),
	CONSTRAINT "chk_ops_assets_replacement" CHECK ("ops_assets"."replacement_estimate_minor" IS NULL OR "ops_assets"."replacement_estimate_minor" BETWEEN 0 AND 9007199254740991),
	CONSTRAINT "chk_ops_assets_replacement_money" CHECK (("ops_assets"."replacement_estimate_minor" IS NULL) = ("ops_assets"."replacement_currency" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "ops_audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" text NOT NULL,
	"event_type" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"actor_name" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "uq_ops_audit_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "chk_ops_audit_actor_type" CHECK ("ops_audit_events"."actor_type" IN ('user', 'vendor_link', 'technician', 'store_device', 'system', 'support'))
);
--> statement-breakpoint
CREATE TABLE "ops_cost_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"work_order_id" text NOT NULL,
	"kind" text NOT NULL,
	"description" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"service_date" date NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_ops_cost_lines_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "chk_ops_cost_lines_kind" CHECK ("ops_cost_lines"."kind" IN ('labor', 'parts', 'travel', 'materials', 'other')),
	CONSTRAINT "chk_ops_cost_lines_amount" CHECK ("ops_cost_lines"."amount_minor" BETWEEN -9007199254740991 AND 9007199254740991)
);
--> statement-breakpoint
CREATE TABLE "ops_divisions" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_ops_divisions_org_id" UNIQUE("organization_id","id")
);
--> statement-breakpoint
CREATE TABLE "ops_entity_files" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"file_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"purpose" text NOT NULL,
	"visibility" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_ops_entity_files_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "chk_ops_entity_files_type" CHECK ("ops_entity_files"."entity_type" IN ('request', 'work_order', 'visit', 'asset', 'invoice_reference')),
	CONSTRAINT "chk_ops_entity_files_purpose" CHECK ("ops_entity_files"."purpose" IN ('photo', 'service_document', 'invoice', 'warranty', 'other')),
	CONSTRAINT "chk_ops_entity_files_visibility" CHECK ("ops_entity_files"."visibility" IN ('internal', 'vendor_shared', 'public_receipt'))
);
--> statement-breakpoint
CREATE TABLE "ops_exceptions" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"kind" text NOT NULL,
	"store_id" text,
	"work_order_id" text,
	"visit_id" text,
	"vendor_id" text,
	"severity" text NOT NULL,
	"status" text NOT NULL,
	"summary" text NOT NULL,
	"detected_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "uq_ops_exceptions_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "chk_ops_exceptions_kind" CHECK ("ops_exceptions"."kind" IN ('no_work_order', 'unexpected_visit', 'missing_checkout', 'outside_geofence', 'low_accuracy_location', 'duplicate_active_visit', 'high_risk_service', 'unmatched_invoice', 'amount_above_authorization', 'overdue_pm')),
	CONSTRAINT "chk_ops_exceptions_severity" CHECK ("ops_exceptions"."severity" IN ('info', 'attention', 'urgent')),
	CONSTRAINT "chk_ops_exceptions_status" CHECK ("ops_exceptions"."status" IN ('open', 'acknowledged', 'resolved'))
);
--> statement-breakpoint
CREATE TABLE "ops_files" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"storage_key" text NOT NULL,
	"sha256" text NOT NULL,
	"original_name" text NOT NULL,
	"content_type" text NOT NULL,
	"byte_length" integer NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_ops_files_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "chk_ops_files_status" CHECK ("ops_files"."status" IN ('pending', 'available', 'quarantined', 'deleted')),
	CONSTRAINT "chk_ops_files_byte_length" CHECK ("ops_files"."byte_length" >= 0),
	CONSTRAINT "chk_ops_files_sha256" CHECK ("ops_files"."sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "ops_follow_ups" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"work_order_id" text NOT NULL,
	"source_visit_id" text,
	"accountable_party" text NOT NULL,
	"next_action" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"escalation_to" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "uq_ops_followups_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "chk_ops_followups_status" CHECK ("ops_follow_ups"."status" IN ('open', 'completed', 'cancelled')),
	CONSTRAINT "chk_ops_followups_completion" CHECK (("ops_follow_ups"."status" = 'completed') = ("ops_follow_ups"."completed_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "ops_idempotency_keys" (
	"organization_id" text NOT NULL,
	"key" text NOT NULL,
	"command" text NOT NULL,
	"result_id" text NOT NULL,
	"request_hash" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "ops_idempotency_keys_organization_id_key_pk" PRIMARY KEY("organization_id","key"),
	CONSTRAINT "chk_ops_idempotency_expiry" CHECK ("ops_idempotency_keys"."expires_at" > "ops_idempotency_keys"."created_at")
);
--> statement-breakpoint
CREATE TABLE "ops_invoice_allocations" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"invoice_reference_id" text NOT NULL,
	"work_order_id" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"confirmed_by_membership_id" text,
	"confirmed_at" timestamp with time zone,
	CONSTRAINT "uq_ops_invoice_allocations_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "chk_ops_invoice_allocations_amount" CHECK ("ops_invoice_allocations"."amount_minor" BETWEEN 0 AND 9007199254740991),
	CONSTRAINT "chk_ops_invoice_allocations_confirmation" CHECK (("ops_invoice_allocations"."confirmed_by_membership_id" IS NULL) = ("ops_invoice_allocations"."confirmed_at" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "ops_invoice_references" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"vendor_id" text NOT NULL,
	"invoice_number" text NOT NULL,
	"invoice_date" date NOT NULL,
	"gross_amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"operator_work_order_number" text,
	"match_status" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_ops_invoices_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "chk_ops_invoices_gross" CHECK ("ops_invoice_references"."gross_amount_minor" BETWEEN 0 AND 9007199254740991),
	CONSTRAINT "chk_ops_invoices_match_status" CHECK ("ops_invoice_references"."match_status" IN ('unmatched', 'suggested', 'confirmed', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "ops_memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_ops_memberships_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "chk_ops_memberships_status" CHECK ("ops_memberships"."status" IN ('invited', 'active', 'suspended')),
	CONSTRAINT "chk_ops_memberships_role" CHECK ("ops_memberships"."role" IN ('executive', 'facilities_admin', 'regional_manager', 'store_manager', 'store_employee', 'internal_technician', 'finance_reviewer', 'vendor_user', 'support'))
);
--> statement-breakpoint
CREATE TABLE "ops_organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"time_zone" text DEFAULT 'America/New_York' NOT NULL,
	"work_order_prefix" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops_outbox_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"topic" text NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" text NOT NULL,
	"payload_json" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"available_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"delivered_at" timestamp with time zone,
	"last_error" text,
	CONSTRAINT "uq_ops_outbox_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "chk_ops_outbox_status" CHECK ("ops_outbox_messages"."status" IN ('pending', 'processing', 'delivered', 'failed')),
	CONSTRAINT "chk_ops_outbox_attempt_count" CHECK ("ops_outbox_messages"."attempt_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "ops_pm_occurrences" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"store_id" text NOT NULL,
	"asset_id" text,
	"work_order_id" text,
	"due_at" timestamp with time zone NOT NULL,
	"window_starts_at" timestamp with time zone NOT NULL,
	"window_ends_at" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "uq_ops_pm_occurrences_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "chk_ops_pm_occurrences_status" CHECK ("ops_pm_occurrences"."status" IN ('due', 'scheduled', 'completed', 'missed', 'waived')),
	CONSTRAINT "chk_ops_pm_occurrences_window" CHECK ("ops_pm_occurrences"."window_starts_at" <= "ops_pm_occurrences"."due_at" AND "ops_pm_occurrences"."due_at" <= "ops_pm_occurrences"."window_ends_at"),
	CONSTRAINT "chk_ops_pm_occurrences_completion" CHECK ("ops_pm_occurrences"."status" <> 'completed' OR "ops_pm_occurrences"."completed_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "ops_pm_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"store_id" text,
	"asset_id" text,
	"category_key" text,
	"cadence_days" integer NOT NULL,
	"completion_window_days" integer NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_ops_pm_plans_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "chk_ops_pm_plans_cadence" CHECK ("ops_pm_plans"."cadence_days" > 0),
	CONSTRAINT "chk_ops_pm_plans_window" CHECK ("ops_pm_plans"."completion_window_days" >= 0),
	CONSTRAINT "chk_ops_pm_plans_target" CHECK ("ops_pm_plans"."store_id" IS NOT NULL OR "ops_pm_plans"."asset_id" IS NOT NULL OR nullif(btrim("ops_pm_plans"."category_key"), '') IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "ops_public_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"purpose" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "uq_ops_public_tokens_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "chk_ops_public_tokens_hash" CHECK ("ops_public_tokens"."token_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "chk_ops_public_tokens_expiry" CHECK ("ops_public_tokens"."expires_at" > "ops_public_tokens"."created_at")
);
--> statement-breakpoint
CREATE TABLE "ops_regions" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"division_id" text,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_ops_regions_org_id" UNIQUE("organization_id","id")
);
--> statement-breakpoint
CREATE TABLE "ops_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"reference" text NOT NULL,
	"store_id" text NOT NULL,
	"reporter_name" text NOT NULL,
	"reporter_employee_id" text,
	"problem" text NOT NULL,
	"priority" text NOT NULL,
	"status" text NOT NULL,
	"submitted_at" timestamp with time zone NOT NULL,
	"converted_work_order_id" text,
	CONSTRAINT "uq_ops_requests_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "chk_ops_requests_priority" CHECK ("ops_requests"."priority" IN ('emergency', 'urgent', 'routine', 'planned')),
	CONSTRAINT "chk_ops_requests_status" CHECK ("ops_requests"."status" IN ('submitted', 'under_review', 'converted', 'closed'))
);
--> statement-breakpoint
CREATE TABLE "ops_scope_grants" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"membership_id" text NOT NULL,
	"scope_kind" text NOT NULL,
	"scope_id" text NOT NULL,
	"permission" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_ops_scope_grants_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "chk_ops_scopes_kind" CHECK ("ops_scope_grants"."scope_kind" IN ('organization', 'division', 'region', 'store', 'vendor'))
);
--> statement-breakpoint
CREATE TABLE "ops_stores" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"division_id" text,
	"region_id" text,
	"store_number" text NOT NULL,
	"name" text NOT NULL,
	"address_1" text NOT NULL,
	"address_2" text,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"postal_code" text NOT NULL,
	"aliases_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"search_text" text NOT NULL,
	"latitude_e6" integer,
	"longitude_e6" integer,
	"geofence_radius_m" integer DEFAULT 200 NOT NULL,
	"location_policy_enabled" boolean DEFAULT false NOT NULL,
	"time_zone" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_ops_stores_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "chk_ops_stores_status" CHECK ("ops_stores"."status" IN ('active', 'inactive')),
	CONSTRAINT "chk_ops_stores_latitude" CHECK ("ops_stores"."latitude_e6" IS NULL OR "ops_stores"."latitude_e6" BETWEEN -90000000 AND 90000000),
	CONSTRAINT "chk_ops_stores_longitude" CHECK ("ops_stores"."longitude_e6" IS NULL OR "ops_stores"."longitude_e6" BETWEEN -180000000 AND 180000000),
	CONSTRAINT "chk_ops_stores_geofence" CHECK ("ops_stores"."geofence_radius_m" > 0)
);
--> statement-breakpoint
CREATE TABLE "ops_taxonomy_nodes" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"parent_node_id" text,
	"node_kind" text NOT NULL,
	"canonical_key" text,
	"name" text NOT NULL,
	"aliases_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"depth" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_ops_taxonomy_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "chk_ops_taxonomy_kind" CHECK ("ops_taxonomy_nodes"."node_kind" IN ('category', 'group')),
	CONSTRAINT "chk_ops_taxonomy_depth" CHECK ("ops_taxonomy_nodes"."depth" >= 0)
);
--> statement-breakpoint
CREATE TABLE "ops_users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "chk_ops_users_status" CHECK ("ops_users"."status" IN ('invited', 'active', 'suspended'))
);
--> statement-breakpoint
CREATE TABLE "ops_vendor_coverage" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"vendor_id" text NOT NULL,
	"scope_kind" text NOT NULL,
	"scope_id" text NOT NULL,
	"preferred_rank" integer,
	CONSTRAINT "uq_ops_vendor_coverage_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "chk_ops_vendor_coverage_kind" CHECK ("ops_vendor_coverage"."scope_kind" IN ('organization', 'region', 'store')),
	CONSTRAINT "chk_ops_vendor_coverage_rank" CHECK ("ops_vendor_coverage"."preferred_rank" IS NULL OR "ops_vendor_coverage"."preferred_rank" > 0)
);
--> statement-breakpoint
CREATE TABLE "ops_vendor_responses" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"work_order_id" text NOT NULL,
	"assignment_id" text NOT NULL,
	"issuance_id" text NOT NULL,
	"response" text NOT NULL,
	"responder_name" text NOT NULL,
	"proposed_at" timestamp with time zone,
	"message" text,
	"responded_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_ops_vendor_responses_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "chk_ops_vendor_responses_response" CHECK ("ops_vendor_responses"."response" IN ('accepted', 'declined', 'proposed_date', 'question')),
	CONSTRAINT "chk_ops_vendor_responses_proposal" CHECK ("ops_vendor_responses"."response" <> 'proposed_date' OR "ops_vendor_responses"."proposed_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "ops_vendor_specialties" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"vendor_id" text NOT NULL,
	"canonical_key" text NOT NULL,
	"display_name" text NOT NULL,
	"search_aliases_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "uq_ops_vendor_specialties_org_id" UNIQUE("organization_id","id")
);
--> statement-breakpoint
CREATE TABLE "ops_vendors" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"dispatch_email" text NOT NULL,
	"dispatch_phone" text,
	"status" text DEFAULT 'approved' NOT NULL,
	"preferred" boolean DEFAULT false NOT NULL,
	"search_text" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_ops_vendors_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "chk_ops_vendors_status" CHECK ("ops_vendors"."status" IN ('approved', 'restricted', 'inactive'))
);
--> statement-breakpoint
CREATE TABLE "ops_visit_evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"visit_id" text NOT NULL,
	"kind" text NOT NULL,
	"channel" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"location_result" text,
	"latitude_e6" integer,
	"longitude_e6" integer,
	"accuracy_m" integer,
	"distance_m" integer,
	"payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "uq_ops_visit_evidence_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "chk_ops_visit_evidence_kind" CHECK ("ops_visit_evidence"."kind" IN ('check_in', 'check_out', 'reported_arrival', 'identity_assertion', 'photo', 'file', 'store_confirmation', 'amendment')),
	CONSTRAINT "chk_ops_visit_evidence_channel" CHECK ("ops_visit_evidence"."channel" IN ('qr', 'secure_link', 'store_device', 'vendor_portal', 'future_app')),
	CONSTRAINT "chk_ops_visit_evidence_location" CHECK ("ops_visit_evidence"."location_result" IS NULL OR "ops_visit_evidence"."location_result" IN ('verified', 'outside_geofence', 'low_accuracy', 'permission_denied', 'unavailable', 'not_requested', 'trusted_store_device')),
	CONSTRAINT "chk_ops_visit_evidence_latitude" CHECK ("ops_visit_evidence"."latitude_e6" IS NULL OR "ops_visit_evidence"."latitude_e6" BETWEEN -90000000 AND 90000000),
	CONSTRAINT "chk_ops_visit_evidence_longitude" CHECK ("ops_visit_evidence"."longitude_e6" IS NULL OR "ops_visit_evidence"."longitude_e6" BETWEEN -180000000 AND 180000000),
	CONSTRAINT "chk_ops_visit_evidence_accuracy" CHECK ("ops_visit_evidence"."accuracy_m" IS NULL OR "ops_visit_evidence"."accuracy_m" >= 0),
	CONSTRAINT "chk_ops_visit_evidence_distance" CHECK ("ops_visit_evidence"."distance_m" IS NULL OR "ops_visit_evidence"."distance_m" >= 0)
);
--> statement-breakpoint
CREATE TABLE "ops_visit_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"store_id" text NOT NULL,
	"provider_kind" text NOT NULL,
	"vendor_id" text,
	"internal_membership_id" text,
	"work_order_id" text,
	"unmatched_reason" text,
	"technician_name" text NOT NULL,
	"provider_name" text NOT NULL,
	"purpose" text NOT NULL,
	"status" text NOT NULL,
	"started_channel" text NOT NULL,
	"ended_channel" text,
	"checked_in_at" timestamp with time zone NOT NULL,
	"checked_out_at" timestamp with time zone,
	"outcome" text,
	"outcome_notes" text,
	"observed_duration_seconds" integer,
	CONSTRAINT "uq_ops_visits_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "chk_ops_visits_provider_kind" CHECK ("ops_visit_sessions"."provider_kind" IN ('outside_vendor', 'internal')),
	CONSTRAINT "chk_ops_visits_provider" CHECK (
    ("ops_visit_sessions"."provider_kind" = 'outside_vendor' AND "ops_visit_sessions"."vendor_id" IS NOT NULL AND "ops_visit_sessions"."internal_membership_id" IS NULL)
    OR ("ops_visit_sessions"."provider_kind" = 'internal' AND "ops_visit_sessions"."vendor_id" IS NULL AND "ops_visit_sessions"."internal_membership_id" IS NOT NULL)
  ),
	CONSTRAINT "chk_ops_visits_work_or_reason" CHECK ("ops_visit_sessions"."work_order_id" IS NOT NULL OR nullif(btrim("ops_visit_sessions"."unmatched_reason"), '') IS NOT NULL),
	CONSTRAINT "chk_ops_visits_status" CHECK ("ops_visit_sessions"."status" IN ('active', 'checked_out', 'amended')),
	CONSTRAINT "chk_ops_visits_started_channel" CHECK ("ops_visit_sessions"."started_channel" IN ('qr', 'secure_link', 'store_device', 'vendor_portal', 'future_app')),
	CONSTRAINT "chk_ops_visits_ended_channel" CHECK ("ops_visit_sessions"."ended_channel" IS NULL OR "ops_visit_sessions"."ended_channel" IN ('qr', 'secure_link', 'store_device', 'vendor_portal', 'future_app')),
	CONSTRAINT "chk_ops_visits_outcome" CHECK ("ops_visit_sessions"."outcome" IS NULL OR "ops_visit_sessions"."outcome" IN ('resolved', 'temporary_repair', 'diagnosed_waiting_parts', 'return_required', 'unable_to_complete', 'no_issue_found', 'inspection_complete', 'pm_complete', 'other')),
	CONSTRAINT "chk_ops_visits_chronology" CHECK ("ops_visit_sessions"."checked_out_at" IS NULL OR "ops_visit_sessions"."checked_out_at" >= "ops_visit_sessions"."checked_in_at"),
	CONSTRAINT "chk_ops_visits_duration" CHECK ("ops_visit_sessions"."observed_duration_seconds" IS NULL OR "ops_visit_sessions"."observed_duration_seconds" >= 0),
	CONSTRAINT "chk_ops_visits_checkout_state" CHECK (
    ("ops_visit_sessions"."status" = 'active' AND "ops_visit_sessions"."checked_out_at" IS NULL)
    OR ("ops_visit_sessions"."status" <> 'active' AND "ops_visit_sessions"."checked_out_at" IS NOT NULL)
  )
);
--> statement-breakpoint
CREATE TABLE "ops_work_order_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"work_order_id" text NOT NULL,
	"kind" text NOT NULL,
	"vendor_id" text,
	"internal_membership_id" text,
	"status" text NOT NULL,
	"assigned_at" timestamp with time zone NOT NULL,
	"supersedes_assignment_id" text,
	CONSTRAINT "uq_ops_assignments_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "chk_ops_assignments_kind" CHECK ("ops_work_order_assignments"."kind" IN ('internal', 'outside_vendor', 'choose_later')),
	CONSTRAINT "chk_ops_assignments_status" CHECK ("ops_work_order_assignments"."status" IN ('pending', 'issued', 'accepted', 'declined', 'completed', 'cancelled', 'superseded')),
	CONSTRAINT "chk_ops_assignments_provider" CHECK (
    ("ops_work_order_assignments"."kind" = 'outside_vendor' AND "ops_work_order_assignments"."vendor_id" IS NOT NULL AND "ops_work_order_assignments"."internal_membership_id" IS NULL)
    OR ("ops_work_order_assignments"."kind" = 'internal' AND "ops_work_order_assignments"."vendor_id" IS NULL AND "ops_work_order_assignments"."internal_membership_id" IS NOT NULL)
    OR ("ops_work_order_assignments"."kind" = 'choose_later' AND "ops_work_order_assignments"."vendor_id" IS NULL AND "ops_work_order_assignments"."internal_membership_id" IS NULL)
  )
);
--> statement-breakpoint
CREATE TABLE "ops_work_order_counters" (
	"organization_id" text NOT NULL,
	"counter_year" integer NOT NULL,
	"next_value" integer NOT NULL,
	CONSTRAINT "ops_work_order_counters_organization_id_counter_year_pk" PRIMARY KEY("organization_id","counter_year"),
	CONSTRAINT "chk_ops_work_order_counters_year" CHECK ("ops_work_order_counters"."counter_year" BETWEEN 2000 AND 9999),
	CONSTRAINT "chk_ops_work_order_counters_next" CHECK ("ops_work_order_counters"."next_value" > 0)
);
--> statement-breakpoint
CREATE TABLE "ops_work_order_issuances" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"work_order_id" text NOT NULL,
	"assignment_id" text NOT NULL,
	"revision" integer NOT NULL,
	"immutable_payload_json" jsonb NOT NULL,
	"channel" text NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_ops_issuances_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "chk_ops_issuances_revision" CHECK ("ops_work_order_issuances"."revision" > 0),
	CONSTRAINT "chk_ops_issuances_channel" CHECK ("ops_work_order_issuances"."channel" IN ('email', 'sms', 'print', 'manual'))
);
--> statement-breakpoint
CREATE TABLE "ops_work_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"number" text NOT NULL,
	"store_id" text NOT NULL,
	"request_id" text,
	"problem" text NOT NULL,
	"authorized_scope" text,
	"category_key" text,
	"taxonomy_node_id" text,
	"asset_id" text,
	"component_id" text,
	"priority" text NOT NULL,
	"status" text NOT NULL,
	"accountable_party" text NOT NULL,
	"next_action" text NOT NULL,
	"due_at" timestamp with time zone,
	"escalation_to" text,
	"nte_amount_minor" bigint,
	"nte_currency" text,
	"vendor_service_ticket_number" text,
	"vendor_invoice_number" text,
	"external_accounting_po" text,
	"created_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "uq_ops_work_orders_org_id" UNIQUE("organization_id","id"),
	CONSTRAINT "chk_ops_work_orders_priority" CHECK ("ops_work_orders"."priority" IN ('emergency', 'urgent', 'routine', 'planned')),
	CONSTRAINT "chk_ops_work_orders_status" CHECK ("ops_work_orders"."status" IN ('draft', 'awaiting_approval', 'approved', 'issued', 'accepted', 'scheduled', 'in_progress', 'waiting_on_vendor', 'waiting_on_parts', 'completed_pending_review', 'closed', 'cancelled')),
	CONSTRAINT "chk_ops_work_orders_nte" CHECK ("ops_work_orders"."nte_amount_minor" IS NULL OR "ops_work_orders"."nte_amount_minor" BETWEEN 0 AND 9007199254740991),
	CONSTRAINT "chk_ops_work_orders_nte_money" CHECK (("ops_work_orders"."nte_amount_minor" IS NULL) = ("ops_work_orders"."nte_currency" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "ops_asset_components" ADD CONSTRAINT "fk_ops_components_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_asset_components" ADD CONSTRAINT "fk_ops_components_asset" FOREIGN KEY ("organization_id","asset_id") REFERENCES "public"."ops_assets"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_asset_components" ADD CONSTRAINT "fk_ops_components_parent" FOREIGN KEY ("organization_id","parent_component_id") REFERENCES "public"."ops_asset_components"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_assets" ADD CONSTRAINT "fk_ops_assets_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_assets" ADD CONSTRAINT "fk_ops_assets_store" FOREIGN KEY ("organization_id","store_id") REFERENCES "public"."ops_stores"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_assets" ADD CONSTRAINT "fk_ops_assets_taxonomy" FOREIGN KEY ("organization_id","taxonomy_node_id") REFERENCES "public"."ops_taxonomy_nodes"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_audit_events" ADD CONSTRAINT "fk_ops_audit_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_cost_lines" ADD CONSTRAINT "fk_ops_cost_lines_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_cost_lines" ADD CONSTRAINT "fk_ops_cost_lines_work" FOREIGN KEY ("organization_id","work_order_id") REFERENCES "public"."ops_work_orders"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_divisions" ADD CONSTRAINT "fk_ops_divisions_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_entity_files" ADD CONSTRAINT "fk_ops_entity_files_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_entity_files" ADD CONSTRAINT "fk_ops_entity_files_file" FOREIGN KEY ("organization_id","file_id") REFERENCES "public"."ops_files"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_exceptions" ADD CONSTRAINT "fk_ops_exceptions_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_exceptions" ADD CONSTRAINT "fk_ops_exceptions_store" FOREIGN KEY ("organization_id","store_id") REFERENCES "public"."ops_stores"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_exceptions" ADD CONSTRAINT "fk_ops_exceptions_work" FOREIGN KEY ("organization_id","work_order_id") REFERENCES "public"."ops_work_orders"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_exceptions" ADD CONSTRAINT "fk_ops_exceptions_visit" FOREIGN KEY ("organization_id","visit_id") REFERENCES "public"."ops_visit_sessions"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_exceptions" ADD CONSTRAINT "fk_ops_exceptions_vendor" FOREIGN KEY ("organization_id","vendor_id") REFERENCES "public"."ops_vendors"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_files" ADD CONSTRAINT "fk_ops_files_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_follow_ups" ADD CONSTRAINT "fk_ops_followups_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_follow_ups" ADD CONSTRAINT "fk_ops_followups_work" FOREIGN KEY ("organization_id","work_order_id") REFERENCES "public"."ops_work_orders"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_follow_ups" ADD CONSTRAINT "fk_ops_followups_visit" FOREIGN KEY ("organization_id","source_visit_id") REFERENCES "public"."ops_visit_sessions"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_idempotency_keys" ADD CONSTRAINT "fk_ops_idempotency_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_invoice_allocations" ADD CONSTRAINT "fk_ops_invoice_allocations_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_invoice_allocations" ADD CONSTRAINT "fk_ops_invoice_allocations_invoice" FOREIGN KEY ("organization_id","invoice_reference_id") REFERENCES "public"."ops_invoice_references"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_invoice_allocations" ADD CONSTRAINT "fk_ops_invoice_allocations_work" FOREIGN KEY ("organization_id","work_order_id") REFERENCES "public"."ops_work_orders"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_invoice_allocations" ADD CONSTRAINT "fk_ops_invoice_allocations_confirmer" FOREIGN KEY ("organization_id","confirmed_by_membership_id") REFERENCES "public"."ops_memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_invoice_references" ADD CONSTRAINT "fk_ops_invoices_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_invoice_references" ADD CONSTRAINT "fk_ops_invoices_vendor" FOREIGN KEY ("organization_id","vendor_id") REFERENCES "public"."ops_vendors"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_memberships" ADD CONSTRAINT "fk_ops_memberships_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_memberships" ADD CONSTRAINT "fk_ops_memberships_user" FOREIGN KEY ("user_id") REFERENCES "public"."ops_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_outbox_messages" ADD CONSTRAINT "fk_ops_outbox_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_pm_occurrences" ADD CONSTRAINT "fk_ops_pm_occurrences_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_pm_occurrences" ADD CONSTRAINT "fk_ops_pm_occurrences_plan" FOREIGN KEY ("organization_id","plan_id") REFERENCES "public"."ops_pm_plans"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_pm_occurrences" ADD CONSTRAINT "fk_ops_pm_occurrences_store" FOREIGN KEY ("organization_id","store_id") REFERENCES "public"."ops_stores"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_pm_occurrences" ADD CONSTRAINT "fk_ops_pm_occurrences_asset" FOREIGN KEY ("organization_id","asset_id") REFERENCES "public"."ops_assets"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_pm_occurrences" ADD CONSTRAINT "fk_ops_pm_occurrences_work" FOREIGN KEY ("organization_id","work_order_id") REFERENCES "public"."ops_work_orders"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_pm_plans" ADD CONSTRAINT "fk_ops_pm_plans_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_pm_plans" ADD CONSTRAINT "fk_ops_pm_plans_store" FOREIGN KEY ("organization_id","store_id") REFERENCES "public"."ops_stores"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_pm_plans" ADD CONSTRAINT "fk_ops_pm_plans_asset" FOREIGN KEY ("organization_id","asset_id") REFERENCES "public"."ops_assets"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_public_tokens" ADD CONSTRAINT "fk_ops_public_tokens_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_regions" ADD CONSTRAINT "fk_ops_regions_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_regions" ADD CONSTRAINT "fk_ops_regions_division" FOREIGN KEY ("organization_id","division_id") REFERENCES "public"."ops_divisions"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_requests" ADD CONSTRAINT "fk_ops_requests_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_requests" ADD CONSTRAINT "fk_ops_requests_store" FOREIGN KEY ("organization_id","store_id") REFERENCES "public"."ops_stores"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_requests" ADD CONSTRAINT "fk_ops_requests_converted_work" FOREIGN KEY ("organization_id","converted_work_order_id") REFERENCES "public"."ops_work_orders"("organization_id","id") DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint
ALTER TABLE "ops_scope_grants" ADD CONSTRAINT "fk_ops_scopes_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_scope_grants" ADD CONSTRAINT "fk_ops_scopes_membership" FOREIGN KEY ("organization_id","membership_id") REFERENCES "public"."ops_memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_stores" ADD CONSTRAINT "fk_ops_stores_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_stores" ADD CONSTRAINT "fk_ops_stores_division" FOREIGN KEY ("organization_id","division_id") REFERENCES "public"."ops_divisions"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_stores" ADD CONSTRAINT "fk_ops_stores_region" FOREIGN KEY ("organization_id","region_id") REFERENCES "public"."ops_regions"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_taxonomy_nodes" ADD CONSTRAINT "fk_ops_taxonomy_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_taxonomy_nodes" ADD CONSTRAINT "fk_ops_taxonomy_parent" FOREIGN KEY ("organization_id","parent_node_id") REFERENCES "public"."ops_taxonomy_nodes"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_vendor_coverage" ADD CONSTRAINT "fk_ops_vendor_coverage_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_vendor_coverage" ADD CONSTRAINT "fk_ops_vendor_coverage_vendor" FOREIGN KEY ("organization_id","vendor_id") REFERENCES "public"."ops_vendors"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_vendor_responses" ADD CONSTRAINT "fk_ops_vendor_responses_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_vendor_responses" ADD CONSTRAINT "fk_ops_vendor_responses_work" FOREIGN KEY ("organization_id","work_order_id") REFERENCES "public"."ops_work_orders"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_vendor_responses" ADD CONSTRAINT "fk_ops_vendor_responses_assignment" FOREIGN KEY ("organization_id","assignment_id") REFERENCES "public"."ops_work_order_assignments"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_vendor_responses" ADD CONSTRAINT "fk_ops_vendor_responses_issuance" FOREIGN KEY ("organization_id","issuance_id") REFERENCES "public"."ops_work_order_issuances"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_vendor_specialties" ADD CONSTRAINT "fk_ops_vendor_specialties_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_vendor_specialties" ADD CONSTRAINT "fk_ops_vendor_specialties_vendor" FOREIGN KEY ("organization_id","vendor_id") REFERENCES "public"."ops_vendors"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_vendors" ADD CONSTRAINT "fk_ops_vendors_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_visit_evidence" ADD CONSTRAINT "fk_ops_visit_evidence_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_visit_evidence" ADD CONSTRAINT "fk_ops_visit_evidence_visit" FOREIGN KEY ("organization_id","visit_id") REFERENCES "public"."ops_visit_sessions"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_visit_sessions" ADD CONSTRAINT "fk_ops_visits_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_visit_sessions" ADD CONSTRAINT "fk_ops_visits_store" FOREIGN KEY ("organization_id","store_id") REFERENCES "public"."ops_stores"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_visit_sessions" ADD CONSTRAINT "fk_ops_visits_vendor" FOREIGN KEY ("organization_id","vendor_id") REFERENCES "public"."ops_vendors"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_visit_sessions" ADD CONSTRAINT "fk_ops_visits_membership" FOREIGN KEY ("organization_id","internal_membership_id") REFERENCES "public"."ops_memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_visit_sessions" ADD CONSTRAINT "fk_ops_visits_work" FOREIGN KEY ("organization_id","work_order_id") REFERENCES "public"."ops_work_orders"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_work_order_assignments" ADD CONSTRAINT "fk_ops_assignments_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_work_order_assignments" ADD CONSTRAINT "fk_ops_assignments_work" FOREIGN KEY ("organization_id","work_order_id") REFERENCES "public"."ops_work_orders"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_work_order_assignments" ADD CONSTRAINT "fk_ops_assignments_vendor" FOREIGN KEY ("organization_id","vendor_id") REFERENCES "public"."ops_vendors"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_work_order_assignments" ADD CONSTRAINT "fk_ops_assignments_membership" FOREIGN KEY ("organization_id","internal_membership_id") REFERENCES "public"."ops_memberships"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_work_order_assignments" ADD CONSTRAINT "fk_ops_assignments_supersedes" FOREIGN KEY ("organization_id","supersedes_assignment_id") REFERENCES "public"."ops_work_order_assignments"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_work_order_counters" ADD CONSTRAINT "fk_ops_work_order_counters_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_work_order_issuances" ADD CONSTRAINT "fk_ops_issuances_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_work_order_issuances" ADD CONSTRAINT "fk_ops_issuances_work" FOREIGN KEY ("organization_id","work_order_id") REFERENCES "public"."ops_work_orders"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_work_order_issuances" ADD CONSTRAINT "fk_ops_issuances_assignment" FOREIGN KEY ("organization_id","assignment_id") REFERENCES "public"."ops_work_order_assignments"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_work_orders" ADD CONSTRAINT "fk_ops_work_orders_org" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_work_orders" ADD CONSTRAINT "fk_ops_work_orders_store" FOREIGN KEY ("organization_id","store_id") REFERENCES "public"."ops_stores"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_work_orders" ADD CONSTRAINT "fk_ops_work_orders_request" FOREIGN KEY ("organization_id","request_id") REFERENCES "public"."ops_requests"("organization_id","id") DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint
ALTER TABLE "ops_work_orders" ADD CONSTRAINT "fk_ops_work_orders_taxonomy" FOREIGN KEY ("organization_id","taxonomy_node_id") REFERENCES "public"."ops_taxonomy_nodes"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_work_orders" ADD CONSTRAINT "fk_ops_work_orders_asset" FOREIGN KEY ("organization_id","asset_id") REFERENCES "public"."ops_assets"("organization_id","id") DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint
ALTER TABLE "ops_work_orders" ADD CONSTRAINT "fk_ops_work_orders_component" FOREIGN KEY ("organization_id","component_id") REFERENCES "public"."ops_asset_components"("organization_id","id") DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint
CREATE INDEX "idx_ops_components_org_asset_parent" ON "ops_asset_components" USING btree ("organization_id","asset_id","parent_component_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_assets_org_store_tag" ON "ops_assets" USING btree ("organization_id","store_id","asset_tag");--> statement-breakpoint
CREATE INDEX "idx_ops_assets_org_store_category" ON "ops_assets" USING btree ("organization_id","store_id","category_key");--> statement-breakpoint
CREATE INDEX "idx_ops_assets_org_status" ON "ops_assets" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "idx_ops_audit_org_aggregate_time" ON "ops_audit_events" USING btree ("organization_id","aggregate_type","aggregate_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_ops_audit_org_event_time" ON "ops_audit_events" USING btree ("organization_id","event_type","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_ops_cost_lines_org_work_date" ON "ops_cost_lines" USING btree ("organization_id","work_order_id","service_date");--> statement-breakpoint
CREATE INDEX "idx_ops_cost_lines_org_date_kind" ON "ops_cost_lines" USING btree ("organization_id","service_date","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_divisions_org_code" ON "ops_divisions" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "idx_ops_divisions_org_name" ON "ops_divisions" USING btree ("organization_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_entity_files_org_file_entity" ON "ops_entity_files" USING btree ("organization_id","file_id","entity_type","entity_id","purpose");--> statement-breakpoint
CREATE INDEX "idx_ops_entity_files_org_entity" ON "ops_entity_files" USING btree ("organization_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_ops_exceptions_org_status_time" ON "ops_exceptions" USING btree ("organization_id","status","detected_at");--> statement-breakpoint
CREATE INDEX "idx_ops_exceptions_org_store_status" ON "ops_exceptions" USING btree ("organization_id","store_id","status");--> statement-breakpoint
CREATE INDEX "idx_ops_exceptions_org_vendor_status" ON "ops_exceptions" USING btree ("organization_id","vendor_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_files_org_storage_key" ON "ops_files" USING btree ("organization_id","storage_key");--> statement-breakpoint
CREATE INDEX "idx_ops_files_org_sha256" ON "ops_files" USING btree ("organization_id","sha256");--> statement-breakpoint
CREATE INDEX "idx_ops_followups_org_status_due" ON "ops_follow_ups" USING btree ("organization_id","status","due_at");--> statement-breakpoint
CREATE INDEX "idx_ops_followups_org_work" ON "ops_follow_ups" USING btree ("organization_id","work_order_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_ops_idempotency_org_expiry" ON "ops_idempotency_keys" USING btree ("organization_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_invoice_allocations_org_invoice_work" ON "ops_invoice_allocations" USING btree ("organization_id","invoice_reference_id","work_order_id");--> statement-breakpoint
CREATE INDEX "idx_ops_invoice_allocations_org_work" ON "ops_invoice_allocations" USING btree ("organization_id","work_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_invoices_org_vendor_number" ON "ops_invoice_references" USING btree ("organization_id","vendor_id","invoice_number");--> statement-breakpoint
CREATE INDEX "idx_ops_invoices_org_match_date" ON "ops_invoice_references" USING btree ("organization_id","match_status","invoice_date");--> statement-breakpoint
CREATE INDEX "idx_ops_invoices_org_wo_number" ON "ops_invoice_references" USING btree ("organization_id","operator_work_order_number");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_memberships_org_user_role" ON "ops_memberships" USING btree ("organization_id","user_id","role");--> statement-breakpoint
CREATE INDEX "idx_ops_memberships_org_status" ON "ops_memberships" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_org_slug" ON "ops_organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_ops_outbox_org_status_available" ON "ops_outbox_messages" USING btree ("organization_id","status","available_at");--> statement-breakpoint
CREATE INDEX "idx_ops_pm_occurrences_org_status_due" ON "ops_pm_occurrences" USING btree ("organization_id","status","due_at");--> statement-breakpoint
CREATE INDEX "idx_ops_pm_occurrences_org_store_due" ON "ops_pm_occurrences" USING btree ("organization_id","store_id","due_at");--> statement-breakpoint
CREATE INDEX "idx_ops_pm_occurrences_org_asset_due" ON "ops_pm_occurrences" USING btree ("organization_id","asset_id","due_at");--> statement-breakpoint
CREATE INDEX "idx_ops_pm_plans_org_active_store" ON "ops_pm_plans" USING btree ("organization_id","active","store_id");--> statement-breakpoint
CREATE INDEX "idx_ops_pm_plans_org_asset" ON "ops_pm_plans" USING btree ("organization_id","asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_public_tokens_hash" ON "ops_public_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_ops_public_tokens_org_subject" ON "ops_public_tokens" USING btree ("organization_id","subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "idx_ops_public_tokens_org_purpose_expiry" ON "ops_public_tokens" USING btree ("organization_id","purpose","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_regions_org_code" ON "ops_regions" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "idx_ops_regions_org_name" ON "ops_regions" USING btree ("organization_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_requests_org_reference" ON "ops_requests" USING btree ("organization_id","reference");--> statement-breakpoint
CREATE INDEX "idx_ops_requests_org_store_status_time" ON "ops_requests" USING btree ("organization_id","store_id","status","submitted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_scopes_org_member_scope_perm" ON "ops_scope_grants" USING btree ("organization_id","membership_id","scope_kind","scope_id","permission");--> statement-breakpoint
CREATE INDEX "idx_ops_scopes_org_kind_id" ON "ops_scope_grants" USING btree ("organization_id","scope_kind","scope_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_stores_org_number" ON "ops_stores" USING btree ("organization_id","store_number");--> statement-breakpoint
CREATE INDEX "idx_ops_stores_org_region_number" ON "ops_stores" USING btree ("organization_id","region_id","store_number");--> statement-breakpoint
CREATE INDEX "idx_ops_stores_org_status_number" ON "ops_stores" USING btree ("organization_id","status","store_number");--> statement-breakpoint
CREATE INDEX "idx_ops_stores_search_trgm" ON "ops_stores" USING gin ("search_text" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_taxonomy_org_parent_name" ON "ops_taxonomy_nodes" USING btree ("organization_id","parent_node_id","name");--> statement-breakpoint
CREATE INDEX "idx_ops_taxonomy_org_parent_sort" ON "ops_taxonomy_nodes" USING btree ("organization_id","parent_node_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_ops_taxonomy_org_kind_active" ON "ops_taxonomy_nodes" USING btree ("organization_id","node_kind","active");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_users_email" ON "ops_users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_vendor_coverage_org_vendor_scope" ON "ops_vendor_coverage" USING btree ("organization_id","vendor_id","scope_kind","scope_id");--> statement-breakpoint
CREATE INDEX "idx_ops_vendor_coverage_org_scope" ON "ops_vendor_coverage" USING btree ("organization_id","scope_kind","scope_id");--> statement-breakpoint
CREATE INDEX "idx_ops_vendor_responses_org_assignment_time" ON "ops_vendor_responses" USING btree ("organization_id","assignment_id","responded_at");--> statement-breakpoint
CREATE INDEX "idx_ops_vendor_responses_org_work_time" ON "ops_vendor_responses" USING btree ("organization_id","work_order_id","responded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_vendor_specialties_org_vendor_key" ON "ops_vendor_specialties" USING btree ("organization_id","vendor_id","canonical_key");--> statement-breakpoint
CREATE INDEX "idx_ops_vendor_specialties_org_key" ON "ops_vendor_specialties" USING btree ("organization_id","canonical_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_vendors_org_code" ON "ops_vendors" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "idx_ops_vendors_org_status_name" ON "ops_vendors" USING btree ("organization_id","status","name");--> statement-breakpoint
CREATE INDEX "idx_ops_vendors_search_trgm" ON "ops_vendors" USING gin ("search_text" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_ops_visit_evidence_org_visit_time" ON "ops_visit_evidence" USING btree ("organization_id","visit_id","observed_at");--> statement-breakpoint
CREATE INDEX "idx_ops_visit_evidence_org_kind_time" ON "ops_visit_evidence" USING btree ("organization_id","kind","observed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_visit_boundary_evidence" ON "ops_visit_evidence" USING btree ("organization_id","visit_id","kind") WHERE "ops_visit_evidence"."kind" IN ('check_in', 'check_out');--> statement-breakpoint
CREATE INDEX "idx_ops_visits_org_store_status_time" ON "ops_visit_sessions" USING btree ("organization_id","store_id","status","checked_in_at");--> statement-breakpoint
CREATE INDEX "idx_ops_visits_org_vendor_status_time" ON "ops_visit_sessions" USING btree ("organization_id","vendor_id","status","checked_in_at");--> statement-breakpoint
CREATE INDEX "idx_ops_visits_org_work_time" ON "ops_visit_sessions" USING btree ("organization_id","work_order_id","checked_in_at");--> statement-breakpoint
CREATE INDEX "idx_ops_assignments_org_work_status" ON "ops_work_order_assignments" USING btree ("organization_id","work_order_id","status");--> statement-breakpoint
CREATE INDEX "idx_ops_assignments_org_vendor_status" ON "ops_work_order_assignments" USING btree ("organization_id","vendor_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_issuances_org_work_revision" ON "ops_work_order_issuances" USING btree ("organization_id","work_order_id","revision");--> statement-breakpoint
CREATE INDEX "idx_ops_issuances_org_assignment" ON "ops_work_order_issuances" USING btree ("organization_id","assignment_id","issued_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_ops_work_orders_org_number" ON "ops_work_orders" USING btree ("organization_id","number");--> statement-breakpoint
CREATE INDEX "idx_ops_work_orders_org_status_due" ON "ops_work_orders" USING btree ("organization_id","status","due_at");--> statement-breakpoint
CREATE INDEX "idx_ops_work_orders_org_store_created" ON "ops_work_orders" USING btree ("organization_id","store_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_ops_work_orders_org_category_created" ON "ops_work_orders" USING btree ("organization_id","category_key","created_at");
