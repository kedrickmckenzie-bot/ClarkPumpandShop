import type { OpsClock, OpsCommandServices, OpsIdSource } from "./commands";
import { OpsDomainError } from "./errors";
import type { OpsRepository, OpsStatement } from "./repository";
import type { ActorContext, Asset, StoredFile } from "./types";

export const EQUIPMENT_DOCUMENT_TYPES = ["manual", "wiring_diagram", "parts_list", "spec_sheet", "other"] as const;
export type EquipmentDocumentType = (typeof EQUIPMENT_DOCUMENT_TYPES)[number];
export const equipmentDocumentTypeLabel: Record<EquipmentDocumentType, string> = {
  manual: "Manual",
  wiring_diagram: "Wiring diagram",
  parts_list: "Parts list",
  spec_sheet: "Spec sheet",
  other: "Other",
};

/** A knowledge-base document for every unit of a make and model, or for one unit only. */
export interface EquipmentDocument {
  id: string;
  organizationId: string;
  fileId: string;
  title: string;
  docType: EquipmentDocumentType;
  /** Set when the document covers every unit of this make and model. */
  manufacturerKey?: string;
  modelKey?: string;
  /** Set when the document belongs to one unit only. */
  assetId?: string;
  uploadedByMembershipId?: string;
  uploadedByName: string;
  createdAt: string;
  removedAt?: string;
  removedByName?: string;
}

/** Lower-case, single-spaced, without punctuation, so "TC-48 HP" and "tc 48hp" share documents. */
export function equipmentKey(value: string | undefined) {
  const key = value?.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
  return key ? key : undefined;
}

/** Which documents apply to a unit: its own, plus any for its make and model. */
export function documentAppliesTo(document: EquipmentDocument, asset: Pick<Asset, "id" | "manufacturer" | "model">) {
  if (document.removedAt) return false;
  if (document.assetId) return document.assetId === asset.id;
  const model = equipmentKey(asset.model);
  return Boolean(model && document.modelKey === model && (!document.manufacturerKey || document.manufacturerKey === equipmentKey(asset.manufacturer)));
}

const systemClock: OpsClock = { now: () => new Date().toISOString() };
const randomIds: OpsIdSource = { next: prefix => `${prefix}-${crypto.randomUUID()}` };
/** Knowledge-base documents are curated by managers; technicians read them. */
const documentManagerRoles = new Set(["facilities_admin", "regional_manager", "field_manager"]);
const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
export const EQUIPMENT_DOCUMENT_MAX_BYTES = 25 * 1024 * 1024;

function insert(table: string, values: Record<string, unknown>): OpsStatement {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined);
  return { sql: `INSERT INTO ${table} (${entries.map(([key]) => key).join(", ")}) VALUES (${entries.map(() => "?").join(", ")})`, params: entries.map(([, value]) => value) };
}
function audit(ids: OpsIdSource, organizationId: string, documentId: string, eventType: string, actor: ActorContext, occurredAt: string, payload: unknown): OpsStatement {
  return insert("ops_audit_events", { id: ids.next("audit"), organization_id: organizationId, aggregate_type: "equipment_document", aggregate_id: documentId, event_type: eventType, actor_type: actor.actorType, actor_id: actor.actorId, actor_name: actor.actorName, occurred_at: occurredAt, payload_json: JSON.stringify(payload) });
}

/** Confirms the actor is an active manager who covers the equipment's store. */
async function assertDocumentManager(repository: OpsRepository, actor: ActorContext, asset: Asset) {
  if (actor.organizationId !== asset.organizationId || actor.actorType !== "user" || !actor.actorId) throw new OpsDomainError("FORBIDDEN", "Sign in as a manager to change equipment documents.");
  const membership = await repository.getMembership(asset.organizationId, actor.actorId);
  if (!membership || membership.status !== "active" || !documentManagerRoles.has(membership.role)) throw new OpsDomainError("FORBIDDEN", "Only managers can add or remove equipment documents.");
  if (membership.role === "facilities_admin") return membership;
  const [store, grants] = await Promise.all([repository.getStore(asset.organizationId, asset.storeId), repository.listScopeGrantsForMembership(asset.organizationId, membership.id)]);
  if (!store || !grants.some(g => g.scopeKind === "organization" && g.scopeId === asset.organizationId || g.scopeKind === "region" && g.scopeId === store.regionId || g.scopeKind === "store" && g.scopeId === store.id))
    throw new OpsDomainError("FORBIDDEN", "You don't cover this store.");
  return membership;
}

