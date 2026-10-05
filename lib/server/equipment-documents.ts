import "server-only";
import type { OperatorSession } from "@/components/ops/data-contract";
import type { OpsRepository } from "@/lib/ops/repository";
import { OpsDomainError } from "@/lib/ops/errors";
import { internalDispatchScope } from "./internal-dispatch-context";

/** The equipment record as this person may see it; technicians are limited to their own stores. */
export async function equipmentForDocuments(repository: OpsRepository, session: OperatorSession, assetId: string) {
  const scope = session.role === "technician" ? await internalDispatchScope(repository, session) : session;
  const asset = await repository.getAssetDetail(scope, assetId);
  if (!asset) throw new OpsDomainError("NOT_FOUND", "Equipment not found.");
  return asset;
}
