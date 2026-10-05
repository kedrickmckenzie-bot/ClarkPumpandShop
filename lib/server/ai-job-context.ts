import "server-only";
import type { OperatorSession } from "@/components/ops/data-contract";
import type { OpsRepository } from "@/lib/ops/repository";
import { OpsDomainError } from "@/lib/ops/errors";
import { internalDispatchScope } from "./internal-dispatch-context";

/** The job facts the AI may see, loaded only if this person can see the job. */
export async function aiJobContext(repository: OpsRepository, session: OperatorSession, workOrderId: string) {
  const scope = await internalDispatchScope(repository, session);
  const work = await repository.getWorkOrderDetail(scope, workOrderId);
  if (!work) throw new OpsDomainError("NOT_FOUND", "Job not found.");
  const asset = work.asset ? await repository.getAsset(scope.organizationId, work.asset.id) : null;
  return {
    work,
    problem: work.problem,
    store: `${work.storeNumber} ${work.storeName}`,
    equipment: asset ? [asset.name, asset.manufacturer, asset.model].filter(Boolean).join(" · ") : undefined,
  };
}
