import { OpsDomainError, type OpsClock, type OpsCommandServices, type OpsIdSource } from "./commands";
import type { OpsStatement } from "./repository";
import type {
  ActorContext,
  Asset,
  AssetComponent,
  IsoDateTime,
  OpsId,
  PmOccurrence,
  PmPlan,
} from "./types";

const DAY_MS = 86_400_000;
const defaultClock: OpsClock = { now: () => new Date().toISOString() };
const defaultIds: OpsIdSource = { next: (prefix) => `${prefix}-${crypto.randomUUID()}` };

function services(input: OpsCommandServices) {
  return {
    repository: input.repository,
    clock: input.clock ?? defaultClock,
    ids: input.ids ?? defaultIds,
  };
}

function required(value: string, label: string, max = 180) {
  const clean = value.trim();
  if (!clean) throw new OpsDomainError("VALIDATION", `${label} is required`);
  if (clean.length > max) throw new OpsDomainError("VALIDATION", `${label} is too long`);
  return clean;
}

function optional(value: string | undefined, label: string, max = 180) {
  const clean = value?.trim();
  if (!clean) return undefined;
  if (clean.length > max) throw new OpsDomainError("VALIDATION", `${label} is too long`);
  return clean;
}

function iso(value: IsoDateTime | undefined, label: string) {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new OpsDomainError("VALIDATION", `${label} is invalid`);
  return new Date(parsed).toISOString();
}

function positiveInteger(value: number, label: string, maximum: number) {
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new OpsDomainError("VALIDATION", `${label} must be a whole number from 1 to ${maximum}`);
  }
  return value;
}

function assertActorOrganization(actor: ActorContext, organizationId: OpsId) {
  if (actor.organizationId !== organizationId) {
    throw new OpsDomainError("FORBIDDEN", "Actor organization does not match command organization");
  }
}

function insert(table: string, values: Record<string, unknown>): OpsStatement {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined);
  return {
    sql: `INSERT INTO ${table} (${entries.map(([key]) => key).join(", ")}) VALUES (${entries.map(() => "?").join(", ")})`,
    params: entries.map(([, value]) => value),
  };
}

function auditAndOutbox(input: {
  organizationId: OpsId;
  aggregateType: string;
  aggregateId: OpsId;
  eventType: string;
  actor: ActorContext;
  occurredAt: IsoDateTime;
  payload: unknown;
  ids: OpsIdSource;
}): OpsStatement[] {
  const payloadJson = JSON.stringify(input.payload);
  return [
    insert("ops_audit_events", {
      id: input.ids.next("audit"),
      organization_id: input.organizationId,
      aggregate_type: input.aggregateType,
      aggregate_id: input.aggregateId,
      event_type: input.eventType,
      actor_type: input.actor.actorType,
      actor_id: input.actor.actorId,
      actor_name: input.actor.actorName,
      occurred_at: input.occurredAt,
      payload_json: payloadJson,
    }),
    insert("ops_outbox_messages", {
      id: input.ids.next("outbox"),
      organization_id: input.organizationId,
      topic: `ops.${input.eventType}`,
      aggregate_type: input.aggregateType,
      aggregate_id: input.aggregateId,
      payload_json: payloadJson,
      status: "pending",
      available_at: input.occurredAt,
      created_at: input.occurredAt,
      attempt_count: 0,
    }),
  ];
}

const assetStatuses = new Set<Asset["status"]>([
  "operational",
  "watch",
  "out_of_service",
  "retired",
]);

export interface CreateAssetInput {
  organizationId: OpsId;
  storeId: OpsId;
  categoryKey: string;
  taxonomyNodeId?: OpsId;
  groupPath?: string[];
  assetTag: string;
  name: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  supplier?: string;
  installedAt?: IsoDateTime;
  expectedLifeYears?: number;
  warrantyEndsAt?: IsoDateTime;
  replacementEstimateMinor?: number;
  currency?: string;
  status?: Asset["status"];
  actor: ActorContext;
}

