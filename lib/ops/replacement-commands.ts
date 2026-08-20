import { OpsDomainError, type OpsClock, type OpsCommandServices, type OpsIdSource } from "./commands";
import type { OpsStatement } from "./repository";
import type {
  ActorContext,
  Asset,
  AssetReplacementOverride,
  IsoDateTime,
  LifecycleDecisionKind,
  LifecycleRecommendation,
  OpsId,
  ReplacementBenchmark,
  ReplacementEvent,
  ReplacementProfile,
} from "./types";
import type { LifecycleRecommendationDraft } from "./replacement-intelligence";

const systemClock: OpsClock = { now: () => new Date().toISOString() };
const randomIds: OpsIdSource = { next: (prefix) => `${prefix}-${crypto.randomUUID()}` };
const MAX_MONEY_MINOR = 999_999_999_999;

function services(input: OpsCommandServices) {
  return { repository: input.repository, clock: input.clock ?? systemClock, ids: input.ids ?? randomIds };
}

function assertActorOrganization(actor: ActorContext, organizationId: OpsId) {
  if (actor.organizationId !== organizationId) throw new OpsDomainError("FORBIDDEN", "Actor organization does not match command organization");
}

function required(value: string, label: string, max = 200) {
  const clean = value.trim();
  if (!clean) throw new OpsDomainError("VALIDATION", `${label} is required`);
  if (clean.length > max) throw new OpsDomainError("VALIDATION", `${label} is too long`);
  return clean;
}

function optional(value: string | undefined, max = 2_000) {
  const clean = value?.trim();
  if (!clean) return undefined;
  if (clean.length > max) throw new OpsDomainError("VALIDATION", "Notes are too long");
  return clean;
}

function integer(value: number, label: string, minimum: number, maximum: number) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new OpsDomainError("VALIDATION", `${label} is invalid`);
  return value;
}

function money(value: number, label: string, allowZero = false) {
  return integer(value, label, allowZero ? 0 : 1, MAX_MONEY_MINOR);
}

function currency(value: string) {
  const clean = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(clean)) throw new OpsDomainError("VALIDATION", "Currency must be a three-letter code");
  return clean;
}

function iso(value: IsoDateTime, label: string) {
  if (!Number.isFinite(Date.parse(value))) throw new OpsDomainError("VALIDATION", `${label} is invalid`);
  return value;
}

function insert(table: string, values: Record<string, unknown>): OpsStatement {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined);
  return { sql: `INSERT INTO ${table} (${entries.map(([key]) => key).join(", ")}) VALUES (${entries.map(() => "?").join(", ")})`, params: entries.map(([, value]) => value) };
}

function update(table: string, values: Record<string, unknown>, where: Record<string, unknown>): OpsStatement {
  const set = Object.entries(values);
  const filters = Object.entries(where);
  return { sql: `UPDATE ${table} SET ${set.map(([key]) => `${key} = ?`).join(", ")} WHERE ${filters.map(([key]) => `${key} = ?`).join(" AND ")}`, params: [...set.map(([, value]) => value), ...filters.map(([, value]) => value)] };
}

function auditAndOutbox(input: { organizationId: OpsId; aggregateType: string; aggregateId: OpsId; eventType: string; actor: ActorContext; occurredAt: IsoDateTime; payload: unknown; ids: OpsIdSource }): OpsStatement[] {
  const payloadJson = JSON.stringify(input.payload);
  return [
    insert("ops_audit_events", { id: input.ids.next("audit"), organization_id: input.organizationId, aggregate_type: input.aggregateType, aggregate_id: input.aggregateId, event_type: input.eventType, actor_type: input.actor.actorType, actor_id: input.actor.actorId, actor_name: input.actor.actorName, occurred_at: input.occurredAt, payload_json: payloadJson }),
    insert("ops_outbox_messages", { id: input.ids.next("outbox"), organization_id: input.organizationId, topic: `ops.${input.eventType}`, aggregate_type: input.aggregateType, aggregate_id: input.aggregateId, payload_json: payloadJson, status: "pending", available_at: input.occurredAt, created_at: input.occurredAt, attempt_count: 0 }),
  ];
}

