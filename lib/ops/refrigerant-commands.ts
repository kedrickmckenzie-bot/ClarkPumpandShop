import type { OpsCommandServices } from "./commands";
import { OpsDomainError } from "./errors";
import type { OpsRepository, OpsStatement } from "./repository";
import type { ActorContext } from "./types";
import {
  addDays, leakRateForAddition, refrigerantCoverage, refrigerantInfo,
  type AssetRefrigerant, type RefrigerantChargeSource, type RefrigerantEvent, type RefrigerantLeakStatus, type RefrigerantSystemUse,
} from "./refrigerant";

const USES: readonly RefrigerantSystemUse[] = ["commercial_refrigeration", "comfort_cooling", "light_commercial_ac"];
const SOURCES: readonly RefrigerantChargeSource[] = ["nameplate", "installer", "estimate"];
const LEAK_STATUSES: readonly RefrigerantLeakStatus[] = ["none_found", "found_repaired", "found_not_repaired", "not_checked"];
const MAX_OZ = 80_000;

function insert(table: string, values: Record<string, unknown>): OpsStatement {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined);
  return { sql: `INSERT INTO ${table} (${entries.map(([key]) => key).join(", ")}) VALUES (${entries.map(() => "?").join(", ")})`, params: entries.map(([, value]) => value) };
}

function audit(input: { organizationId: string; assetId: string; eventType: string; actor: ActorContext; now: string; payload: unknown; id: string }): OpsStatement {
  return insert("ops_audit_events", { id: input.id, organization_id: input.organizationId, aggregate_type: "asset", aggregate_id: input.assetId, event_type: input.eventType, actor_type: input.actor.actorType, actor_id: input.actor.actorId, actor_name: input.actor.actorName, occurred_at: input.now, payload_json: JSON.stringify(input.payload) });
}

function text(value: unknown, label: string, max: number, required = false) {
  const clean = typeof value === "string" ? value.trim() : "";
  if (required && !clean) throw new OpsDomainError("VALIDATION", `${label} is required.`);
  if (clean.length > max) throw new OpsDomainError("VALIDATION", `${label} must be ${max} characters or less.`);
  return clean || undefined;
}

function ounces(value: number | undefined, label: string) {
  if (value === undefined) return undefined;
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_OZ) throw new OpsDomainError("VALIDATION", `${label} must be between 0 and 5,000 lb.`);
  return value;
}

function services(svc: OpsCommandServices) {
  return {
    repository: svc.repository,
    now: svc.clock?.now() ?? new Date().toISOString(),
    ids: svc.ids ?? { next: (prefix: string) => `${prefix}-${crypto.randomUUID()}` },
  };
}

export interface SetAssetRefrigerantInput {
  organizationId: string;
  assetId: string;
  refrigerant: string;
  fullChargeOz?: number;
  systemUse: RefrigerantSystemUse;
  chargeSource?: RefrigerantChargeSource;
  expectedVersion: number;
  actor: ActorContext;
}

