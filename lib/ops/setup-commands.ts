import { OpsDomainError, type OpsClock, type OpsCommandServices, type OpsIdSource } from "./commands";
import type { OpsStatement } from "./repository";
import type {
  ActorContext,
  Asset,
  AssetComponent,
  ChecklistTemplate,
  EquipmentTemplate,
  IsoDateTime,
  MaintenanceProgram,
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

function update(table: string, values: Record<string, unknown>, where: Record<string, unknown>): OpsStatement {
  const set = Object.entries(values);
  const filters = Object.entries(where);
  return {
    sql: `UPDATE ${table} SET ${set.map(([key]) => `${key} = ?`).join(", ")} WHERE ${filters.map(([key]) => `${key} = ?`).join(" AND ")}`,
    params: [...set.map(([, value]) => value), ...filters.map(([, value]) => value)],
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

function normalizedEquipmentType(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/^equipment-template-/, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function programAppliesToTemplate(program: MaintenanceProgram, template: EquipmentTemplate) {
  const accepted = new Set([
    template.id,
    normalizedEquipmentType(template.id),
    normalizedEquipmentType(template.name),
  ]);
  return program.applicableAssetTypes.some((value) => accepted.has(value) || accepted.has(normalizedEquipmentType(value)));
}

function occurrenceTiming(dueAt: IsoDateTime, windowDays: number, now: IsoDateTime) {
  const dueMs = Date.parse(dueAt);
  const windowMs = windowDays * DAY_MS;
  const windowStartsAt = new Date(dueMs - windowMs).toISOString();
  const windowEndsAt = new Date(dueMs + windowMs).toISOString();
  const nowMs = Date.parse(now);
  const status: PmOccurrence["status"] = nowMs < Date.parse(windowStartsAt)
    ? "scheduled"
    : nowMs <= Date.parse(windowEndsAt)
      ? "due"
      : "missed";
  return { windowStartsAt, windowEndsAt, status };
}

function nextProgramDueAt(program: MaintenanceProgram, now: IsoDateTime) {
  const cadenceMs = Math.max(1, program.frequencyDays) * DAY_MS;
  const windowMs = Math.max(0, program.dueWindowDays) * DAY_MS;
  let dueMs = Date.parse(program.scheduleAnchorAt ?? program.createdAt);
  const nowMs = Date.parse(now);
  if (!Number.isFinite(dueMs)) dueMs = nowMs + cadenceMs;
  if (dueMs + windowMs < nowMs) {
    const cycles = Math.ceil((nowMs - (dueMs + windowMs)) / cadenceMs);
    dueMs += Math.max(1, cycles) * cadenceMs;
  }
  return new Date(dueMs).toISOString();
}

function pmPlanStatements(plan: PmPlan, occurrence: PmOccurrence): OpsStatement[] {
  return [
    insert("ops_pm_plans", {
      id: plan.id,
      organization_id: plan.organizationId,
      name: plan.name,
      program_id: plan.programId,
      program_version: plan.programVersion,
      store_id: plan.storeId,
      asset_id: plan.assetId,
      asset_selection_rule: plan.assetSelectionRule,
      category_key: plan.categoryKey,
      cadence_days: plan.cadenceDays,
      completion_window_days: plan.completionWindowDays,
      effective_starts_at: plan.effectiveStartsAt,
      active: plan.active ? 1 : 0,
      created_at: plan.createdAt,
    }),
    insert("ops_pm_occurrences", {
      id: occurrence.id,
      organization_id: occurrence.organizationId,
      plan_id: occurrence.planId,
      store_id: occurrence.storeId,
      asset_id: occurrence.assetId,
      program_id: occurrence.programId,
      program_version: occurrence.programVersion,
      plan_version: occurrence.planVersion,
      due_at: occurrence.dueAt,
      window_starts_at: occurrence.windowStartsAt,
      window_ends_at: occurrence.windowEndsAt,
      status: occurrence.status,
      recurrence_key: occurrence.recurrenceKey,
      created_at: occurrence.createdAt,
    }),
  ];
}

function programPlanForAsset(input: {
  program: MaintenanceProgram;
  asset: Asset;
  dueAt: IsoDateTime;
  now: IsoDateTime;
  ids: OpsIdSource;
}) {
  const timing = occurrenceTiming(input.dueAt, input.program.dueWindowDays, input.now);
  const plan: PmPlan = {
    id: input.ids.next("pm-plan"),
    organizationId: input.program.organizationId,
    name: `${input.program.name} · ${input.asset.name}`,
    programId: input.program.id,
    programVersion: input.program.version,
    storeId: input.asset.storeId,
    assetId: input.asset.id,
    assetSelectionRule: `equipment_template:${input.program.applicableAssetTypes.join(",")}`,
    categoryKey: input.asset.categoryKey,
    cadenceDays: input.program.frequencyDays,
    completionWindowDays: input.program.dueWindowDays,
    effectiveStartsAt: input.now,
    active: true,
    createdAt: input.now,
  };
  const occurrence: PmOccurrence = {
    id: input.ids.next("pm-occurrence"),
    organizationId: input.program.organizationId,
    planId: plan.id,
    storeId: input.asset.storeId,
    assetId: input.asset.id,
    programId: input.program.id,
    programVersion: input.program.version,
    planVersion: 1,
    dueAt: input.dueAt,
    ...timing,
    recurrenceKey: input.dueAt.slice(0, 10),
    createdAt: input.now,
  };
  return { plan, occurrence };
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
  const [store, nodes, templates, detail, programs, existingPlans] = await Promise.all([
    repository.getStore(input.organizationId, input.storeId),
    repository.listTaxonomyNodes(input.organizationId),
    repository.listEquipmentTemplates(input.organizationId),
    repository.getStoreDetail({ organizationId: input.organizationId, storeIds: [input.storeId] }, input.storeId),
    repository.listMaintenancePrograms(input.organizationId),
    repository.listPmPlans(input.organizationId),
  ]);
  if (!store || !detail) throw new OpsDomainError("NOT_FOUND", "Store not found in organization");
  const selected = input.selections.filter((row) => row.quantity > 0);
  if (!selected.length) throw new OpsDomainError("VALIDATION", "Select at least one equipment type");
  if (selected.length > 100) throw new OpsDomainError("VALIDATION", "Too many equipment selections were submitted at once");
  if (selected.reduce((total, row) => total + row.quantity, 0) > 100) {
    throw new OpsDomainError("VALIDATION", "Create no more than 100 equipment records in one setup batch");
  }
  const byNode = new Map(nodes.map((node) => [node.id, node]));
  const usedTags = new Set(detail.assets.map((asset) => asset.assetTag.toLocaleLowerCase("en-US")));
  const now = clock.now();
  const assets: Asset[] = [];
  const templateByAssetId = new Map<OpsId, EquipmentTemplate>();
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
      const asset: Asset = { id: ids.next("asset"), organizationId: input.organizationId, storeId: store.id, categoryKey: category.canonicalKey, taxonomyNodeId: leaf.id, equipmentTemplateId: template.id, groupPath: path.filter((row) => row.nodeKind === "group").map((row) => row.name), assetTag: tag, name: selection.quantity > 1 ? `${template.name} ${index}` : template.name, expectedLifeYears: template.defaultExpectedLifeYears, status: "operational", createdAt: now };
      assets.push(asset);
      templateByAssetId.set(asset.id, template);
      statements.push(insert("ops_assets", { id: asset.id, organization_id: asset.organizationId, store_id: asset.storeId, category_key: asset.categoryKey, taxonomy_node_id: asset.taxonomyNodeId, equipment_template_id: asset.equipmentTemplateId, group_path_json: JSON.stringify(asset.groupPath), asset_tag: asset.assetTag, name: asset.name, expected_life_years: asset.expectedLifeYears, replacement_attributes_json: "{}", status: asset.status, created_at: asset.createdAt }));
      const componentIdByTemplate = new Map<string, string>();
      for (const componentTemplate of componentTemplates) {
        const componentId = ids.next("component");
        componentIdByTemplate.set(componentTemplate.id, componentId);
        statements.push(insert("ops_asset_components", { id: componentId, organization_id: input.organizationId, asset_id: asset.id, parent_component_id: componentTemplate.parentComponentTemplateId ? componentIdByTemplate.get(componentTemplate.parentComponentTemplateId) : undefined, name: componentTemplate.name, created_at: now }));
      }
    }
  }
  const enrollmentKeys = new Set(existingPlans.filter((plan) => plan.programId && plan.assetId).map((plan) => `${plan.programId}:${plan.assetId}`));
  const autoEnrolled: Array<{ plan: PmPlan; occurrence: PmOccurrence }> = [];
  for (const asset of assets) {
    const template = templateByAssetId.get(asset.id);
    if (!template) continue;
    for (const program of programs.filter((candidate) => candidate.status === "active" && programAppliesToTemplate(candidate, template))) {
      const key = `${program.id}:${asset.id}`;
      if (enrollmentKeys.has(key)) continue;
      const enrolled = programPlanForAsset({ program, asset, dueAt: nextProgramDueAt(program, now), now, ids });
      enrollmentKeys.add(key);
      autoEnrolled.push(enrolled);
      statements.push(...pmPlanStatements(enrolled.plan, enrolled.occurrence));
    }
  }
  statements.push(...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "store", aggregateId: store.id, eventType: "store.equipment_templates_applied", actor: input.actor, occurredAt: now, payload: { selections: selected, createdAssetIds: assets.map((asset) => asset.id), autoEnrolledPmPlanIds: autoEnrolled.map(({ plan }) => plan.id) }, ids }));
  await repository.atomicWrite(statements);
  return assets;
}