function cleanAttributes(value: Record<string, string>, label: string) {
  const result: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(value)) {
    const key = required(rawKey, `${label} key`, 80).toLocaleLowerCase("en-US").replace(/\s+/g, "_");
    result[key] = required(rawValue, `${label} value`, 120);
  }
  return result;
}

export interface CreateReplacementProfileInput {
  organizationId: OpsId;
  code: string;
  name: string;
  description: string;
  categoryKey: string;
  taxonomyNodeId?: OpsId;
  matchKeys: string[];
  attributes: Record<string, string>;
  expectedLifeYears?: number;
  annualEscalationBps?: number;
  lowVarianceBps?: number;
  highVarianceBps?: number;
  actor: ActorContext;
}

export async function createReplacementProfile(svc: OpsCommandServices, input: CreateReplacementProfileInput): Promise<ReplacementProfile> {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const code = required(input.code, "Profile code", 60).toLocaleUpperCase("en-US");
  if ((await repository.listReplacementProfiles(input.organizationId)).some((row) => row.code.toLocaleUpperCase("en-US") === code)) throw new OpsDomainError("CONFLICT", "Replacement profile code is already in use");
  const categoryKey = required(input.categoryKey, "Service area", 80).toLocaleLowerCase("en-US");
  const taxonomy = await repository.listTaxonomyNodes(input.organizationId);
  const category = taxonomy.find((row) => row.active && row.nodeKind === "category" && row.canonicalKey === categoryKey);
  if (!category) throw new OpsDomainError("VALIDATION", "Choose an active company service area");
  if (input.taxonomyNodeId && !taxonomy.some((row) => row.active && row.id === input.taxonomyNodeId)) throw new OpsDomainError("VALIDATION", "Choose an active company classification");
  const attributes = cleanAttributes(input.attributes, "Profile attribute");
  let matchKeys = [...new Set(input.matchKeys.map((key) => required(key, "Match key", 80).toLocaleLowerCase("en-US").replace(/\s+/g, "_")))];
  if (!matchKeys.length) matchKeys = Object.keys(attributes);
  if (!matchKeys.length) {
    attributes.profile_code = code.toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    matchKeys = ["profile_code"];
  }
  if (matchKeys.some((key) => !attributes[key])) throw new OpsDomainError("VALIDATION", "Every comparison key must have a profile attribute value");
  const now = clock.now();
  const profile: ReplacementProfile = {
    id: ids.next("replacement-profile"), organizationId: input.organizationId, code,
    name: required(input.name, "Profile name"), description: required(input.description, "Description", 1_000),
    categoryKey, taxonomyNodeId: input.taxonomyNodeId ?? category.id, matchKeys, attributes,
    expectedLifeYears: input.expectedLifeYears === undefined ? undefined : integer(input.expectedLifeYears, "Expected life", 1, 100),
    annualEscalationBps: integer(input.annualEscalationBps ?? 300, "Annual escalation", -9_000, 50_000),
    lowVarianceBps: integer(input.lowVarianceBps ?? 1_000, "Low range", 0, 10_000),
    highVarianceBps: integer(input.highVarianceBps ?? 2_000, "High range", 0, 50_000), active: true, createdAt: now,
  };
  await repository.atomicWrite([
    insert("ops_replacement_profiles", { id: profile.id, organization_id: profile.organizationId, code: profile.code, name: profile.name, description: profile.description, category_key: profile.categoryKey, taxonomy_node_id: profile.taxonomyNodeId, match_keys_json: JSON.stringify(profile.matchKeys), attributes_json: JSON.stringify(profile.attributes), expected_life_years: profile.expectedLifeYears, annual_escalation_bps: profile.annualEscalationBps, low_variance_bps: profile.lowVarianceBps, high_variance_bps: profile.highVarianceBps, active: 1, created_at: profile.createdAt }),
    ...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "replacement_profile", aggregateId: profile.id, eventType: "replacement_profile.created", actor: input.actor, occurredAt: now, payload: { code: profile.code, categoryKey: profile.categoryKey, matchKeys: profile.matchKeys }, ids }),
  ]);
  return profile;
}

export interface AssignReplacementProfileInput {
  organizationId: OpsId;
  assetId: OpsId;
  profileId: OpsId;
  attributes?: Record<string, string>;
  adjustmentBps?: number;
  actor: ActorContext;
}