/** Adds a manual, diagram or sheet for this unit's make and model, or for this unit only. */
export async function addEquipmentDocument(input: {
  organizationId: string;
  actor: ActorContext;
  assetId: string;
  appliesTo: "model" | "unit";
  title: string;
  docType: string;
  file: StoredFile;
}, dependencies: OpsCommandServices) {
  const repository = dependencies.repository, now = (dependencies.clock ?? systemClock).now(), ids = dependencies.ids ?? randomIds;
  const asset = await repository.getAsset(input.organizationId, input.assetId);
  if (!asset) throw new OpsDomainError("NOT_FOUND", "Equipment not found.");
  await assertDocumentManager(repository, input.actor, asset);
  const title = input.title.trim();
  if (!title || title.length > 160) throw new OpsDomainError("VALIDATION", "Give the document a name (up to 160 characters).");
  if (!(EQUIPMENT_DOCUMENT_TYPES as readonly string[]).includes(input.docType)) throw new OpsDomainError("VALIDATION", "Choose what kind of document this is.");
  const modelKey = equipmentKey(asset.model);
  if (input.appliesTo === "model" && !modelKey) throw new OpsDomainError("VALIDATION", "Add this equipment's model first, or attach the document to this unit only.");
  const f = input.file;
  if (f.organizationId !== input.organizationId || f.status !== "available" || !allowedTypes.has(f.contentType) || !Number.isSafeInteger(f.byteLength) || f.byteLength <= 0 || f.byteLength > EQUIPMENT_DOCUMENT_MAX_BYTES || !/^[a-f0-9]{64}$/.test(f.sha256))
    throw new OpsDomainError("VALIDATION", "Upload a PDF, JPG, PNG or WebP up to 25 MB.");
  const id = ids.next("equipment-document");
  const document: EquipmentDocument = {
    id, organizationId: input.organizationId, fileId: f.id, title, docType: input.docType as EquipmentDocumentType,
    ...(input.appliesTo === "model" ? { modelKey, manufacturerKey: equipmentKey(asset.manufacturer) } : { assetId: asset.id }),
    uploadedByMembershipId: input.actor.actorId, uploadedByName: input.actor.actorName ?? "Manager", createdAt: now,
  };
  await repository.atomicWrite([
    insert("ops_files", { id: f.id, organization_id: f.organizationId, storage_key: f.storageKey, sha256: f.sha256, original_name: f.originalName, content_type: f.contentType, byte_length: f.byteLength, status: f.status, created_at: now }),
    insert("ops_equipment_documents", { id, organization_id: document.organizationId, file_id: document.fileId, title: document.title, doc_type: document.docType, manufacturer_key: document.manufacturerKey, model_key: document.modelKey, asset_id: document.assetId, uploaded_by_membership_id: document.uploadedByMembershipId, uploaded_by_name: document.uploadedByName, created_at: now }),
    audit(ids, input.organizationId, id, "equipment_document.added", input.actor, now, { assetId: asset.id, appliesTo: input.appliesTo, title, docType: input.docType, fileId: f.id, manufacturer: asset.manufacturer, model: asset.model }),
  ]);
  return document;
}

/** Takes a document out of the library. The record and file stay for history. */
export async function removeEquipmentDocument(input: { organizationId: string; actor: ActorContext; assetId: string; documentId: string }, dependencies: OpsCommandServices) {
  const repository = dependencies.repository, now = (dependencies.clock ?? systemClock).now(), ids = dependencies.ids ?? randomIds;
  const asset = await repository.getAsset(input.organizationId, input.assetId);
  if (!asset) throw new OpsDomainError("NOT_FOUND", "Equipment not found.");
  await assertDocumentManager(repository, input.actor, asset);
  const document = await repository.getEquipmentDocument(input.organizationId, input.documentId);
  if (!document || !documentAppliesTo(document, asset)) throw new OpsDomainError("NOT_FOUND", "Document not found.");
  await repository.atomicWrite([
    { sql: "UPDATE ops_equipment_documents SET removed_at = ?, removed_by_name = ? WHERE organization_id = ? AND id = ? AND removed_at IS NULL", params: [now, input.actor.actorName ?? "Manager", input.organizationId, document.id] },
    audit(ids, input.organizationId, document.id, "equipment_document.removed", input.actor, now, { assetId: asset.id, title: document.title }),
  ]);
}
