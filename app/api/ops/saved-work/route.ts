import { getOpsRequestContext, assertStoreInSessionScope, opsApiError } from "@/lib/server/ops-request-context";
import { heldWorkVendorEligibility } from "@/lib/ops/held-work-policy";
import { OpsDomainError } from "@/lib/ops/commands";
import { issueWorkOrderToVendor } from "@/lib/server/work-order-issuance";

async function contextFor(request: Request) {
  const context = await getOpsRequestContext(["facilities", "regional", "store_manager"], "issue_work_order", request);
  const query = new URL(request.url).searchParams;
  const parentId = query.get("workOrderId");
  const parent = parentId ? await context.repository.getWorkOrder(context.session.organizationId, parentId) : null;
  if (parentId && !parent) throw new OpsDomainError("NOT_FOUND", "Work order not found.");
  if (parent && ["closed", "cancelled", "resolved", "completed_pending_review"].includes(parent.status)) throw new OpsDomainError("CONFLICT", "This work order is already completed.");
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
    return Response.json({ vendor: c.vendor.name, rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return opsApiError(error); }
}

export async function POST(request: Request) {
  try {
    const c = await contextFor(request);
    const body = await request.json() as { jobs: {id:string;revision:number}[]; channel: "manual" | "email" };
    if (!body || !Array.isArray(body.jobs) || !body.jobs.length || body.jobs.length > 20 || !["manual", "email"].includes(body.channel)) throw new OpsDomainError("VALIDATION", "Choose up to 20 jobs and a handoff method.");
    if (body.jobs.some(j => !j || typeof j.id !== "string" || !j.id || j.id.length > 120 || !Number.isInteger(j.revision) || j.revision < 0)) throw new OpsDomainError("VALIDATION", "Refresh the selected jobs before sending.");
    if (new Set(body.jobs.map((j: { id: string }) => j.id)).size !== body.jobs.length) throw new OpsDomainError("VALIDATION", "Choose each job once.");
    const results = [];
    for (const job of body.jobs) {
      try {
        const work = await c.repository.getWorkOrder(c.session.organizationId, job.id);
        const hold = (await c.repository.listActiveWorkOrderVisitHoldsForStore(c.session.organizationId, c.storeId)).find(h => h.workOrderId === job.id && h.status === "active");
        if (!work || work.storeId !== c.storeId || !hold || work.id === c.parentId || c.session.role === "store_manager" && work.priority !== "routine") throw new OpsDomainError("CONFLICT", "This job is no longer available for this visit.");
        const eligibility = await heldWorkVendorEligibility({ repository: c.repository, organizationId: c.session.organizationId, vendorId: c.vendorId, workOrder: work, now: new Date().toISOString() });
        if (!eligibility.allowed) throw new OpsDomainError("CONFLICT", eligibility.reason!);
        if (!Number.isInteger(job.revision) || job.revision < 0) throw new OpsDomainError("VALIDATION", "Refresh the job before sending.");
        const sent = await issueWorkOrderToVendor({ repository: c.repository, organizationId: c.session.organizationId, organizationName: c.session.organizationName, workOrderId: work.id, vendorId: c.vendorId, expectedRevision: job.revision, channel: body.channel, actor: c.actor });
        results.push({ id: job.id, number: work.number, ok: true, href: sent.publicPath, message: sent.notice });
      } catch (error) { results.push({ id: job.id, ok: false, message: error instanceof OpsDomainError ? error.message : "Could not send this job. Refresh before trying again." }); }
    }
    return Response.json({ results });
  } catch (error) { return opsApiError(error); }
}