export async function assignReplacementProfile(svc: OpsCommandServices, input: AssignReplacementProfileInput): Promise<Asset> {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const [asset, profile] = await Promise.all([repository.getAsset(input.organizationId, input.assetId), repository.getReplacementProfile(input.organizationId, input.profileId)]);
  if (!asset) throw new OpsDomainError("NOT_FOUND", "Equipment not found in organization");
  if (!profile?.active) throw new OpsDomainError("VALIDATION", "Choose an active replacement profile");
  if (asset.categoryKey !== profile.categoryKey) throw new OpsDomainError("VALIDATION", "Replacement profile must use the equipment service area");
  const attributes = cleanAttributes(input.attributes ?? asset.replacementAttributes ?? profile.attributes, "Equipment attribute");
  const adjustmentBps = input.adjustmentBps === undefined ? asset.replacementAdjustmentBps : integer(input.adjustmentBps, "Equipment adjustment", -9_000, 50_000);
  const now = clock.now();
  await repository.atomicWrite([
    update("ops_assets", { replacement_profile_id: profile.id, replacement_attributes_json: JSON.stringify(attributes), replacement_adjustment_bps: adjustmentBps ?? null }, { organization_id: input.organizationId, id: asset.id }),
    ...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "asset", aggregateId: asset.id, eventType: "asset.replacement_profile_assigned", actor: input.actor, occurredAt: now, payload: { profileId: profile.id, attributes, adjustmentBps }, ids }),
  ]);
  return { ...asset, replacementProfileId: profile.id, replacementAttributes: attributes, replacementAdjustmentBps: adjustmentBps };
}

export interface SetAssetReplacementOverrideInput {
  organizationId: OpsId;
  assetId: OpsId;
  amountMinor: number;
  currency: string;
  effectiveAt: IsoDateTime;
  reason: string;
  actor: ActorContext;
}

export async function setAssetReplacementOverride(svc: OpsCommandServices, input: SetAssetReplacementOverrideInput): Promise<AssetReplacementOverride> {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const [asset, current] = await Promise.all([repository.getAsset(input.organizationId, input.assetId), repository.getActiveAssetReplacementOverride(input.organizationId, input.assetId)]);
  if (!asset) throw new OpsDomainError("NOT_FOUND", "Equipment not found in organization");
  const now = clock.now();
  const row: AssetReplacementOverride = { id: ids.next("replacement-override"), organizationId: input.organizationId, assetId: asset.id, amount: { amountMinor: money(input.amountMinor, "Replacement estimate"), currency: currency(input.currency) }, effectiveAt: iso(input.effectiveAt, "Effective date"), reason: required(input.reason, "Override reason", 1_000), status: "active", createdAt: now };
  const statements: OpsStatement[] = [];
  if (current) statements.push(update("ops_asset_replacement_overrides", { status: "superseded", superseded_at: now }, { organization_id: input.organizationId, id: current.id, status: "active" }));
  statements.push(insert("ops_asset_replacement_overrides", { id: row.id, organization_id: row.organizationId, asset_id: row.assetId, amount_minor: row.amount.amountMinor, currency: row.amount.currency, effective_at: row.effectiveAt, reason: row.reason, status: row.status, created_at: row.createdAt }));
  statements.push(...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "asset", aggregateId: asset.id, eventType: "asset.replacement_override_set", actor: input.actor, occurredAt: now, payload: { overrideId: row.id, amount: row.amount, effectiveAt: row.effectiveAt, supersededOverrideId: current?.id }, ids }));
  await repository.atomicWrite(statements);
  return row;
}

interface PublishBenchmarkAmounts { equipmentAmountMinor: number; installationAmountMinor: number; otherAmountMinor: number; currency: string }

function benchmarkAmounts(input: PublishBenchmarkAmounts) {
  const code = currency(input.currency);
  const equipment = money(input.equipmentAmountMinor, "Equipment amount", true);
  const installation = money(input.installationAmountMinor, "Installation amount", true);
  const other = money(input.otherAmountMinor, "Other amount", true);
  const total = equipment + installation + other;
  money(total, "Replacement total");
  return { equipment, installation, other, total, currency: code };
}