export async function createAsset(svc: OpsCommandServices, input: CreateAssetInput): Promise<Asset> {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const store = await repository.getStore(input.organizationId, input.storeId);
  if (!store) throw new OpsDomainError("NOT_FOUND", "Store not found in organization");

  const categoryKey = required(input.categoryKey, "Service area", 80).toLocaleLowerCase("en-US");
  const taxonomyNodes = await repository.listTaxonomyNodes(input.organizationId);
  const category = taxonomyNodes.find(
    (node) => node.nodeKind === "category" && node.active && node.canonicalKey === categoryKey,
  );
  if (!category) throw new OpsDomainError("VALIDATION", "Choose an active company service area");
  const taxonomyById = new Map(taxonomyNodes.map((node) => [node.id, node]));
  const nodePath = (node: (typeof taxonomyNodes)[number]) => {
    const path = [node];
    const seen = new Set([node.id]);
    let current = node;
    while (current.parentNodeId) {
      const parent = taxonomyById.get(current.parentNodeId);
      if (!parent || seen.has(parent.id)) break;
      path.unshift(parent);
      seen.add(parent.id);
      current = parent;
    }
    return path;
  };
  let groupPath = (input.groupPath ?? []).map((item) => required(item, "Group name", 80));
  if (groupPath.length > 8) throw new OpsDomainError("VALIDATION", "Group path cannot exceed eight levels");
  let taxonomyNodeId = category.id;
  const normalizedPath = (path: string[]) => path.map((item) => item.toLocaleLowerCase("en-US")).join("\u0000");
  if (input.taxonomyNodeId) {
    const selectedNode = await repository.getTaxonomyNode(input.organizationId, input.taxonomyNodeId);
    if (!selectedNode || !selectedNode.active) {
      throw new OpsDomainError("VALIDATION", "Choose an active company classification");
    }
    const path = nodePath(selectedNode);
    if (!path.some((node) => node.id === category.id)) {
      throw new OpsDomainError("VALIDATION", "Classification must belong to the selected service area");
    }
    const selectedGroups = path.filter((node) => node.nodeKind === "group").map((node) => node.name);
    if (groupPath.length && normalizedPath(selectedGroups) !== normalizedPath(groupPath)) {
      throw new OpsDomainError("VALIDATION", "Group path does not match the selected company classification");
    }
    groupPath = selectedGroups;
    taxonomyNodeId = selectedNode.id;
  } else if (groupPath.length) {
    const selectedNode = taxonomyNodes.find((node) => {
      if (!node.active || node.nodeKind !== "group") return false;
      const path = nodePath(node);
      return path.some((item) => item.id === category.id) &&
        normalizedPath(path.filter((item) => item.nodeKind === "group").map((item) => item.name)) === normalizedPath(groupPath);
    });
    if (!selectedNode) {
      throw new OpsDomainError("VALIDATION", "Choose a company-defined group path for this service area");
    }
    taxonomyNodeId = selectedNode.id;
  }

  const assetTag = required(input.assetTag, "Equipment tag", 80);
  const detail = await repository.getStoreDetail(
    { organizationId: input.organizationId, storeIds: [store.id] },
    store.id,
  );
  if (detail?.assets.some((asset) => asset.assetTag.toLocaleLowerCase("en-US") === assetTag.toLocaleLowerCase("en-US"))) {
    throw new OpsDomainError("CONFLICT", "Equipment tag is already in use at this store");
  }

  const installedAt = iso(input.installedAt, "Install date");
  const warrantyEndsAt = iso(input.warrantyEndsAt, "Warranty end date");
  if (installedAt && warrantyEndsAt && Date.parse(warrantyEndsAt) < Date.parse(installedAt)) {
    throw new OpsDomainError("VALIDATION", "Warranty end date cannot be before the install date");
  }
  const expectedLifeYears = input.expectedLifeYears === undefined
    ? undefined
    : positiveInteger(input.expectedLifeYears, "Expected life", 100);
  if (input.replacementEstimateMinor !== undefined &&
      (!Number.isInteger(input.replacementEstimateMinor) || input.replacementEstimateMinor < 0)) {
    throw new OpsDomainError("VALIDATION", "Replacement estimate must be a non-negative minor-unit amount");
  }
  const status = input.status ?? "operational";
  if (!assetStatuses.has(status)) throw new OpsDomainError("VALIDATION", "Choose a supported equipment status");

  const now = clock.now();
  const id = ids.next("asset");
  const asset: Asset = {
    id,
    organizationId: input.organizationId,
    storeId: store.id,
    categoryKey,
    taxonomyNodeId,
    groupPath,
    assetTag,
    name: required(input.name, "Equipment name"),
    manufacturer: optional(input.manufacturer, "Manufacturer"),
    model: optional(input.model, "Model"),
    serialNumber: optional(input.serialNumber, "Serial number"),
    supplier: optional(input.supplier, "Supplier"),
    installedAt,
    expectedLifeYears,
    warrantyEndsAt,
    replacementEstimate: input.replacementEstimateMinor === undefined
      ? undefined
      : { amountMinor: input.replacementEstimateMinor, currency: input.currency?.trim() || "USD" },
    status,
    createdAt: now,
  };
  await repository.atomicWrite([
    insert("ops_assets", {
      id: asset.id,
      organization_id: asset.organizationId,
      store_id: asset.storeId,
      category_key: asset.categoryKey,
      taxonomy_node_id: asset.taxonomyNodeId,
      group_path_json: JSON.stringify(asset.groupPath),
      asset_tag: asset.assetTag,
      name: asset.name,
      manufacturer: asset.manufacturer,
      model: asset.model,
      serial_number: asset.serialNumber,
      supplier: asset.supplier,
      installed_at: asset.installedAt,
      expected_life_years: asset.expectedLifeYears,
      warranty_ends_at: asset.warrantyEndsAt,
      replacement_estimate_minor: asset.replacementEstimate?.amountMinor,
      replacement_currency: asset.replacementEstimate?.currency,
      status: asset.status,
      created_at: asset.createdAt,
    }),
    ...auditAndOutbox({
      organizationId: input.organizationId,
      aggregateType: "asset",
      aggregateId: asset.id,
      eventType: "asset.created",
      actor: input.actor,
      occurredAt: now,
      payload: {
        storeId: asset.storeId,
        categoryKey: asset.categoryKey,
        groupPath: asset.groupPath,
        assetTag: asset.assetTag,
        status: asset.status,
      },
      ids,
    }),
  ]);
  return asset;
}

