ALTER TABLE ops_work_order_assignments ADD COLUMN internal_target text CONSTRAINT chk_ops_assignments_internal_target CHECK ((kind = 'outside_vendor' AND vendor_id IS NOT NULL AND internal_membership_id IS NULL AND internal_target IS NULL) OR (kind = 'internal' AND vendor_id IS NULL AND (COALESCE(internal_target,'person') = 'person' AND internal_membership_id IS NOT NULL OR internal_target IS NOT NULL AND internal_target IN ('pool','awaiting_allocation') AND internal_membership_id IS NULL)) OR (kind = 'choose_later' AND vendor_id IS NULL AND internal_membership_id IS NULL AND internal_target IS NULL));
--> statement-breakpoint
CREATE INDEX idx_ops_assignments_org_target_member ON ops_work_order_assignments (organization_id,kind,internal_target,internal_membership_id,status);

--> statement-breakpoint
CREATE INDEX idx_ops_inspection_org_work ON ops_inspections (organization_id,work_order_id,id);
