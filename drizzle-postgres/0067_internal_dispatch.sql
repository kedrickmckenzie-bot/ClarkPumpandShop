ALTER TABLE "ops_notification_rules" DROP CONSTRAINT "chk_ops_notification_rules_event";--> statement-breakpoint
ALTER TABLE "ops_notification_rules" DROP CONSTRAINT "chk_ops_notification_rules_role";--> statement-breakpoint
ALTER TABLE "ops_work_order_assignments" DROP CONSTRAINT "chk_ops_assignments_provider";--> statement-breakpoint
ALTER TABLE "ops_work_order_assignments" ADD COLUMN "internal_target" text;--> statement-breakpoint
CREATE INDEX "idx_ops_assignments_org_target_member" ON "ops_work_order_assignments" USING btree ("organization_id","kind","internal_target","internal_membership_id","status");--> statement-breakpoint
ALTER TABLE "ops_notification_rules" ADD CONSTRAINT "chk_ops_notification_rules_event" CHECK ("ops_notification_rules"."event_key" IN ('vendor_response_received', 'vendor_commitment_received', 'workflow_task_escalated', 'follow_up_created', 'vendor_reminder_created', 'held_work_claimed', 'held_work_outcomes_recorded', 'vendor_compliance_due', 'repair_confirmation_required', 'internal_dispatch_changed'));--> statement-breakpoint
ALTER TABLE "ops_notification_rules" ADD CONSTRAINT "chk_ops_notification_rules_role" CHECK ("ops_notification_rules"."recipient_role" IN ('facilities_admin', 'store_manager', 'regional_manager', 'field_manager', 'executive', 'finance_reviewer', 'internal_technician'));--> statement-breakpoint
ALTER TABLE "ops_work_order_assignments" ADD CONSTRAINT "chk_ops_assignments_internal_target" CHECK ("ops_work_order_assignments"."internal_target" IS NULL OR "ops_work_order_assignments"."kind" = 'internal' AND "ops_work_order_assignments"."internal_target" IN ('person', 'pool', 'awaiting_allocation'));--> statement-breakpoint
ALTER TABLE "ops_work_order_assignments" ADD CONSTRAINT "chk_ops_assignments_provider" CHECK (
    ("ops_work_order_assignments"."kind" = 'outside_vendor' AND "ops_work_order_assignments"."vendor_id" IS NOT NULL AND "ops_work_order_assignments"."internal_membership_id" IS NULL)
    OR ("ops_work_order_assignments"."kind" = 'internal' AND "ops_work_order_assignments"."vendor_id" IS NULL AND (COALESCE("ops_work_order_assignments"."internal_target", 'person') = 'person' AND "ops_work_order_assignments"."internal_membership_id" IS NOT NULL OR "ops_work_order_assignments"."internal_target" IS NOT NULL AND "ops_work_order_assignments"."internal_target" IN ('pool', 'awaiting_allocation') AND "ops_work_order_assignments"."internal_membership_id" IS NULL))
    OR ("ops_work_order_assignments"."kind" = 'choose_later' AND "ops_work_order_assignments"."vendor_id" IS NULL AND "ops_work_order_assignments"."internal_membership_id" IS NULL)
  );
--> statement-breakpoint
CREATE INDEX idx_ops_inspection_org_work ON ops_inspections (organization_id,work_order_id,id);
