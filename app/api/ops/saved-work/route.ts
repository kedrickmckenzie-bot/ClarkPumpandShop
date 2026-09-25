import { getOpsRequestContext, assertStoreInSessionScope, opsApiError } from "@/lib/server/ops-request-context";
import { heldWorkVendorEligibility } from "@/lib/ops/held-work-policy";
import { OpsDomainError } from "@/lib/ops/commands";
import { offerResponseKey } from "@/lib/ops/optional-work-policy";
import type { ServiceAuthorizationSnapshot } from "@/lib/ops/view-models";

async function contextFor(request: Request) {
  const context = await getOpsRequestContext(["facilities", "regional", "store_manager"], "issue_work_order", request);
  const query = new URL(request.url).searchParams;
  const parentId = query.get("workOrderId");
  const parent = parentId ? await context.repository.getWorkOrder(context.session.organizationId, parentId) : null;
  if (parentId && !parent) throw new OpsDomainError("NOT_FOUND", "Work order not found.");
  const assignment = parent ? await context.repository.getActiveAssignment(context.session.organizationId, parent.id) : null;
  const storeId = parent?.storeId ?? query.get("storeId") ?? "";
  const vendorId = query.get("vendorId") ?? assignment?.vendorId ?? "";
  await assertStoreInSessionScope(context.session, storeId);
  const vendor = await context.repository.getVendor(context.session.organizationId, vendorId);
  if (!vendor || vendor.status !== "approved") throw new OpsDomainError("VALIDATION", "Choose an approved vendor.");
  return { ...context, storeId, vendorId, vendor, parentId };
}

export async function GET(request: Request) {
  try {
    const c = await contextFor(request);
    const holds = await c.repository.listActiveWorkOrderVisitHoldsForStore(c.session.organizationId, c.storeId);
    const rows = (await Promise.all(holds.map(async hold => {
      const work = await c.repository.getWorkOrder(c.session.organizationId, hold.workOrderId);
      if (!work || work.id === c.parentId || work.status !== "approved" || hold.status !== "active" || c.session.role === "store_manager" && work.priority !== "routine") return null;
      const eligibility = await heldWorkVendorEligibility({ repository: c.repository, organizationId: c.session.organizationId, vendorId: c.vendorId, workOrder: work, now: new Date().toISOString() });
      const issuances = await c.repository.listIssuancesForWorkOrder(c.session.organizationId, work.id);
      return { id: work.id, number: work.number, problem: work.problem, category: work.categoryKey, revision: Math.max(0, ...issuances.map(i => i.revision)), scope: work.authorizedScope ?? work.problem, eligible: eligibility.allowed, reason: eligibility.allowed ? undefined : eligibility.reason };
    }))).filter(Boolean);
    const issuance=c.parentId ? await c.repository.getLatestIssuanceForWorkOrder(c.session.organizationId,c.parentId) : null;
    const offered=issuance ? await Promise.all(((JSON.parse(issuance.immutablePayloadJson) as ServiceAuthorizationSnapshot).offeredWork ?? []).map(async job=>({id:job.id,number:job.number,problem:job.problem,status:(await c.repository.getIdempotencyKey(c.session.organizationId,offerResponseKey(issuance.id,job.id)))?.resultId ?? "Awaiting vendor choice"}))) : [];
    return Response.json({ vendor: c.vendor.name, rows, offered }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return opsApiError(error); }
}