export interface PublishManualReplacementBenchmarkInput extends PublishBenchmarkAmounts {
  organizationId: OpsId;
  profileId: OpsId;
  effectiveAt: IsoDateTime;
  notes: string;
  actor: ActorContext;
}

export async function publishManualReplacementBenchmark(svc: OpsCommandServices, input: PublishManualReplacementBenchmarkInput): Promise<ReplacementBenchmark> {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const [profile, current] = await Promise.all([repository.getReplacementProfile(input.organizationId, input.profileId), repository.getPublishedReplacementBenchmark(input.organizationId, input.profileId)]);
  if (!profile?.active) throw new OpsDomainError("VALIDATION", "Choose an active replacement profile");
  const amounts = benchmarkAmounts(input);
  const now = clock.now();
  const benchmark: ReplacementBenchmark = { id: ids.next("replacement-benchmark"), organizationId: input.organizationId, profileId: profile.id, sourceType: "manual", equipmentAmount: { amountMinor: amounts.equipment, currency: amounts.currency }, installationAmount: { amountMinor: amounts.installation, currency: amounts.currency }, otherAmount: { amountMinor: amounts.other, currency: amounts.currency }, totalAmount: { amountMinor: amounts.total, currency: amounts.currency }, effectiveAt: iso(input.effectiveAt, "Effective date"), status: "published", notes: required(input.notes, "Benchmark notes", 2_000), createdAt: now };
  const statements: OpsStatement[] = [];
  if (current) statements.push(update("ops_replacement_benchmarks", { status: "superseded", superseded_at: now }, { organization_id: input.organizationId, id: current.id, status: "published" }));
  statements.push(insert("ops_replacement_benchmarks", { id: benchmark.id, organization_id: benchmark.organizationId, profile_id: benchmark.profileId, source_type: benchmark.sourceType, equipment_amount_minor: amounts.equipment, installation_amount_minor: amounts.installation, other_amount_minor: amounts.other, total_amount_minor: amounts.total, currency: amounts.currency, effective_at: benchmark.effectiveAt, status: benchmark.status, notes: benchmark.notes, created_at: benchmark.createdAt }));
  statements.push(...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "replacement_profile", aggregateId: profile.id, eventType: "replacement_benchmark.published", actor: input.actor, occurredAt: now, payload: { benchmarkId: benchmark.id, sourceType: benchmark.sourceType, totalAmount: benchmark.totalAmount, supersededBenchmarkId: current?.id }, ids }));
  await repository.atomicWrite(statements);
  return benchmark;
}

export interface RecordLifecycleRecommendationInput extends LifecycleRecommendationDraft {
  organizationId: OpsId;
  assetId: OpsId;
  userDecision: LifecycleDecisionKind;
  userReason: string;
  actor: ActorContext;
}

