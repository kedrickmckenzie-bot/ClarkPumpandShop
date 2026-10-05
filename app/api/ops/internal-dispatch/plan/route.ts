import { saveInternalPlanBatch } from "@/lib/ops/internal-plan-batch";
import {
  getOpsRequestContext,
  assertStoreInSessionScope,
  opsApiError,
} from "@/lib/server/ops-request-context";
import type { ScheduleInput } from "@/lib/ops/internal-scheduling";
import { OpsDomainError } from "@/lib/ops/errors";
export async function POST(request: Request) {
  try {
    const c = await getOpsRequestContext(
      ["facilities", "regional"],
      "schedule_internal_work",
      request,
    );
    const body = (await request.json()) as {
      jobs: Omit<ScheduleInput, "actor" | "organizationId">[];
    };
    if (!Array.isArray(body.jobs) || !body.jobs.length || body.jobs.length > 25)
      throw new OpsDomainError("VALIDATION", "Select up to 25 jobs.");
    const inputs = [];
    for (const job of body.jobs) {
      const work = await c.repository.getWorkOrder(
        c.session.organizationId,
        job.workOrderId,
      );
      if (!work) throw new OpsDomainError("NOT_FOUND", "Job not found.");
      await assertStoreInSessionScope(c.session, work.storeId);
      inputs.push({
        ...job,
        organizationId: c.session.organizationId,
        actor: c.actor,
      });
    }
    const results = await saveInternalPlanBatch(
      { repository: c.repository },
      inputs,
    );
    return Response.json({ saved: true, results });
  } catch (error) {
    return opsApiError(error);
  }
}
