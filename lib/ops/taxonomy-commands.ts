import { OpsDomainError, type OpsClock, type OpsCommandServices, type OpsIdSource } from "./commands";
import type { OpsStatement } from "./repository";
import type { ActorContext, ComponentTemplate, EquipmentTemplate, OpsId, TaxonomyNode } from "./types";

const systemClock: OpsClock = { now: () => new Date().toISOString() };
const randomIds: OpsIdSource = { next: (prefix) => `${prefix}-${crypto.randomUUID()}` };

function services(input: OpsCommandServices) { return { repository: input.repository, clock: input.clock ?? systemClock, ids: input.ids ?? randomIds }; }
function required(value: string, label: string, max = 120) { const clean = value.trim(); if (!clean) throw new OpsDomainError("VALIDATION", `${label} is required`); if (clean.length > max) throw new OpsDomainError("VALIDATION", `${label} is too long`); return clean; }
function assertActor(actor: ActorContext, organizationId: OpsId) { if (actor.organizationId !== organizationId) throw new OpsDomainError("FORBIDDEN", "Actor organization does not match command organization"); }
function insert(table: string, values: Record<string, unknown>): OpsStatement { const entries = Object.entries(values).filter(([, value]) => value !== undefined); return { sql: `INSERT INTO ${table} (${entries.map(([key]) => key).join(", ")}) VALUES (${entries.map(() => "?").join(", ")})`, params: entries.map(([, value]) => value) }; }
function update(table: string, values: Record<string, unknown>, where: Record<string, unknown>): OpsStatement { const set = Object.entries(values); const filters = Object.entries(where); return { sql: `UPDATE ${table} SET ${set.map(([key]) => `${key} = ?`).join(", ")} WHERE ${filters.map(([key]) => `${key} = ?`).join(" AND ")}`, params: [...set.map(([, value]) => value), ...filters.map(([, value]) => value)] }; }
function slug(value: string) { return value.toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80); }
function audit(input: { organizationId: OpsId; nodeId: OpsId; eventType: string; actor: ActorContext; occurredAt: string; payload: unknown; ids: OpsIdSource }): OpsStatement[] { const payloadJson = JSON.stringify(input.payload); return [insert("ops_audit_events", { id: input.ids.next("audit"), organization_id: input.organizationId, aggregate_type: "taxonomy_node", aggregate_id: input.nodeId, event_type: input.eventType, actor_type: input.actor.actorType, actor_id: input.actor.actorId, actor_name: input.actor.actorName, occurred_at: input.occurredAt, payload_json: payloadJson }), insert("ops_outbox_messages", { id: input.ids.next("outbox"), organization_id: input.organizationId, topic: `ops.${input.eventType}`, aggregate_type: "taxonomy_node", aggregate_id: input.nodeId, payload_json: payloadJson, status: "pending", available_at: input.occurredAt, created_at: input.occurredAt, attempt_count: 0 })]; }

export interface CreateTaxonomyNodeInput { organizationId: OpsId; nodeKind: "category" | "group"; name: string; parentNodeId?: OpsId; actor: ActorContext; }