export interface ApplyStoreEquipmentTemplateInput { organizationId: OpsId; storeId: OpsId; selections: Array<{ templateId: OpsId; quantity: number }>; actor: ActorContext; }

export async function applyStoreEquipmentTemplates(svc: OpsCommandServices, input: ApplyStoreEquipmentTemplateInput): Promise<Asset[]> {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const [store, nodes, templates, detail] = await Promise.all([repository.getStore(input.organizationId, input.storeId), repository.listTaxonomyNodes(input.organizationId), repository.listEquipmentTemplates(input.organizationId), repository.getStoreDetail({ organizationId: input.organizationId, storeIds: [input.storeId] }, input.storeId)]);
  if (!store || !detail) throw new OpsDomainError("NOT_FOUND", "Store not found in organization");
  const selected = input.selections.filter((row) => row.quantity > 0);
  if (!selected.length) throw new OpsDomainError("VALIDATION", "Select at least one equipment type");
  if (selected.length > 100) throw new OpsDomainError("VALIDATION", "Too many equipment selections were submitted at once");
  const byNode = new Map(nodes.map((node) => [node.id, node]));
  const usedTags = new Set(detail.assets.map((asset) => asset.assetTag.toLocaleLowerCase("en-US")));
  const now = clock.now();
  const assets: Asset[] = [];
  const statements: OpsStatement[] = [];
  for (const selection of selected) {
    if (!Number.isSafeInteger(selection.quantity) || selection.quantity < 1 || selection.quantity > 50) throw new OpsDomainError("VALIDATION", "Each equipment quantity must be from 1 to 50");
    const template = templates.find((row) => row.id === selection.templateId && row.active);
    if (!template) throw new OpsDomainError("VALIDATION", "Choose an active company equipment type");
    const leaf = byNode.get(template.taxonomyNodeId);
    if (!leaf?.active) throw new OpsDomainError("VALIDATION", "The equipment type belongs to an inactive group");
    const path: typeof nodes = [];
    let cursor: typeof leaf | undefined = leaf;
    while (cursor) { path.unshift(cursor); cursor = cursor.parentNodeId ? byNode.get(cursor.parentNodeId) : undefined; }
    const category = path.find((row) => row.nodeKind === "category");
    if (!category?.canonicalKey) throw new OpsDomainError("CONFLICT", "Equipment group has no service area");
    const componentTemplates = await repository.listComponentTemplates(input.organizationId, template.id);
    for (let index = 1; index <= selection.quantity; index += 1) {
      const prefix = `${store.storeNumber}-${category.canonicalKey.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase() || "EQ"}`;
      let counter = 1;
      let tag = `${prefix}-${String(counter).padStart(2, "0")}`;
      while (usedTags.has(tag.toLocaleLowerCase("en-US"))) { counter += 1; tag = `${prefix}-${String(counter).padStart(2, "0")}`; }
      usedTags.add(tag.toLocaleLowerCase("en-US"));
      const asset: Asset = { id: ids.next("asset"), organizationId: input.organizationId, storeId: store.id, categoryKey: category.canonicalKey, taxonomyNodeId: leaf.id, groupPath: path.filter((row) => row.nodeKind === "group").map((row) => row.name), assetTag: tag, name: selection.quantity > 1 ? `${template.name} ${index}` : template.name, expectedLifeYears: template.defaultExpectedLifeYears, status: "operational", createdAt: now };
      assets.push(asset);
      statements.push(insert("ops_assets", { id: asset.id, organization_id: asset.organizationId, store_id: asset.storeId, category_key: asset.categoryKey, taxonomy_node_id: asset.taxonomyNodeId, group_path_json: JSON.stringify(asset.groupPath), asset_tag: asset.assetTag, name: asset.name, expected_life_years: asset.expectedLifeYears, replacement_attributes_json: "{}", status: asset.status, created_at: asset.createdAt }));
      const componentIdByTemplate = new Map<string, string>();
      for (const componentTemplate of componentTemplates) {
        const componentId = ids.next("component");
        componentIdByTemplate.set(componentTemplate.id, componentId);
        statements.push(insert("ops_asset_components", { id: componentId, organization_id: input.organizationId, asset_id: asset.id, parent_component_id: componentTemplate.parentComponentTemplateId ? componentIdByTemplate.get(componentTemplate.parentComponentTemplateId) : undefined, name: componentTemplate.name, created_at: now }));
      }
    }
  }
  statements.push(...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "store", aggregateId: store.id, eventType: "store.equipment_templates_applied", actor: input.actor, occurredAt: now, payload: { selections: selected, createdAssetIds: assets.map((asset) => asset.id) }, ids }));
  await repository.atomicWrite(statements);
  return assets;
}