export interface NameStoreEquipmentInput {
  organizationId: OpsId;
  storeId: OpsId;
  equipment: Array<{
    assetId: OpsId;
    name: string;
  }>;
  actor: ActorContext;
}

/**
 * Completes the quick store-commissioning pass after equipment templates have
 * created the durable assets and component trees. The user-facing name is the
 * plain location identity (for example, "Checkout wall") while the stable
 * asset tag remains unchanged.
 */
export async function nameStoreEquipment(
  svc: OpsCommandServices,
  input: NameStoreEquipmentInput,
): Promise<Asset[]> {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  if (!input.equipment.length) throw new OpsDomainError("VALIDATION", "Add at least one equipment name");
  if (input.equipment.length > 100) throw new OpsDomainError("VALIDATION", "Name no more than 100 equipment records at once");

  const uniqueIds = new Set(input.equipment.map((row) => row.assetId));
  if (uniqueIds.size !== input.equipment.length) {
    throw new OpsDomainError("VALIDATION", "Each equipment record can appear only once");
  }

  const [store, detail] = await Promise.all([
    repository.getStore(input.organizationId, input.storeId),
    repository.getStoreDetail(
      { organizationId: input.organizationId, storeIds: [input.storeId] },
      input.storeId,
    ),
  ]);
  if (!store || !detail) throw new OpsDomainError("NOT_FOUND", "Store not found in organization");

  const requestedIds = new Set(input.equipment.map((row) => row.assetId));
  const requestedAssets = await Promise.all(
    input.equipment.map((row) => repository.getAsset(input.organizationId, row.assetId)),
  );
  const assetsById = new Map(
    requestedAssets
      .filter((asset): asset is Asset => Boolean(asset && asset.storeId === input.storeId))
      .map((asset) => [asset.id, asset]),
  );
  const existingNames = new Set(
    detail.assets
      .filter((asset) => !requestedIds.has(asset.id))
      .map((asset) => asset.name.trim().toLocaleLowerCase("en-US")),
  );
  const submittedNames = new Set<string>();
  const changes = input.equipment.map((row) => {
    const asset = assetsById.get(row.assetId);
    if (!asset) throw new OpsDomainError("FORBIDDEN", "Equipment is outside this store or organization");
    const name = required(row.name, "Equipment name");
    const normalized = name.toLocaleLowerCase("en-US");
    if (existingNames.has(normalized) || submittedNames.has(normalized)) {
      throw new OpsDomainError("CONFLICT", `Equipment name “${name}” is already used at this store`);
    }
    submittedNames.add(normalized);
    return { asset, name };
  });

  const now = clock.now();
  const statements: OpsStatement[] = [];
  for (const { asset, name } of changes) {
    statements.push(
      update(
        "ops_assets",
        { name },
        { organization_id: input.organizationId, store_id: input.storeId, id: asset.id },
      ),
      ...auditAndOutbox({
        organizationId: input.organizationId,
        aggregateType: "asset",
        aggregateId: asset.id,
        eventType: "asset.commissioning_name_set",
        actor: input.actor,
        occurredAt: now,
        payload: {
          storeId: input.storeId,
          assetTag: asset.assetTag,
          before: { name: asset.name },
          after: { name },
        },
        ids,
      }),
    );
  }
  await repository.atomicWrite(statements);
  return changes.map(({ asset, name }) => ({ ...asset, name }));
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

export interface CreateMaintenanceProgramInput {
  organizationId: OpsId;
  name: string;
  applicableEquipmentTemplateIds: OpsId[];
  cadenceDays: number;
  completionWindowDays: number;
  firstDueAt: IsoDateTime;
  actor: ActorContext;
}

export interface CreatedMaintenanceProgram {
  program: MaintenanceProgram;
  checklistTemplate: ChecklistTemplate;
  plans: PmPlan[];
  occurrences: PmOccurrence[];
}

/**
 * Creates one company PM standard and immediately enrolls every matching
 * equipment record. Future equipment created from the same templates is
 * enrolled by applyStoreEquipmentTemplates using this same durable program.
 */
export async function createMaintenanceProgramAndEnrollEquipment(
  svc: OpsCommandServices,
  input: CreateMaintenanceProgramInput,
): Promise<CreatedMaintenanceProgram> {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const name = required(input.name, "Master schedule name");
  const templateIds = [...new Set(input.applicableEquipmentTemplateIds.map((id) => required(id, "Equipment type", 120)))];
  if (!templateIds.length) throw new OpsDomainError("VALIDATION", "Choose at least one equipment type");
  if (templateIds.length > 50) throw new OpsDomainError("VALIDATION", "Choose no more than 50 equipment types");
  const cadenceDays = positiveInteger(input.cadenceDays, "Cadence", 3_650);
  const completionWindowDays = positiveInteger(input.completionWindowDays, "Completion window", 365);
  if (completionWindowDays >= cadenceDays) throw new OpsDomainError("VALIDATION", "Completion window must be shorter than the cadence");
  const firstDueAt = iso(input.firstDueAt, "First company due date");
  if (!firstDueAt) throw new OpsDomainError("VALIDATION", "First company due date is required");

  const [templates, taxonomyNodes, existingPrograms] = await Promise.all([
    repository.listEquipmentTemplates(input.organizationId),
    repository.listTaxonomyNodes(input.organizationId),
    repository.listMaintenancePrograms(input.organizationId),
  ]);
  const selectedTemplates = templateIds.map((templateId) => {
    const template = templates.find((row) => row.id === templateId && row.active);
    if (!template) throw new OpsDomainError("VALIDATION", "Choose active company equipment types");
    return template;
  });
  const taxonomyById = new Map(taxonomyNodes.map((node) => [node.id, node]));
  const categoryForTemplate = (template: EquipmentTemplate) => {
    let node = taxonomyById.get(template.taxonomyNodeId);
    const seen = new Set<string>();
    while (node && !seen.has(node.id)) {
      seen.add(node.id);
      if (node.nodeKind === "category" && node.canonicalKey) return node.canonicalKey;
      node = node.parentNodeId ? taxonomyById.get(node.parentNodeId) : undefined;
    }
    return undefined;
  };
  const categories = [...new Set(selectedTemplates.map(categoryForTemplate).filter((value): value is string => Boolean(value)))];
  if (categories.length !== 1) throw new OpsDomainError("VALIDATION", "A master schedule must use equipment types from one service area");
  const programKey = normalizedEquipmentType(name);
  if (existingPrograms.some((program) => program.programKey === programKey && program.status === "active")) {
    throw new OpsDomainError("CONFLICT", "An active master schedule already uses this name");
  }

  const now = clock.now();
  const checklistTemplate: ChecklistTemplate = {
    id: ids.next("checklist"),
    organizationId: input.organizationId,
    name: `${name} checklist`,
    version: 1,
    items: [
      { key: "service-completed", label: "Complete the scheduled preventive service", responseKind: "pass", required: true },
      { key: "condition-notes", label: "Record condition, readings, and any recommended follow-up", responseKind: "text", required: true },
    ],
    status: "active",
    createdAt: now,
  };
  const program: MaintenanceProgram = {
    id: ids.next("maintenance-program"),
    organizationId: input.organizationId,
    programKey,
    version: 1,
    name,
    tradeKey: categories[0],
    workType: "preventive_maintenance",
    applicableAssetTypes: selectedTemplates.map((template) => template.id),
    frequencyDays: cadenceDays,
    recurrenceKind: "fixed_calendar",
    dueWindowDays: completionWindowDays,
    scheduleAnchorAt: firstDueAt,
    checklistTemplateId: checklistTemplate.id,
    requiredEvidenceKinds: [],
    expectedDurationMinutes: 60,
    completionCriteria: "Scheduled preventive service is completed and the condition note is recorded.",
    correctiveWorkAuthorityMinor: 0,
    currency: "USD",
    deficiencyHandling: "review",
    status: "active",
    createdAt: now,
  };
  const assets = await repository.listAssetsForEquipmentTemplates(
    input.organizationId,
    selectedTemplates.map((template) => template.id),
  );
  const enrolled = assets.map((asset) => programPlanForAsset({ program, asset, dueAt: firstDueAt, now, ids }));
  const statements: OpsStatement[] = [
    insert("ops_checklist_templates", {
      id: checklistTemplate.id,
      organization_id: checklistTemplate.organizationId,
      name: checklistTemplate.name,
      version: checklistTemplate.version,
      items_json: JSON.stringify(checklistTemplate.items),
      status: checklistTemplate.status,
      created_at: checklistTemplate.createdAt,
    }),
    insert("ops_maintenance_programs", {
      id: program.id,
      organization_id: program.organizationId,
      program_key: program.programKey,
      version: program.version,
      name: program.name,
      trade_key: program.tradeKey,
      work_type: program.workType,
      applicable_asset_types_json: JSON.stringify(program.applicableAssetTypes),
      frequency_days: program.frequencyDays,
      recurrence_kind: program.recurrenceKind,
      due_window_days: program.dueWindowDays,
      schedule_anchor_at: program.scheduleAnchorAt,
      checklist_template_id: program.checklistTemplateId,
      required_evidence_kinds_json: JSON.stringify(program.requiredEvidenceKinds),
      expected_duration_minutes: program.expectedDurationMinutes,
      completion_criteria: program.completionCriteria,
      corrective_work_authority_minor: program.correctiveWorkAuthorityMinor,
      currency: program.currency,
      deficiency_handling: program.deficiencyHandling,
      status: program.status,
      created_at: program.createdAt,
    }),
    ...enrolled.flatMap(({ plan, occurrence }) => pmPlanStatements(plan, occurrence)),
    ...auditAndOutbox({
      organizationId: input.organizationId,
      aggregateType: "maintenance_program",
      aggregateId: program.id,
      eventType: "pm.master_schedule_created",
      actor: input.actor,
      occurredAt: now,
      payload: {
        equipmentTemplateIds: program.applicableAssetTypes,
        cadenceDays,
        completionWindowDays,
        scheduleAnchorAt: firstDueAt,
        enrolledPlanIds: enrolled.map(({ plan }) => plan.id),
      },
      ids,
    }),
  ];
  await repository.atomicWrite(statements);
  return {
    program,
    checklistTemplate,
    plans: enrolled.map(({ plan }) => plan),
    occurrences: enrolled.map(({ occurrence }) => occurrence),
  };
}

export interface OverridePmPlanCadenceInput {
  organizationId: OpsId;
  planId: OpsId;
  cadenceDays: number;
  completionWindowDays: number;
  reason: string;
  actor: ActorContext;
}

/** Store-level exception to a company schedule; current occurrences are not rewritten. */
export async function overridePmPlanCadence(
  svc: OpsCommandServices,
  input: OverridePmPlanCadenceInput,
): Promise<PmPlan> {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const plan = await repository.getPmPlan(input.organizationId, input.planId);
  if (!plan) throw new OpsDomainError("NOT_FOUND", "PM plan not found in organization");
  const cadenceDays = positiveInteger(input.cadenceDays, "Cadence", 3_650);
  const completionWindowDays = positiveInteger(input.completionWindowDays, "Completion window", 365);
  if (completionWindowDays >= cadenceDays) throw new OpsDomainError("VALIDATION", "Completion window must be shorter than the cadence");
  const reason = required(input.reason, "Reason for store schedule", 500);
  const now = clock.now();
  const updated: PmPlan = {
    ...plan,
    cadenceDays,
    completionWindowDays,
    cadenceOverrideReason: reason,
    cadenceOverriddenAt: now,
    cadenceOverriddenByMembershipId: input.actor.actorId,
  };
  await repository.atomicWrite([
    update("ops_pm_plans", {
      cadence_days: cadenceDays,
      completion_window_days: completionWindowDays,
      cadence_override_reason: reason,
      cadence_overridden_at: now,
      cadence_overridden_by_membership_id: input.actor.actorId ?? null,
    }, { organization_id: input.organizationId, id: plan.id }),
    ...auditAndOutbox({
      organizationId: input.organizationId,
      aggregateType: "pm_plan",
      aggregateId: plan.id,
      eventType: "pm.store_schedule_overridden",
      actor: input.actor,
      occurredAt: now,
      payload: {
        storeId: plan.storeId,
        assetId: plan.assetId,
        programId: plan.programId,
        before: { cadenceDays: plan.cadenceDays, completionWindowDays: plan.completionWindowDays },
        after: { cadenceDays, completionWindowDays },
        reason,
      },
      ids,
    }),
  ]);
  return updated;
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