export async function recordLifecycleRecommendation(svc: OpsCommandServices, input: RecordLifecycleRecommendationInput): Promise<LifecycleRecommendation> {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const asset = await repository.getAsset(input.organizationId, input.assetId);
  if (!asset || asset.status === "retired") throw new OpsDomainError("CONFLICT", "Equipment is not available for a new lifecycle recommendation");
  if (!input.actor.actorId || !(await repository.getMembership(input.organizationId, input.actor.actorId))) throw new OpsDomainError("FORBIDDEN", "A current organization membership is required");
  if (!(["repair", "replace", "capital_review"] as const).includes(input.recommendation)) throw new OpsDomainError("VALIDATION", "Recommendation is invalid");
  if (!(["low", "medium", "high"] as const).includes(input.confidence)) throw new OpsDomainError("VALIDATION", "Confidence is invalid");
  if (!(["repair", "replace", "defer", "investigate"] as const).includes(input.userDecision)) throw new OpsDomainError("VALIDATION", "Decision is invalid");
  try { JSON.parse(input.inputsJson); } catch { throw new OpsDomainError("VALIDATION", "Recommendation inputs are invalid"); }
  const prior = await repository.listLifecycleRecommendationsForAsset(input.organizationId, asset.id);
  const now = clock.now();
  const row: LifecycleRecommendation = {
    id: ids.next("lifecycle-recommendation"), organizationId: input.organizationId, assetId: asset.id,
    workOrderId: input.workOrderId, version: (prior[0]?.version ?? 0) + 1,
    modelVersion: required(input.modelVersion, "Model version", 80), recommendation: input.recommendation,
    confidence: input.confidence, inputsJson: input.inputsJson,
    explanation: required(input.explanation, "Recommendation explanation", 2_000),
    missingData: [...new Set(input.missingData.map((value) => required(value, "Missing-data label", 160)))],
    userDecision: input.userDecision, userReason: required(input.userReason, "Decision reason", 2_000),
    decidedByMembershipId: input.actor.actorId, decidedAt: now, createdAt: now,
  };
  await repository.atomicWrite([
    insert("ops_lifecycle_recommendations", { id: row.id, organization_id: row.organizationId, asset_id: row.assetId, work_order_id: row.workOrderId, version: row.version, model_version: row.modelVersion, recommendation: row.recommendation, confidence: row.confidence, inputs_json: row.inputsJson, explanation: row.explanation, missing_data_json: JSON.stringify(row.missingData), user_decision: row.userDecision, user_reason: row.userReason, decided_by_membership_id: row.decidedByMembershipId, decided_at: row.decidedAt, created_at: row.createdAt }),
    ...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "asset", aggregateId: asset.id, eventType: "asset.lifecycle_recommendation_recorded", actor: input.actor, occurredAt: now, payload: { recommendationId: row.id, version: row.version, modelVersion: row.modelVersion, recommendation: row.recommendation, confidence: row.confidence, missingData: row.missingData, userDecision: row.userDecision, userReason: row.userReason }, ids }),
  ]);
  return row;
}

export interface ApproveReplacementFromSelectedQuoteInput extends PublishBenchmarkAmounts {
  organizationId: OpsId;
  workOrderId: OpsId;
  profileId: OpsId;
  effectiveAt: IsoDateTime;
  planningApplication?: "asset_only" | "planning_group";
  notes?: string;
  actor: ActorContext;
}