export interface AddAssetComponentInput {
  organizationId: OpsId;
  assetId: OpsId;
  parentComponentId?: OpsId;
  name: string;
  partNumber?: string;
  serialNumber?: string;
  installedAt?: IsoDateTime;
  warrantyEndsAt?: IsoDateTime;
  actor: ActorContext;
}

export async function addAssetComponent(
  svc: OpsCommandServices,
  input: AddAssetComponentInput,
): Promise<AssetComponent> {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const asset = await repository.getAsset(input.organizationId, input.assetId);
  if (!asset) throw new OpsDomainError("NOT_FOUND", "Equipment not found in organization");
  if (input.parentComponentId) {
    const parent = await repository.getComponent(input.organizationId, input.parentComponentId);
    if (!parent || parent.assetId !== asset.id) {
      throw new OpsDomainError("VALIDATION", "Parent component must belong to this equipment record");
    }
  }
  const installedAt = iso(input.installedAt, "Install date");
  const warrantyEndsAt = iso(input.warrantyEndsAt, "Warranty end date");
  if (installedAt && warrantyEndsAt && Date.parse(warrantyEndsAt) < Date.parse(installedAt)) {
    throw new OpsDomainError("VALIDATION", "Warranty end date cannot be before the install date");
  }

  const now = clock.now();
  const component: AssetComponent = {
    id: ids.next("component"),
    organizationId: input.organizationId,
    assetId: asset.id,
    parentComponentId: input.parentComponentId,
    name: required(input.name, "Component name"),
    partNumber: optional(input.partNumber, "Part number"),
    serialNumber: optional(input.serialNumber, "Serial number"),
    installedAt,
    warrantyEndsAt,
    createdAt: now,
  };
  await repository.atomicWrite([
    insert("ops_asset_components", {
      id: component.id,
      organization_id: component.organizationId,
      asset_id: component.assetId,
      parent_component_id: component.parentComponentId,
      name: component.name,
      part_number: component.partNumber,
      serial_number: component.serialNumber,
      installed_at: component.installedAt,
      warranty_ends_at: component.warrantyEndsAt,
      created_at: component.createdAt,
    }),
    ...auditAndOutbox({
      organizationId: input.organizationId,
      aggregateType: "asset_component",
      aggregateId: component.id,
      eventType: "asset.component_added",
      actor: input.actor,
      occurredAt: now,
      payload: {
        assetId: asset.id,
        parentComponentId: component.parentComponentId,
        name: component.name,
      },
      ids,
    }),
  ]);
  return component;
}

export interface CreatePmPlanInput {
  organizationId: OpsId;
  name: string;
  storeId: OpsId;
  assetId?: OpsId;
  categoryKey?: string;
  cadenceDays: number;
  completionWindowDays: number;
  firstDueAt: IsoDateTime;
  actor: ActorContext;
}

export interface CreatedPmPlan {
  plan: PmPlan;
  firstOccurrence: PmOccurrence;
}

