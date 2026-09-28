import { createStore, onboardVendor, createWorkOrder, OpsDomainError, type OpsCommandServices } from "./commands";
import { applyStoreEquipmentTemplates } from "./setup-commands";
import { parseCsv, previewImport, type ImportEntity } from "./import-preview";
import { communicationAudit, evidenceDigest, evidenceFence } from "./email-intake";
import type { OpsRepository, OpsStatement } from "./repository";
import type { ActorContext, WorkOrderPriority } from "./types";

const normal = (value: string) => value.trim().toLowerCase();
export async function importReferences(repository: OpsRepository, org: string, text: string) {
  let parsed: string[][];
  try { parsed = parseCsv(text); } catch (error) { throw new OpsDomainError("VALIDATION", error instanceof Error ? error.message : "Invalid CSV"); }
  const [headers = [], ...rows] = parsed;
  if (rows.length > 100) throw new OpsDomainError("VALIDATION", "Import up to 100 rows per file. Split larger files into batches.");
  const values = (key: string) => [...new Set(rows.map(row => normal(row[headers.map(normal).indexOf(key)] ?? "")).filter(Boolean))];
  const [references, config, equipmentTemplates] = await Promise.all([
    repository.readImportReferences(org, values("store_number"), values("vendor_code"), values("name")),
    repository.readOnboardingConfiguration(org), repository.listEquipmentTemplates(org),
  ]);
  return { ...references, regions: config.regions, equipmentTemplates };
}

/** Build through the ordinary commands, then commit the complete batch and replay fence together. */
export async function applyImport(svc: OpsCommandServices, input: { organizationId: string; entity: ImportEntity; text: string; actor: ActorContext }) {
  const { organizationId: org, actor } = input, repository = svc.repository;
  if (actor.organizationId !== org || actor.actorType !== "user" || !actor.actorId) throw new OpsDomainError("FORBIDDEN", "Company setup access required");
  const member = await repository.getMembership(org, actor.actorId);
  const grants = await repository.listScopeGrantsForMembership(org, actor.actorId);
  if (member?.status !== "active" || member.role !== "facilities_admin" || !grants.some(g => g.scopeKind === "organization" && g.scopeId === org)) throw new OpsDomainError("FORBIDDEN", "Companywide facilities access required");
  const digest = await evidenceDigest(`${input.entity}:${input.text}`), key = `import:${digest}`;
  if (await repository.getIdempotencyKey(org, key)) return { imported: parseCsv(input.text).length - 1, replayed: true };
  const references = await importReferences(repository, org, input.text);
  let preview;
  try { preview = previewImport(input.entity, input.text, references, org); } catch (error) { throw new OpsDomainError("VALIDATION", error instanceof Error ? error.message : "Invalid CSV"); }
  if (!preview.rows.length || preview.summary.error) throw new OpsDomainError("VALIDATION", "Correct every error before importing. No records were saved.");
  const statements: OpsStatement[] = [], now = svc.clock?.now() ?? new Date().toISOString();
  const buffered = new Proxy(repository, { get(target, property) {
    if (property === "atomicWrite") return async (batch: readonly OpsStatement[]) => { statements.push(...batch); };
    const value = Reflect.get(target, property); return typeof value === "function" ? value.bind(target) : value;
  } });
  const commands = { ...svc, repository: buffered, clock: { now: () => now } };
  const records: string[] = [];
  if (input.entity === "equipment") {
    const groups = new Map<string, Array<{ templateId: string; quantity: number; namePrefix?: string; locationNotes?: string }>>();
    for (const row of preview.rows) {
      const v = row.values, store = references.stores.find(s => normal(s.storeNumber) === normal(v.store_number))!;
      const template = references.equipmentTemplates.find(t => normal(t.id) === normal(v.equipment_type) || normal(t.name) === normal(v.equipment_type))!;
      const selections = groups.get(store.id) ?? [];
      selections.push({ templateId: template.id, quantity: Number(v.quantity), namePrefix: v.name_prefix, locationNotes: v.location_notes }); groups.set(store.id, selections);
    }
    for (const [storeId, selections] of groups) records.push(...(await applyStoreEquipmentTemplates(commands, { organizationId: org, storeId, selections, actor })).map(a => a.id));
  } else for (const row of preview.rows) {
    const v = row.values;
    if (input.entity === "stores") {
      const region = references.regions.find(r => normal(r.code) === normal(v.region_code));
      const store = await createStore(commands, { organizationId: org, storeNumber: v.store_number, name: v.name, address1: v.address_1, address2: v.address_2, city: v.city, state: v.state, postalCode: v.postal_code, regionId: region?.id, aliases: v.aliases.split(";").filter(Boolean), locationPolicyEnabled: false, actor });
      records.push(store.id);
    } else if (input.entity === "vendors") {
      const vendor = await onboardVendor(commands, { organizationId: org, code: v.vendor_code, name: v.name, dispatchEmail: v.dispatch_email, dispatchPhone: v.dispatch_phone, specialties: v.specialties.split(";").filter(Boolean).map(name => ({ canonicalKey: normal(name).replaceAll(" ", "_"), displayName: name.trim() })), coverage: v.coverage === "all" ? [{ scopeKind: "organization", scopeId: org }] : v.coverage.split(";").map(code => ({ scopeKind: "region", scopeId: references.regions.find(r => normal(r.code) === normal(code))!.id })), actor });
      records.push(vendor.id);
    } else {
      const store = references.stores.find(s => normal(s.storeNumber) === normal(v.store_number))!;
      const work = await createWorkOrder(commands, { organizationId: org, storeId: store.id, problem: v.problem, priority: (v.priority || "routine") as WorkOrderPriority, accountableParty: "Facilities coordinator", nextAction: v.next_action || "Review imported work and choose who handles it", dueAt: v.due_at || undefined, actor });
      records.push(work.id);
      statements.push(communicationAudit(org, work.id, "work_order.imported", actor, now, { sourceReference: v.source_reference || undefined, sourceRow: row.rowNumber }, "work_order"));
    }
  }
  statements.push(evidenceFence(org, key, digest, now), communicationAudit(org, digest, "import.applied", actor, now, { entity: input.entity, rowCount: preview.rows.length, records, sourceRows: preview.rows.map(r => ({ row: r.rowNumber, sourceReference: r.values.source_reference })) }, "import"));
  try { await repository.atomicWrite(statements); } catch (error) {
    if (await repository.getIdempotencyKey(org, key)) return { imported: preview.rows.length, replayed: true };
    throw error;
  }
  return { imported: preview.rows.length, replayed: false };
}