export async function createTaxonomyNode(svc: OpsCommandServices, input: CreateTaxonomyNodeInput): Promise<TaxonomyNode> {
  const { repository, clock, ids } = services(svc);
  assertActor(input.actor, input.organizationId);
  const nodes = await repository.listTaxonomyNodes(input.organizationId);
  const name = required(input.name, input.nodeKind === "category" ? "Service area name" : "Equipment group name");
  const parent = input.nodeKind === "group" ? nodes.find((row) => row.id === input.parentNodeId && row.active) : undefined;
  if (input.nodeKind === "group" && !parent) throw new OpsDomainError("VALIDATION", "Choose where this equipment group belongs");
  if (input.nodeKind === "category" && input.parentNodeId) throw new OpsDomainError("VALIDATION", "Service areas cannot be nested");
  if (nodes.some((row) => row.active && row.parentNodeId === parent?.id && row.name.toLocaleLowerCase("en-US") === name.toLocaleLowerCase("en-US"))) throw new OpsDomainError("CONFLICT", "That name is already used in this location");
  let canonicalKey = input.nodeKind === "category" ? slug(name) : undefined;
  if (canonicalKey && nodes.some((row) => row.canonicalKey === canonicalKey)) canonicalKey = `${canonicalKey}_${nodes.filter((row) => row.canonicalKey?.startsWith(canonicalKey!)).length + 1}`;
  const now = clock.now();
  const node: TaxonomyNode = { id: ids.next("taxonomy-node"), organizationId: input.organizationId, parentNodeId: parent?.id, nodeKind: input.nodeKind, canonicalKey, name, aliases: [], depth: parent ? parent.depth + 1 : 0, sortOrder: nodes.filter((row) => row.parentNodeId === parent?.id).length, active: true, createdAt: now };
  await repository.atomicWrite([insert("ops_taxonomy_nodes", { id: node.id, organization_id: node.organizationId, parent_node_id: node.parentNodeId, node_kind: node.nodeKind, canonical_key: node.canonicalKey, name: node.name, aliases_json: "[]", depth: node.depth, sort_order: node.sortOrder, active: 1, created_at: node.createdAt }), ...audit({ organizationId: input.organizationId, nodeId: node.id, eventType: "taxonomy_node.created", actor: input.actor, occurredAt: now, payload: { nodeKind: node.nodeKind, name: node.name, parentNodeId: node.parentNodeId }, ids })]);
  return node;
}

export interface UpdateTaxonomyNodeInput { organizationId: OpsId; nodeId: OpsId; name: string; parentNodeId?: OpsId; active: boolean; actor: ActorContext; }

export async function updateTaxonomyNode(svc: OpsCommandServices, input: UpdateTaxonomyNodeInput): Promise<TaxonomyNode> {
  const { repository, clock, ids } = services(svc);
  assertActor(input.actor, input.organizationId);
  const nodes = await repository.listTaxonomyNodes(input.organizationId);
  const node = nodes.find((row) => row.id === input.nodeId);
  if (!node) throw new OpsDomainError("NOT_FOUND", "Service area or equipment group was not found");
  const name = required(input.name, node.nodeKind === "category" ? "Service area name" : "Equipment group name");
  const parent = node.nodeKind === "group" ? nodes.find((row) => row.id === input.parentNodeId && row.active) : undefined;
  if (node.nodeKind === "group" && !parent) throw new OpsDomainError("VALIDATION", "Choose where this equipment group belongs");
  if (parent?.id === node.id) throw new OpsDomainError("VALIDATION", "An equipment group cannot contain itself");
  let cursor = parent;
  while (cursor) { if (cursor.id === node.id) throw new OpsDomainError("VALIDATION", "An equipment group cannot be moved inside one of its own groups"); cursor = cursor.parentNodeId ? nodes.find((row) => row.id === cursor!.parentNodeId) : undefined; }
  if (node.nodeKind === "group" && node.parentNodeId !== parent?.id && nodes.some((row) => row.parentNodeId === node.id)) throw new OpsDomainError("CONFLICT", "Move the groups inside this item before moving it");
  if (!input.active && nodes.some((row) => row.active && row.parentNodeId === node.id)) throw new OpsDomainError("CONFLICT", "Move or deactivate the groups inside this item first");
  if (nodes.some((row) => row.id !== node.id && row.active && row.parentNodeId === parent?.id && row.name.toLocaleLowerCase("en-US") === name.toLocaleLowerCase("en-US"))) throw new OpsDomainError("CONFLICT", "That name is already used in this location");
  const now = clock.now();
  const updated = { ...node, name, parentNodeId: parent?.id, depth: parent ? parent.depth + 1 : 0, active: input.active };
  await repository.atomicWrite([update("ops_taxonomy_nodes", { name: updated.name, parent_node_id: updated.parentNodeId ?? null, depth: updated.depth, active: updated.active ? 1 : 0 }, { organization_id: input.organizationId, id: node.id }), ...audit({ organizationId: input.organizationId, nodeId: node.id, eventType: "taxonomy_node.updated", actor: input.actor, occurredAt: now, payload: { before: { name: node.name, parentNodeId: node.parentNodeId, active: node.active }, after: { name: updated.name, parentNodeId: updated.parentNodeId, active: updated.active } }, ids })]);
  return updated;
}