export async function approveReplacementFromSelectedQuote(svc: OpsCommandServices, input: ApproveReplacementFromSelectedQuoteInput): Promise<{ event: ReplacementEvent; benchmark?: ReplacementBenchmark; affectedAssetCount: number }> {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const workOrder = await repository.getWorkOrder(input.organizationId, input.workOrderId);
  if (!workOrder?.assetId) throw new OpsDomainError("VALIDATION", "Replacement approval requires a work order tied to equipment");
  const [asset, profile, requests, currentBenchmark] = await Promise.all([
    repository.getAsset(input.organizationId, workOrder.assetId), repository.getReplacementProfile(input.organizationId, input.profileId),
    repository.listEstimateRequestsForWorkOrder(input.organizationId, workOrder.id), repository.getPublishedReplacementBenchmark(input.organizationId, input.profileId),
  ]);
  if (!asset) throw new OpsDomainError("NOT_FOUND", "Equipment not found in organization");
  if (!profile?.active || profile.categoryKey !== asset.categoryKey) throw new OpsDomainError("VALIDATION", "Choose a compatible active replacement profile");
  const selected = requests.find((row) => row.status === "selected");
  if (!selected) throw new OpsDomainError("CONFLICT", "Select a vendor quote before approving an equipment replacement");
  if (selected.decisionKind !== "replacement_quote") throw new OpsDomainError("CONFLICT", "The selected bid is for service work, not an equipment-replacement quote");
  const proposal = await repository.getLatestEstimateProposal(input.organizationId, selected.id);
  if (!proposal) throw new OpsDomainError("CONFLICT", "The selected bid has no submitted quote");
  const existing = await repository.getReplacementEventForProposal(input.organizationId, proposal.id);
  if (existing) throw new OpsDomainError("CONFLICT", "This selected quote is already recorded as a replacement decision");
  const amounts = benchmarkAmounts(input);
  if (amounts.total !== proposal.amount.amountMinor || amounts.currency !== proposal.amount.currency) throw new OpsDomainError("VALIDATION", "Equipment, installation, and other amounts must reconcile exactly to the selected quote");
  const now = clock.now();
  const effectiveAt = iso(input.effectiveAt, "Quote effective date");
  const planningApplication = input.planningApplication ?? "planning_group";
  if (planningApplication !== "asset_only" && planningApplication !== "planning_group") throw new OpsDomainError("VALIDATION", "Choose where this planning reference should apply");
  const benchmark: ReplacementBenchmark | undefined = planningApplication === "planning_group" ? { id: ids.next("replacement-benchmark"), organizationId: input.organizationId, profileId: profile.id, sourceType: "approved_quote", sourceWorkOrderId: workOrder.id, sourceEstimateProposalId: proposal.id, sourceAssetId: asset.id, sourceVendorId: proposal.vendorId, equipmentAmount: { amountMinor: amounts.equipment, currency: amounts.currency }, installationAmount: { amountMinor: amounts.installation, currency: amounts.currency }, otherAmount: { amountMinor: amounts.other, currency: amounts.currency }, totalAmount: { amountMinor: amounts.total, currency: amounts.currency }, effectiveAt, status: "published", notes: optional(input.notes), createdAt: now } : undefined;
  const event: ReplacementEvent = { id: ids.next("replacement-event"), organizationId: input.organizationId, assetId: asset.id, workOrderId: workOrder.id, profileId: profile.id, sourceEstimateProposalId: proposal.id, status: "approved", approvedAmount: proposal.amount, approvedAt: now, createdAt: now };
  const statements: OpsStatement[] = [];
  if (benchmark && currentBenchmark) statements.push(update("ops_replacement_benchmarks", { status: "superseded", superseded_at: now }, { organization_id: input.organizationId, id: currentBenchmark.id, status: "published" }));
  if (asset.replacementProfileId !== profile.id) statements.push(update("ops_assets", { replacement_profile_id: profile.id, replacement_attributes_json: JSON.stringify(asset.replacementAttributes ?? profile.attributes) }, { organization_id: input.organizationId, id: asset.id }));
  if (benchmark) statements.push(insert("ops_replacement_benchmarks", { id: benchmark.id, organization_id: benchmark.organizationId, profile_id: benchmark.profileId, source_type: benchmark.sourceType, source_work_order_id: benchmark.sourceWorkOrderId, source_estimate_proposal_id: benchmark.sourceEstimateProposalId, source_asset_id: benchmark.sourceAssetId, source_vendor_id: benchmark.sourceVendorId, equipment_amount_minor: amounts.equipment, installation_amount_minor: amounts.installation, other_amount_minor: amounts.other, total_amount_minor: amounts.total, currency: amounts.currency, effective_at: benchmark.effectiveAt, status: benchmark.status, notes: benchmark.notes, created_at: benchmark.createdAt }));
  else {
    const currentOverride = await repository.getActiveAssetReplacementOverride(input.organizationId, asset.id);
    if (currentOverride) statements.push(update("ops_asset_replacement_overrides", { status: "superseded", superseded_at: now }, { organization_id: input.organizationId, id: currentOverride.id, status: "active" }));
    statements.push(insert("ops_asset_replacement_overrides", { id: ids.next("asset-replacement-override"), organization_id: input.organizationId, asset_id: asset.id, amount_minor: amounts.total, currency: amounts.currency, effective_at: effectiveAt, reason: `Vendor replacement quote on ${workOrder.number}; applies to this equipment only.`, status: "active", created_at: now }));
  }
  statements.push(
    insert("ops_replacement_events", { id: event.id, organization_id: event.organizationId, asset_id: event.assetId, work_order_id: event.workOrderId, profile_id: event.profileId, source_estimate_proposal_id: event.sourceEstimateProposalId, status: event.status, approved_amount_minor: event.approvedAmount.amountMinor, currency: event.approvedAmount.currency, approved_at: event.approvedAt, created_at: event.createdAt }),
    { sql: "UPDATE ops_lifecycle_recommendations SET replacement_event_id = ? WHERE organization_id = ? AND asset_id = ? AND version = (SELECT MAX(version) FROM ops_lifecycle_recommendations WHERE organization_id = ? AND asset_id = ?)", params: [event.id, input.organizationId, asset.id, input.organizationId, asset.id] },
    ...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "asset", aggregateId: asset.id, eventType: "asset.replacement_approved", actor: input.actor, occurredAt: now, payload: { replacementEventId: event.id, benchmarkId: benchmark?.id, profileId: profile.id, proposalId: proposal.id, amount: proposal.amount, planningApplication, supersededBenchmarkId: benchmark ? currentBenchmark?.id : undefined }, ids }),
  );
  await repository.atomicWrite(statements);
  const affectedAssetCount = planningApplication === "asset_only" ? 1 : (await repository.listAssetsForReplacementProfile(input.organizationId, profile.id)).filter((row) => row.status !== "retired").length + (asset.replacementProfileId === profile.id ? 0 : 1);
  return { event, benchmark, affectedAssetCount };
}