/** Saves the refrigerant type and full charge as a new version. Earlier versions and records stay unchanged. */
export async function setAssetRefrigerant(svc: OpsCommandServices, input: SetAssetRefrigerantInput): Promise<AssetRefrigerant> {
  const { repository, now, ids } = services(svc);
  if (input.actor.organizationId !== input.organizationId) throw new OpsDomainError("FORBIDDEN", "This equipment is outside your organization.");
  const asset = await repository.getAsset(input.organizationId, input.assetId);
  if (!asset) throw new OpsDomainError("NOT_FOUND", "Equipment not found.");
  const info = refrigerantInfo(input.refrigerant);
  if (!info) throw new OpsDomainError("VALIDATION", "Choose the refrigerant from the list.");
  if (!USES.includes(input.systemUse)) throw new OpsDomainError("VALIDATION", "Choose what the equipment is used for.");
  if (input.chargeSource !== undefined && !SOURCES.includes(input.chargeSource)) throw new OpsDomainError("VALIDATION", "Choose where the charge amount came from.");
  const fullChargeOz = ounces(input.fullChargeOz, "Full charge");
  if (fullChargeOz === 0) throw new OpsDomainError("VALIDATION", "Full charge must be more than 0 lb. Leave it blank if you don't know.");
  const current = await repository.getAssetRefrigerant(input.organizationId, asset.id);
  if ((current?.version ?? 0) !== input.expectedVersion) throw new OpsDomainError("CONFLICT", "Someone else changed this. Refresh and try again.");
  const next: AssetRefrigerant = {
    organizationId: input.organizationId, assetId: asset.id, version: (current?.version ?? 0) + 1, refrigerant: info.code, fullChargeOz,
    systemUse: input.systemUse, chargeSource: fullChargeOz === undefined ? undefined : input.chargeSource,
    recordedByName: input.actor.actorName ?? "Team member", recordedByActorId: input.actor.actorId, createdAt: now,
  };
  if (current && current.refrigerant === next.refrigerant && current.fullChargeOz === next.fullChargeOz && current.systemUse === next.systemUse && current.chargeSource === next.chargeSource) return current;
  try {
    await repository.atomicWrite([
      insert("ops_asset_refrigerants", { organization_id: next.organizationId, asset_id: next.assetId, version: next.version, refrigerant: next.refrigerant, full_charge_oz: next.fullChargeOz, system_use: next.systemUse, charge_source: next.chargeSource, recorded_by_name: next.recordedByName, recorded_by_actor_id: next.recordedByActorId, created_at: now }),
      audit({ id: ids.next("audit"), organizationId: input.organizationId, assetId: asset.id, eventType: "asset.refrigerant_set", actor: input.actor, now, payload: { before: current ?? null, after: next } }),
    ]);
  } catch (error) {
    if ((await repository.getAssetRefrigerant(input.organizationId, asset.id))?.version !== input.expectedVersion) throw new OpsDomainError("CONFLICT", "Someone else changed this. Refresh and try again.");
    throw error;
  }
  return next;
}

export interface RefrigerantEventInput {
  organizationId: string;
  assetId: string;
  /** Stable per submission, so a double tap never counts refrigerant twice. */
  eventId: string;
  kind: "service" | "verification";
  workOrderId?: string;
  visitId?: string;
  /** The day the work happened (YYYY-MM-DD). */
  occurredOn: string;
  addedOz?: number;
  leakStatus?: RefrigerantLeakStatus;
  verificationStage?: "initial" | "follow_up";
  verificationResult?: "passed" | "failed";
  technicianName: string;
  technicianCert?: string;
  source: RefrigerantEvent["source"];
  notes?: string;
  actor: ActorContext;
}

/**
 * The statements for one refrigerant record, for use inside a larger command (such as a vendor checkout) or alone.
 * The facts and the leak-rate math are copied onto the record so later edits never change it.
 */
