/** Every populated reference must belong to the same organization and visible stores. */
export const briefValueScopeSql = `
 AND (v.warranty_case_id IS NULL OR EXISTS (
   SELECT 1 FROM ops_warranty_cases c JOIN scoped_work w ON w.organization_id=c.organization_id AND w.id=c.work_order_id
   JOIN scoped_assets a ON a.organization_id=c.organization_id AND a.id=c.asset_id
   WHERE c.organization_id=v.organization_id AND c.id=v.warranty_case_id))
 AND (v.approval_decision_id IS NULL OR EXISTS (
   SELECT 1 FROM ops_approval_decisions d JOIN ops_approval_requests r ON r.organization_id=d.organization_id AND r.id=d.approval_request_id
   JOIN scoped_stores s ON s.organization_id=r.organization_id AND s.id=r.store_id
   WHERE d.organization_id=v.organization_id AND d.id=v.approval_decision_id))
 AND (v.contract_version_id IS NULL OR EXISTS (
   SELECT 1 FROM ops_contract_versions c WHERE c.organization_id=v.organization_id AND c.id=v.contract_version_id))
 AND (v.service_run_id IS NULL OR (
   EXISTS (SELECT 1 FROM ops_service_runs r WHERE r.organization_id=v.organization_id AND r.id=v.service_run_id)
   AND EXISTS (SELECT 1 FROM ops_service_run_work_orders l WHERE l.organization_id=v.organization_id AND l.service_run_id=v.service_run_id)
   AND NOT EXISTS (SELECT 1 FROM ops_service_run_work_orders l WHERE l.organization_id=v.organization_id AND l.service_run_id=v.service_run_id AND NOT EXISTS (SELECT 1 FROM scoped_work w WHERE w.organization_id=l.organization_id AND w.id=l.work_order_id))
   AND NOT EXISTS (SELECT 1 FROM ops_route_stops r WHERE r.organization_id=v.organization_id AND r.service_run_id=v.service_run_id AND NOT EXISTS (SELECT 1 FROM scoped_stores s WHERE s.organization_id=r.organization_id AND s.id=r.store_id))
 ))`;