export interface CreateEquipmentTemplateInput { organizationId: OpsId; taxonomyNodeId: OpsId; name: string; defaultExpectedLifeYears?: number; components: string[]; actor: ActorContext; }

export async function createEquipmentTemplate(svc: OpsCommandServices, input: CreateEquipmentTemplateInput): Promise<{ template: EquipmentTemplate; components: ComponentTemplate[] }> {
  const { repository, clock, ids } = services(svc);
  assertActor(input.actor, input.organizationId);
  const [nodes, templates] = await Promise.all([repository.listTaxonomyNodes(input.organizationId), repository.listEquipmentTemplates(input.organizationId)]);
  const group = nodes.find((row) => row.id === input.taxonomyNodeId && row.nodeKind === "group" && row.active);
  if (!group) throw new OpsDomainError("VALIDATION", "Choose an active equipment group");
  const name = required(input.name, "Equipment type name");
  if (templates.some((row) => row.taxonomyNodeId === group.id && row.name.toLocaleLowerCase("en-US") === name.toLocaleLowerCase("en-US"))) throw new OpsDomainError("CONFLICT", "That equipment type already exists in this group");
  const life = input.defaultExpectedLifeYears;
  if (life !== undefined && (!Number.isSafeInteger(life) || life < 1 || life > 100)) throw new OpsDomainError("VALIDATION", "Expected life must be a whole number from 1 to 100");
  const now = clock.now();
  const template: EquipmentTemplate = { id: ids.next("equipment-template"), organizationId: input.organizationId, taxonomyNodeId: group.id, name, defaultExpectedLifeYears: life, active: true, createdAt: now };
  const componentRows: ComponentTemplate[] = [];
  const byPath = new Map<string, ComponentTemplate>();
  for (const rawPath of input.components) {
    const names = rawPath.split(">").map((part) => part.trim()).filter(Boolean);
    if (!names.length || names.length > 8) continue;
    let parent: ComponentTemplate | undefined;
    for (let index = 0; index < names.length; index += 1) {
      const path = names.slice(0, index + 1).map((part) => part.toLocaleLowerCase("en-US")).join(" > ");
      let component = byPath.get(path);
      if (!component) {
        component = { id: ids.next("component-template"), organizationId: input.organizationId, equipmentTemplateId: template.id, parentComponentTemplateId: parent?.id, name: required(names[index], "Component name"), sortOrder: componentRows.length, createdAt: now };
        componentRows.push(component);
        byPath.set(path, component);
      }
      parent = component;
    }
  }
  const statements: OpsStatement[] = [insert("ops_equipment_templates", { id: template.id, organization_id: template.organizationId, taxonomy_node_id: template.taxonomyNodeId, name: template.name, default_expected_life_years: template.defaultExpectedLifeYears, active: 1, created_at: template.createdAt }), ...componentRows.map((row) => insert("ops_component_templates", { id: row.id, organization_id: row.organizationId, equipment_template_id: row.equipmentTemplateId, parent_component_template_id: row.parentComponentTemplateId, name: row.name, sort_order: row.sortOrder, created_at: row.createdAt })), ...audit({ organizationId: input.organizationId, nodeId: template.id, eventType: "equipment_template.created", actor: input.actor, occurredAt: now, payload: { taxonomyNodeId: group.id, name: template.name, componentCount: componentRows.length }, ids })];
  await repository.atomicWrite(statements);
  return { template, components: componentRows };
}
