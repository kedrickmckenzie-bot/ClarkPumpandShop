import type { OpsFixture } from "./types";

/** Keep the job the reader opened. Component filters must never borrow another part's repair. */
export function lifecycleReviewWork(fixture: OpsFixture, organizationId: string, assetId: string, selectedWorkId?: string, componentId?: string) {
  const work = fixture.workOrders.filter(row => row.organizationId === organizationId && row.assetId === assetId);
  const parts = new Set(componentId ? [componentId] : []);
  if (componentId) {
    let previous = -1;
    while (previous !== parts.size) {
      previous = parts.size;
      for (const part of fixture.components.filter(row => row.organizationId === organizationId && row.assetId === assetId)) {
        if (part.parentComponentId && parts.has(part.parentComponentId)) parts.add(part.id);
      }
    }
  }
  const scoped = work.filter(row => !componentId || !!row.componentId && parts.has(row.componentId));
  if (selectedWorkId) return scoped.find(row => row.id === selectedWorkId);
  const event = fixture.replacementEvents.filter(row => row.organizationId === organizationId && row.assetId === assetId && row.status !== "cancelled" && scoped.some(job=>job.id===row.workOrderId)).sort((a,b)=>b.approvedAt.localeCompare(a.approvedAt))[0];
  const approvedWork = scoped.find(row=>row.id===event?.workOrderId);
  const active = scoped.filter(row=>row.priority!=="planned" && !["closed","cancelled","resolved","completed_pending_review"].includes(row.status)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));
  return approvedWork && active.some(row=>row.id===approvedWork.id) ? approvedWork : active[0] ?? approvedWork;
}