export interface CompleteReplacementInput {
  organizationId: OpsId;
  assetId: OpsId;
  eventId: OpsId;
  finalAmountMinor: number;
  currency: string;
  newAssetTag: string;
  newAssetName: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  supplier?: string;
  installedAt: IsoDateTime;
  warrantyEndsAt?: IsoDateTime;
  actor: ActorContext;
}

export async function completeReplacement(svc: OpsCommandServices, input: CompleteReplacementInput): Promise<{ retiredAsset: Asset; replacementAsset: Asset; benchmark?: ReplacementBenchmark }> {
  const { repository, clock, ids } = services(svc);
  assertActorOrganization(input.actor, input.organizationId);
  const [asset, event] = await Promise.all([repository.getAsset(input.organizationId, input.assetId), repository.getActiveReplacementEventForAsset(input.organizationId, input.assetId)]);
  if (!asset || asset.status === "retired") throw new OpsDomainError("CONFLICT", "Equipment is not available for replacement closeout");
  if (!event || event.id !== input.eventId) throw new OpsDomainError("CONFLICT", "Approved replacement decision not found for this equipment");
  const profile = await repository.getReplacementProfile(input.organizationId, event.profileId);
  if (!profile) throw new OpsDomainError("NOT_FOUND", "Replacement profile not found");
  const [currentBenchmark, benchmarkHistory] = await Promise.all([
    repository.getPublishedReplacementBenchmark(input.organizationId, profile.id),
    repository.listReplacementBenchmarks(input.organizationId, profile.id),
  ]);
  const updatesPlanningGroup = benchmarkHistory.some((row) => row.sourceEstimateProposalId === event.sourceEstimateProposalId);
  const finalAmountMinor = money(input.finalAmountMinor, "Final replacement cost");
  const code = currency(input.currency);
  const now = clock.now();
  const installedAt = iso(input.installedAt, "Install date");
  const warrantyEndsAt = input.warrantyEndsAt ? iso(input.warrantyEndsAt, "Warranty end date") : undefined;
  if (warrantyEndsAt && Date.parse(warrantyEndsAt) < Date.parse(installedAt)) throw new OpsDomainError("VALIDATION", "Warranty end date cannot be before the install date");
  const newAssetTag = required(input.newAssetTag, "New equipment tag", 80);
  const storeDetail = await repository.getStoreDetail({ organizationId: input.organizationId }, asset.storeId);
  if (!storeDetail) throw new OpsDomainError("NOT_FOUND", "Store not found");
  if (storeDetail.assets.some((row) => row.assetTag.trim().toLocaleLowerCase() === newAssetTag.toLocaleLowerCase())) throw new OpsDomainError("CONFLICT", "That equipment tag is already used at this store");
  const successor: Asset = { id: ids.next("asset"), organizationId: input.organizationId, storeId: asset.storeId, categoryKey: asset.categoryKey, taxonomyNodeId: asset.taxonomyNodeId, groupPath: [...asset.groupPath], assetTag: newAssetTag, name: required(input.newAssetName, "New equipment name"), manufacturer: optional(input.manufacturer, 200), model: optional(input.model, 200), serialNumber: optional(input.serialNumber, 200), supplier: optional(input.supplier, 200), installedAt, expectedLifeYears: profile.expectedLifeYears ?? asset.expectedLifeYears, warrantyEndsAt, replacementProfileId: profile.id, replacementAttributes: { ...(asset.replacementAttributes ?? profile.attributes) }, replacementAdjustmentBps: asset.replacementAdjustmentBps, status: "operational", createdAt: now };
  const benchmark: ReplacementBenchmark | undefined = updatesPlanningGroup ? { id: ids.next("replacement-benchmark"), organizationId: input.organizationId, profileId: profile.id, sourceType: "final_cost", sourceWorkOrderId: event.workOrderId, sourceAssetId: asset.id, equipmentAmount: { amountMinor: finalAmountMinor, currency: code }, installationAmount: { amountMinor: 0, currency: code }, otherAmount: { amountMinor: 0, currency: code }, totalAmount: { amountMinor: finalAmountMinor, currency: code }, effectiveAt: installedAt, status: "published", notes: "Final installed replacement cost recorded at replacement closeout.", createdAt: now } : undefined;
  const statements: OpsStatement[] = [
    insert("ops_assets", { id: successor.id, organization_id: successor.organizationId, store_id: successor.storeId, category_key: successor.categoryKey, taxonomy_node_id: successor.taxonomyNodeId, group_path_json: JSON.stringify(successor.groupPath), asset_tag: successor.assetTag, name: successor.name, manufacturer: successor.manufacturer, model: successor.model, serial_number: successor.serialNumber, supplier: successor.supplier, installed_at: successor.installedAt, expected_life_years: successor.expectedLifeYears, warranty_ends_at: successor.warrantyEndsAt, replacement_profile_id: successor.replacementProfileId, replacement_attributes_json: JSON.stringify(successor.replacementAttributes), replacement_adjustment_bps: successor.replacementAdjustmentBps, status: successor.status, created_at: successor.createdAt }),
    update("ops_assets", { status: "retired", retired_at: now, replaced_by_asset_id: successor.id }, { organization_id: input.organizationId, id: asset.id }),
    update("ops_replacement_events", { status: "completed", completed_at: now, final_amount_minor: finalAmountMinor, replacement_asset_id: successor.id }, { organization_id: input.organizationId, id: event.id, status: "approved" }),
    { sql: "UPDATE ops_lifecycle_recommendations SET actual_outcome = ?, actual_outcome_at = ?, replacement_event_id = ? WHERE organization_id = ? AND asset_id = ? AND version = (SELECT MAX(version) FROM ops_lifecycle_recommendations WHERE organization_id = ? AND asset_id = ?)", params: ["replaced", now, event.id, input.organizationId, asset.id, input.organizationId, asset.id] },
  ];
  if (benchmark && currentBenchmark) statements.push(update("ops_replacement_benchmarks", { status: "superseded", superseded_at: now }, { organization_id: input.organizationId, id: currentBenchmark.id, status: "published" }));
  if (benchmark) statements.push(insert("ops_replacement_benchmarks", { id: benchmark.id, organization_id: benchmark.organizationId, profile_id: benchmark.profileId, source_type: benchmark.sourceType, source_work_order_id: benchmark.sourceWorkOrderId, source_estimate_proposal_id: benchmark.sourceEstimateProposalId, source_asset_id: benchmark.sourceAssetId, equipment_amount_minor: benchmark.equipmentAmount.amountMinor, installation_amount_minor: 0, other_amount_minor: 0, total_amount_minor: benchmark.totalAmount.amountMinor, currency: code, effective_at: benchmark.effectiveAt, status: benchmark.status, notes: benchmark.notes, created_at: benchmark.createdAt }));
  else {
    const currentOverride = await repository.getActiveAssetReplacementOverride(input.organizationId, asset.id);
    if (currentOverride) statements.push(update("ops_asset_replacement_overrides", { status: "superseded", superseded_at: now }, { organization_id: input.organizationId, id: currentOverride.id, status: "active" }));
  }
  statements.push(...auditAndOutbox({ organizationId: input.organizationId, aggregateType: "asset", aggregateId: asset.id, eventType: "asset.replacement_completed", actor: input.actor, occurredAt: now, payload: { replacementEventId: event.id, replacementAssetId: successor.id, finalAmount: { amountMinor: finalAmountMinor, currency: code }, benchmarkId: benchmark?.id, planningApplication: updatesPlanningGroup ? "planning_group" : "asset_only" }, ids }));
  await repository.atomicWrite(statements);
  return { retiredAsset: { ...asset, status: "retired", retiredAt: now, replacedByAssetId: successor.id }, replacementAsset: successor, benchmark };
}
