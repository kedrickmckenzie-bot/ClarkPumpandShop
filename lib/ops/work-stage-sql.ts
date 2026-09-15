/** Shared by the work queue and dashboard aggregates. Repository aliases: w, a, v. */
export const vendorResponseSql = `a.kind = 'outside_vendor' AND a.status IN ('pending','issued','opened','accepted') AND (
  EXISTS (SELECT 1 FROM ops_workflow_tasks vt WHERE vt.organization_id = w.organization_id AND vt.id = (
    SELECT pt.id FROM ops_workflow_tasks pt WHERE pt.organization_id = w.organization_id AND pt.work_order_id = w.id AND pt.status IN ('open','in_progress')
    ORDER BY pt.blocking DESC, pt.required_for_progress DESC,
      CASE pt.priority WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'normal' THEN 2 ELSE 1 END DESC,
      CASE WHEN pt.due_at IS NULL THEN 1 ELSE 0 END, pt.due_at, CASE pt.status WHEN 'in_progress' THEN 1 ELSE 0 END DESC, pt.created_at, pt.id LIMIT 1
  ) AND vt.assignee_type = 'vendor' AND vt.assignee_id = a.vendor_id)
  OR (NOT EXISTS (SELECT 1 FROM ops_workflow_tasks pt WHERE pt.organization_id = w.organization_id AND pt.work_order_id = w.id AND pt.status IN ('open','in_progress')) AND w.accountable_party = v.name)
)`;