export async function createPmPlanWithFirstOccurrence(
  svc: OpsCommandServices,
  input: CreatePmPlanInput,
): Promise<CreatedPmPlan> {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const store = await repository.getStore(input.organizationId, input.storeId);
  if (!store) throw new OpsDomainError("NOT_FOUND", "Store not found in organization");
  const asset = input.assetId ? await repository.getAsset(input.organizationId, input.assetId) : undefined;
  if (input.assetId && (!asset || asset.storeId !== store.id)) {
    throw new OpsDomainError("VALIDATION", "Equipment must belong to the selected store and organization");
  }
  const cadenceDays = positiveInteger(input.cadenceDays, "Cadence", 3_650);
  const completionWindowDays = positiveInteger(input.completionWindowDays, "Completion window", 365);
  if (completionWindowDays >= cadenceDays) {
    throw new OpsDomainError("VALIDATION", "Completion window must be shorter than the cadence");
  }
  const firstDueAt = iso(input.firstDueAt, "First due date");
  if (!firstDueAt) throw new OpsDomainError("VALIDATION", "First due date is required");
  const categoryKey = optional(input.categoryKey, "Service area", 80)?.toLocaleLowerCase("en-US") ?? asset?.categoryKey;
  if (categoryKey) {
    const taxonomyNodes = await repository.listTaxonomyNodes(input.organizationId);
    const category = taxonomyNodes.find(
      (node) => node.nodeKind === "category" && node.active && node.canonicalKey === categoryKey,
    );
    if (!category) throw new OpsDomainError("VALIDATION", "Choose an active company service area");
    if (asset && asset.categoryKey !== categoryKey) {
      throw new OpsDomainError("VALIDATION", "PM service area must match the selected equipment");
    }
  }

  const now = clock.now();
  const dueMs = Date.parse(firstDueAt);
  const windowMs = completionWindowDays * DAY_MS;
  const windowStartsAt = new Date(dueMs - windowMs).toISOString();
  const windowEndsAt = new Date(dueMs + windowMs).toISOString();
  const nowMs = Date.parse(now);
  const status: PmOccurrence["status"] = nowMs < Date.parse(windowStartsAt)
    ? "scheduled"
    : nowMs <= Date.parse(windowEndsAt)
      ? "due"
      : "missed";

  const plan: PmPlan = {
    id: ids.next("pm-plan"),
    organizationId: input.organizationId,
    name: required(input.name, "PM plan name"),
    storeId: store.id,
    assetId: asset?.id,
    categoryKey,
    cadenceDays,
    completionWindowDays,
    active: true,
    createdAt: now,
  };
  const firstOccurrence: PmOccurrence = {
    id: ids.next("pm-occurrence"),
    organizationId: input.organizationId,
    planId: plan.id,
    storeId: store.id,
    assetId: asset?.id,
    dueAt: firstDueAt,
    windowStartsAt,
    windowEndsAt,
    status,
  };

  await repository.atomicWrite([
    insert("ops_pm_plans", {
      id: plan.id,
      organization_id: plan.organizationId,
      name: plan.name,
      store_id: plan.storeId,
      asset_id: plan.assetId,
      category_key: plan.categoryKey,
      cadence_days: plan.cadenceDays,
      completion_window_days: plan.completionWindowDays,
      active: 1,
      created_at: plan.createdAt,
    }),
    insert("ops_pm_occurrences", {
      id: firstOccurrence.id,
      organization_id: firstOccurrence.organizationId,
      plan_id: firstOccurrence.planId,
      store_id: firstOccurrence.storeId,
      asset_id: firstOccurrence.assetId,
      due_at: firstOccurrence.dueAt,
      window_starts_at: firstOccurrence.windowStartsAt,
      window_ends_at: firstOccurrence.windowEndsAt,
      status: firstOccurrence.status,
    }),
    ...auditAndOutbox({
      organizationId: input.organizationId,
      aggregateType: "pm_plan",
      aggregateId: plan.id,
      eventType: "pm.plan_created",
      actor: input.actor,
      occurredAt: now,
      payload: {
        storeId: plan.storeId,
        assetId: plan.assetId,
        cadenceDays: plan.cadenceDays,
        completionWindowDays: plan.completionWindowDays,
        firstOccurrenceId: firstOccurrence.id,
      },
      ids,
    }),
    ...auditAndOutbox({
      organizationId: input.organizationId,
      aggregateType: "pm_occurrence",
      aggregateId: firstOccurrence.id,
      eventType: "pm.occurrence_created",
      actor: input.actor,
      occurredAt: now,
      payload: {
        planId: plan.id,
        storeId: plan.storeId,
        assetId: plan.assetId,
        dueAt: firstOccurrence.dueAt,
        windowStartsAt: firstOccurrence.windowStartsAt,
        windowEndsAt: firstOccurrence.windowEndsAt,
        status: firstOccurrence.status,
      },
      ids,
    }),
  ]);
  return { plan, firstOccurrence };
}