export async function buildRefrigerantEventStatements(repository: OpsRepository, input: RefrigerantEventInput & { now: string; auditId: string }) {
  if (input.actor.organizationId !== input.organizationId) throw new OpsDomainError("FORBIDDEN", "This equipment is outside your organization.");
  if (!/^[A-Za-z0-9:_-]{8,160}$/u.test(input.eventId)) throw new OpsDomainError("VALIDATION", "Refresh the page and try again.");
  const asset = await repository.getAsset(input.organizationId, input.assetId);
  if (!asset) throw new OpsDomainError("NOT_FOUND", "Equipment not found.");
  if (input.workOrderId) {
    const work = await repository.getWorkOrder(input.organizationId, input.workOrderId);
    if (!work || work.assetId !== asset.id) throw new OpsDomainError("VALIDATION", "That work order isn't for this equipment.");
  }
  const facts = await repository.getAssetRefrigerant(input.organizationId, asset.id);
  if (!facts) throw new OpsDomainError("VALIDATION", "Add the refrigerant type for this equipment first.");
  const today = input.now.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(input.occurredOn) || !Number.isFinite(Date.parse(input.occurredOn))) throw new OpsDomainError("VALIDATION", "Enter the day the work happened.");
  if (input.occurredOn > addDays(today, 1)) throw new OpsDomainError("VALIDATION", "The work date can't be in the future.");
  if (input.occurredOn < addDays(today, -3 * 366)) throw new OpsDomainError("VALIDATION", "The work date must be within the last 3 years.");
  const technicianName = text(input.technicianName, "Technician name", 120, true)!;
  const technicianCert = text(input.technicianCert, "EPA certification number", 40);
  const notes = text(input.notes, "Notes", 1000);
  let addedOz = 0, leakStatus: RefrigerantLeakStatus | undefined, stage: "initial" | "follow_up" | undefined, result: "passed" | "failed" | undefined;
  if (input.kind === "service") {
    addedOz = ounces(input.addedOz ?? 0, "Refrigerant added") ?? 0;
    if (!input.leakStatus || !LEAK_STATUSES.includes(input.leakStatus)) throw new OpsDomainError("VALIDATION", "Say whether a leak was found.");
    leakStatus = input.leakStatus;
  } else {
    if (input.verificationStage !== "initial" && input.verificationStage !== "follow_up") throw new OpsDomainError("VALIDATION", "Choose which leak check this was.");
    if (input.verificationResult !== "passed" && input.verificationResult !== "failed") throw new OpsDomainError("VALIDATION", "Say whether the leak check passed.");
    stage = input.verificationStage; result = input.verificationResult;
  }
  const prior = await repository.listRefrigerantEvents(input.organizationId, [asset.id]);
  const replay = prior.find((event) => event.id === input.eventId);
  if (replay) return { statements: [] as OpsStatement[], event: replay, replay: true };
  const coverage = refrigerantCoverage(facts, input.occurredOn);
  const leakRateBps = addedOz > 0 && facts.fullChargeOz ? leakRateForAddition(prior, input.occurredOn, addedOz, facts.fullChargeOz) : undefined;
  const event: RefrigerantEvent = {
    id: input.eventId, organizationId: input.organizationId, assetId: asset.id, storeId: asset.storeId, workOrderId: input.workOrderId, visitId: input.visitId,
    kind: input.kind, occurredAt: input.occurredOn, addedOz, leakStatus, verificationStage: stage, verificationResult: result,
    refrigerant: facts.refrigerant, fullChargeOz: facts.fullChargeOz, rule: coverage.covered ? coverage.rule : undefined, leakRateBps,
    thresholdBps: coverage.covered ? coverage.thresholdBps : undefined, technicianName, technicianCert, source: input.source,
    recordedByName: input.actor.actorName ?? technicianName, recordedByActorId: input.actor.actorId, notes, createdAt: input.now,
  };
  const statements: OpsStatement[] = [
    insert("ops_refrigerant_events", { id: event.id, organization_id: event.organizationId, asset_id: event.assetId, store_id: event.storeId, work_order_id: event.workOrderId, visit_id: event.visitId, kind: event.kind, occurred_at: event.occurredAt, added_oz: event.addedOz, leak_status: event.leakStatus, verification_stage: event.verificationStage, verification_result: event.verificationResult, refrigerant: event.refrigerant, full_charge_oz: event.fullChargeOz, rule: event.rule, leak_rate_bps: event.leakRateBps, threshold_bps: event.thresholdBps, technician_name: event.technicianName, technician_cert: event.technicianCert, source: event.source, recorded_by_name: event.recordedByName, recorded_by_actor_id: event.recordedByActorId, notes: event.notes, created_at: event.createdAt }),
    audit({ id: input.auditId, organizationId: input.organizationId, assetId: asset.id, eventType: input.kind === "service" ? "asset.refrigerant_service_recorded" : "asset.refrigerant_leak_check_recorded", actor: input.actor, now: input.now, payload: { eventId: event.id, workOrderId: event.workOrderId, addedOz, leakStatus, stage, result, leakRateBps, thresholdBps: event.thresholdBps } }),
  ];
  return { statements, event, replay: false };
}

/** Records one refrigerant record on its own. */
export async function recordRefrigerantEvent(svc: OpsCommandServices, input: RefrigerantEventInput) {
  const { repository, now, ids } = services(svc);
  const built = await buildRefrigerantEventStatements(repository, { ...input, now, auditId: ids.next("audit") });
  if (built.replay) return built.event;
  try { await repository.atomicWrite(built.statements); }
  catch (error) {
    const saved = (await repository.listRefrigerantEvents(input.organizationId, [input.assetId])).find((event) => event.id === input.eventId);
    if (saved) return saved;
    throw error;
  }
  return built.event;
}
