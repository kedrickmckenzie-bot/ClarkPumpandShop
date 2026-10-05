import "server-only";
import type { OperatorSession } from "@/components/ops/data-contract";
import type { OpsRepository } from "@/lib/ops/repository";
import type { DiagnoseContext } from "@/lib/ops/ai-diagnose";
import { notesForAi } from "@/lib/ops/equipment-notes";
import { OpsDomainError } from "@/lib/ops/errors";
import { internalDispatchScope } from "./internal-dispatch-context";

const day = (iso?: string) => iso?.slice(0, 10);

/**
 * What the diagnostic AI may see about one unit: its facts, past jobs, AI repair notes and document titles.
 * Loaded from a job or a unit, and only when this person can see it.
 */
export async function aiDiagnoseContext(repository: OpsRepository, session: OperatorSession, target: { workOrderId?: string; assetId?: string }): Promise<DiagnoseContext & { workOrderId?: string; assetId?: string }> {
  const scope = await internalDispatchScope(repository, session);
  const work = target.workOrderId ? await repository.getWorkOrderDetail(scope, target.workOrderId) : null;
  if (target.workOrderId && !work) throw new OpsDomainError("NOT_FOUND", "Job not found.");
  const assetId = work ? work.asset?.id : target.assetId;
  const asset = assetId ? await repository.getAsset(scope.organizationId, assetId) : null;
  if (!work && (!asset || (scope.storeIds && !scope.storeIds.includes(asset.storeId)))) throw new OpsDomainError("NOT_FOUND", "Equipment not found.");
  const store = work ? `${work.storeNumber} ${work.storeName}` : undefined;
  if (!asset) return { workOrderId: work?.id, problem: work?.problem, store, equipment: "Not linked to equipment yet. Ask what make and model it is if that matters.", history: "", notes: "", documents: [] };
  const [past, notes, documents] = await Promise.all([
    repository.listWorkOrders(scope, { assetId: asset.id, limit: 25 }),
    repository.listEquipmentNotes(scope.organizationId, asset.id, 30),
    repository.listEquipmentDocuments(scope.organizationId, asset),
  ]);
  const age = asset.installedAt ? `installed ${day(asset.installedAt)}` : "install date not recorded";
  const equipment = [
    asset.name, asset.manufacturer, asset.model, asset.serialNumber ? `serial ${asset.serialNumber}` : undefined, age,
    asset.expectedLifeYears ? `expected life ${asset.expectedLifeYears} years` : undefined,
    asset.warrantyEndsAt ? `warranty ends ${day(asset.warrantyEndsAt)}` : undefined,
  ].filter(Boolean).join(" · ");
  const history = past.items
    .filter(row => row.id !== work?.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(row => `${day(row.createdAt)}: ${row.problem} · ${row.status.replaceAll("_", " ")} · ${row.vendorName ? "outside vendor" : "in-house"}${row.technicianNotes ? ` · notes: ${row.technicianNotes.slice(0, 300)}` : ""}`)
    .join("\n");
  return { workOrderId: work?.id, assetId: asset.id, problem: work?.problem, store, equipment, history, notes: notesForAi(notes), documents: documents.map(d => d.title) };
}
