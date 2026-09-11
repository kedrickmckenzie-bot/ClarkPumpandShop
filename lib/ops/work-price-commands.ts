import { OpsDomainError, type OpsCommandServices } from "./commands";
import { atomicWorkOrderMutation } from "./concurrency";
import type { ActorContext, WorkOrder, Asset, ReplacementProfile } from "./types";
import type { OpsRepository, OpsStatement } from "./repository";
import type { WorkPrice } from "./work-price-types";

export function priceInsert(table: string, values: Record<string, unknown>): OpsStatement {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined);
  return { sql: `INSERT INTO ${table} (${entries.map(([key]) => key).join(", ")}) VALUES (${entries.map(() => "?").join(", ")})`, params: entries.map(([, value]) => value) };
}
export async function assertPriceAccess(repository: OpsRepository, actor: ActorContext, work: WorkOrder, company = false) {
  if (actor.organizationId !== work.organizationId || actor.actorType !== "user" || !actor.actorId) throw new OpsDomainError("FORBIDDEN", "You cannot save a price here.");
  const member = await repository.getMembership(work.organizationId, actor.actorId);
  if (!member || member.status !== "active" || !["facilities_admin", "regional_manager"].includes(member.role)) throw new OpsDomainError("FORBIDDEN", "You cannot save a price here.");
  const grants = (await repository.listScopeGrantsForMembership(work.organizationId, member.id)).filter(row => ["ops:*", "ops:read_write"].includes(row.permission));
  const store = await repository.getStore(work.organizationId, work.storeId);
  const orgGrant = grants.some(row => row.scopeKind === "organization" && row.scopeId === work.organizationId);
  if (company && (member.role !== "facilities_admin" || !orgGrant)) throw new OpsDomainError("FORBIDDEN", "Company planning access is needed.");
  if (!store || !(orgGrant || grants.some(row => row.scopeKind === "store" && row.scopeId === store.id || row.scopeKind === "region" && row.scopeId === store.regionId))) throw new OpsDomainError("FORBIDDEN", "This store is outside your area.");
}
export function priceAudit(row: WorkPrice, actor: ActorContext, now: string, id: string, payload: unknown = row): OpsStatement {
  return priceInsert("ops_audit_events", { id, organization_id: row.organizationId, aggregate_type: "work_price", aggregate_id: row.id,
    event_type: "work_price.recorded", actor_type: actor.actorType, actor_id: actor.actorId, actor_name: actor.actorName, occurred_at: now, payload_json: JSON.stringify(payload) });
}
export async function priceHash(value: unknown) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value))))].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
export function priceProfileFingerprint(asset: Asset, profile: ReplacementProfile) {
  return priceHash({profile:profile.id,category:asset.categoryKey,keys:[...profile.matchKeys].sort().map(key=>[key,profile.attributes[key]?.trim().toLowerCase(),asset.replacementAttributes?.[key]?.trim().toLowerCase()])});
}
export interface RecordWorkPriceInput {
  organizationId: string; workOrderId: string; vendorId: string; kind: WorkPrice["kind"]; scopeKind: WorkPrice["scopeKind"];
  amountMinor: number; currency: string; scope: string; expectedVersion: number; submissionKey: string; actor: ActorContext;
}
export async function recordWorkPrice(services: OpsCommandServices, input: RecordWorkPriceInput): Promise<WorkPrice> {
  const repository = services.repository;
  const work = await repository.getWorkOrder(input.organizationId, input.workOrderId);
  if (!work) throw new OpsDomainError("NOT_FOUND", "Work order not found.");
  await assertPriceAccess(repository, input.actor, work);
  if (!["repair", "replace"].includes(input.kind) || !["whole", "part", "job"].includes(input.scopeKind)) throw new OpsDomainError("VALIDATION", "Choose what the price covers.");
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 0 || input.amountMinor > 999_999_999_999 || !/^[A-Z]{3}$/.test(input.currency)) throw new OpsDomainError("VALIDATION", "Enter a valid price.");
  if (!input.scope.trim() || input.scope.length > 2000 || !/^[a-zA-Z0-9:_-]{8,160}$/.test(input.submissionKey)) throw new OpsDomainError("VALIDATION", "Check the price details.");
  const hash = await priceHash({ work: work.id, vendor: input.vendorId, kind: input.kind, scopeKind: input.scopeKind, amount: input.amountMinor, currency: input.currency, scope: input.scope.trim(), actor: input.actor.actorId });
  const key = "price:" + input.submissionKey;
  const replay = async () => {
    const prior = await repository.getIdempotencyKey(input.organizationId, key);
    if (!prior) return null;
    if (prior.requestHash !== hash || prior.command !== "work_price.record") throw new OpsDomainError("CONFLICT", "This save was already used for a different price.");
    return repository.getWorkPrice(input.organizationId, prior.resultId);
  };
  const prior = await replay(); if (prior) return prior;
  if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion !== (work.version ?? 0)) throw new OpsDomainError("CONFLICT", "This job changed. Reload and try again.");
  if (["closed", "cancelled"].includes(work.status)) throw new OpsDomainError("CONFLICT", "This job is closed.");
  const vendor = await repository.getVendor(input.organizationId, input.vendorId);
  if (!vendor || vendor.status === "inactive") throw new OpsDomainError("VALIDATION", "Choose a vendor.");
  const asset = work.assetId ? await repository.getAsset(input.organizationId, work.assetId) : null;
  const profile = asset?.replacementProfileId ? await repository.getReplacementProfile(input.organizationId, asset.replacementProfileId) : null;
  const now = services.clock?.now() ?? new Date().toISOString();
  const nextId = (prefix: string) => services.ids?.next(prefix) ?? prefix + "-" + crypto.randomUUID();
  const row: WorkPrice = { id: nextId("work-price"), organizationId: work.organizationId, workOrderId: work.id, storeId: work.storeId,
    assetId: asset?.id, componentId: input.scopeKind === "part" ? work.componentId : undefined, profileId: asset?.replacementProfileId,
    profileFingerprint: asset && profile ? await priceProfileFingerprint(asset,profile) : undefined,
    vendorId: vendor.id, kind: input.kind, scopeKind: input.scopeKind, scope: input.scope.trim(),
    amount: { amountMinor: input.amountMinor, currency: input.currency }, recordedAt: now, recordedBy: input.actor.actorName };
  const statements = [
    priceInsert("ops_work_prices", { id: row.id, organization_id: row.organizationId, work_order_id: row.workOrderId, store_id: row.storeId,
      asset_id: row.assetId, component_id: row.componentId, profile_id: row.profileId, profile_fingerprint: row.profileFingerprint, vendor_id: row.vendorId, kind: row.kind, scope_kind: row.scopeKind,
      scope: row.scope, amount_minor: row.amount.amountMinor, currency: row.amount.currency, recorded_at: now, recorded_by: row.recordedBy }),
    priceInsert("ops_idempotency_keys", { organization_id: row.organizationId, key, command: "work_price.record", result_id: row.id, request_hash: hash, created_at: now, expires_at: "9999-12-31T23:59:59.999Z" }),
    priceAudit(row, input.actor, now, nextId("audit")),
  ];
  if (row.kind === "repair") statements.push({ sql: "UPDATE ops_work_orders SET repair_estimate_amount_minor = ?, repair_estimate_currency = ? WHERE organization_id = ? AND id = ?", params: [row.amount.amountMinor, row.amount.currency, row.organizationId, work.id] });
  try { await atomicWorkOrderMutation({ repository, workOrder: work, now, statements }); }
  catch (error) { const saved = await replay(); if (saved) return saved; throw error; }
  return row;
}
