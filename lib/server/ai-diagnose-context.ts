import "server-only";
import type { OperatorSession } from "@/components/ops/data-contract";
import type { OpsRepository } from "@/lib/ops/repository";
import type { DiagnoseContext } from "@/lib/ops/ai-diagnose";
import { notesForAi } from "@/lib/ops/equipment-notes";
import { matchJobEquipment } from "@/lib/ops/job-equipment-match";
import { OpsDomainError } from "@/lib/ops/errors";
import { internalDispatchScope } from "./internal-dispatch-context";
import { extractDocumentPages, pickRelevantPages, saveDocumentPages } from "@/lib/ops/document-pages";
import type { EquipmentDocument } from "@/lib/ops/equipment-documents";
import { readPrivateUpload } from "@/components/ops-public/server-file-store";

/**
 * Pages for these documents, reading any document that has never been read. Each document is read once and its
 * pages are kept; at most three new documents are read per question so one answer never waits on a whole library.
 */
async function documentPages(repository: OpsRepository, organizationId: string, documents: EquipmentDocument[]) {
  let pages = await repository.listDocumentPages(organizationId, documents.map(d => d.id));
  const unread = documents.filter(d => !pages.some(p => p.documentId === d.id)).slice(0, 3);
  if (!unread.length) return pages;
  for (const document of unread) {
    try {
      const file = await repository.getStoredFileById(organizationId, document.fileId);
      const bytes = file?.status === "available" ? await readPrivateUpload(file.storageKey) : null;
      if (!file || !bytes) continue;
      await saveDocumentPages(repository, organizationId, document.id, await extractDocumentPages(file.contentType, bytes), new Date().toISOString());
    } catch (error) {
      console.warn("Document not read", document.id, error instanceof Error ? error.message : error);
    }
  }
  pages = await repository.listDocumentPages(organizationId, documents.map(d => d.id));
  return pages;
}

const day = (iso?: string) => iso?.slice(0, 10);

/**
 * What was recorded when the job was closed out: in-house results and vendor visit outcomes, oldest first,
 * without names. A corrected result replaces the one it corrects; a visit outcome already carried by a result is not repeated.
 */
export async function closeOutLines(repository: OpsRepository, organizationId: string, workOrderId: string) {
  const [results, visits] = await Promise.all([
    repository.listWorkResults(organizationId, workOrderId),
    repository.listSiteVisitWorkOrdersForWorkOrder(organizationId, workOrderId),
  ]);
  const replaced = new Set(results.flatMap(r => r.supersedesResultId ? [r.supersedesResultId] : []));
  const carried = new Set(results.flatMap(r => r.siteVisitWorkOrderId ? [r.siteVisitWorkOrderId] : []));
  const lines = [
    ...results.filter(r => !replaced.has(r.id)).map(r => ({ at: r.outcomeRecordedAt, outcome: r.outcome, notes: r.outcomeNotes, blocker: r.blocker })),
    ...visits.filter(v => v.outcome && !carried.has(v.id)).map(v => ({ at: v.outcomeRecordedAt ?? v.linkedAt, outcome: v.outcome!, notes: v.outcomeNotes, blocker: undefined })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  return lines.slice(-3).map(line => `  Close-out ${day(line.at)}: ${line.outcome.replaceAll("_", " ")}${line.blocker ? ` (needs ${line.blocker.replaceAll("_", " ")})` : ""}${line.notes ? ` · ${line.notes.replace(/\s+/g, " ").slice(0, 400)}` : ""}`);
}

/**
 * What the diagnostic AI may see about one unit: its facts, past jobs, AI repair notes and document titles.
 * Loaded from a job or a unit, and only when this person can see it.
 */
export async function aiDiagnoseContext(repository: OpsRepository, session: OperatorSession, target: { workOrderId?: string; assetId?: string }, question = ""): Promise<DiagnoseContext & { workOrderId?: string; assetId?: string }> {
  const scope = await internalDispatchScope(repository, session);
  const work = target.workOrderId ? await repository.getWorkOrderDetail(scope, target.workOrderId) : null;
  if (target.workOrderId && !work) throw new OpsDomainError("NOT_FOUND", "Job not found.");
  const assetId = work ? work.asset?.id : target.assetId;
  let asset = assetId ? await repository.getAsset(scope.organizationId, assetId) : null;
  if (!work && (!asset || (scope.storeIds && !scope.storeIds.includes(asset.storeId)))) throw new OpsDomainError("NOT_FOUND", "Equipment not found.");
  const store = work ? `${work.storeNumber} ${work.storeName}` : undefined;
  // A job not linked to equipment: use the store's unit the report names, and say so; otherwise list what it could be.
  let linkNote = "";
  if (!asset && work) {
    const match = matchJobEquipment(work.problem, work.categoryKey, await repository.listAssetsForStore(scope.organizationId, work.storeId));
    if (match.unit) {
      asset = match.unit;
      linkNote = " — NOT linked on this job; the job report names this unit, so its records are shown. Say so when you use them.";
    } else {
      const options = match.candidates.map(unit => `${unit.name} (${unit.assetTag})`).join("; ");
      return { workOrderId: work.id, problem: work.problem, store, equipment: `This job is not linked to equipment, so no unit's history, notes or manuals are shown.${options ? ` Units at this store that could fit: ${options}.` : ""}`, history: "", notes: "", documents: [], excerpts: [] };
    }
  }
  if (!asset) return { workOrderId: work?.id, problem: work?.problem, store, equipment: "This job is not linked to equipment, so no unit's history, notes or manuals are shown.", history: "", notes: "", documents: [], excerpts: [] };
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
  ].filter(Boolean).join(" · ") + linkNote;
  const pastJobs = past.items.filter(row => row.id !== work?.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  // Close-out results (what was found and done) for the most recent jobs; older jobs keep their one-line summary.
  const results = await Promise.all(pastJobs.slice(0, 12).map(row => closeOutLines(repository, scope.organizationId, row.id)));
  const history = pastJobs
    .map((row, index) => [
      `${day(row.createdAt)}: ${row.problem} · ${row.status.replaceAll("_", " ")} · ${row.vendorName ? "outside vendor" : "in-house"}${row.technicianNotes ? ` · instructions: ${row.technicianNotes.slice(0, 200)}` : ""}`,
      ...(results[index] ?? []),
    ].join("\n"))
    .join("\n");
  const titles = new Map(documents.map(d => [d.id, d.title]));
  const excerpts = pickRelevantPages(await documentPages(repository, scope.organizationId, documents), `${work?.problem ?? ""} ${question}`)
    .map(page => ({ title: titles.get(page.documentId) ?? "Document", pageLabel: page.pageLabel, text: page.text }));
  return { workOrderId: work?.id, assetId: asset.id, problem: work?.problem, store, equipment, history, notes: notesForAi(notes), documents: documents.map(d => d.title), excerpts };
}
