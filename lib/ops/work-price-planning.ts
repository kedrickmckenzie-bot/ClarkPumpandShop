import { OpsDomainError, type OpsCommandServices } from "./commands";
import { atomicWorkOrderMutation } from "./concurrency";
import { assertPriceAccess, priceHash, priceInsert, priceProfileFingerprint } from "./work-price-commands";
import { matchAssetToReplacementProfile } from "./replacement-intelligence";
import type { ActorContext } from "./types";

export async function workPricePlan(services: OpsCommandServices, organizationId: string, priceId: string, actor: ActorContext) {
  const repo = services.repository;
  const price = await repo.getWorkPrice(organizationId, priceId);
  if (!price) throw new OpsDomainError("NOT_FOUND", "Price not found.");
  const work = await repo.getWorkOrder(organizationId, price.workOrderId);
  if (!work) throw new OpsDomainError("NOT_FOUND", "Work order not found.");
  await assertPriceAccess(repo, actor, work, true);
  if (price.kind !== "replace" || price.scopeKind !== "whole" || !price.assetId || !price.profileId || price.amount.amountMinor <= 0) throw new OpsDomainError("VALIDATION", "Plans need a whole-unit replacement price.");
  const [asset, profile, current, assets] = await Promise.all([
    repo.getAsset(organizationId, price.assetId), repo.getReplacementProfile(organizationId, price.profileId),
    repo.getPublishedReplacementBenchmark(organizationId, price.profileId), repo.listAssetsForReplacementProfile(organizationId, price.profileId),
  ]);
  if (!asset || asset.replacementProfileId !== profile?.id || !profile?.active || matchAssetToReplacementProfile(asset, profile).classification !== "exact") throw new OpsDomainError("CONFLICT", "The equipment match needs a check.");
  if (price.profileFingerprint !== await priceProfileFingerprint(asset,profile)) throw new OpsDomainError("CONFLICT", "The equipment details changed. Save a new price after checking them.");
  if (current && current.totalAmount.currency !== price.amount.currency) throw new OpsDomainError("VALIDATION", "The plan uses a different currency.");
  const rows = await Promise.all(assets.filter(row => row.status !== "retired" && !row.replacementPlanningExcludedAt && matchAssetToReplacementProfile(row, profile).classification === "exact").map(async row => ({
    asset: row, override: await repo.getActiveAssetReplacementOverride(organizationId, row.id),
  })));
  const signature = await priceHash({ price: price.id, current: current?.id, profile, rows: rows.map(row => ({ id: row.asset.id, adjustment: row.asset.replacementAdjustmentBps, attributes: row.asset.replacementAttributes, override: row.override?.id })).sort((a,b) => a.id.localeCompare(b.id)) });
  return { price, work, profile, current, rows, signature };
}

export async function applyWorkPricePlan(services: OpsCommandServices, input: { organizationId: string; priceId: string; signature: string; actor: ActorContext }) {
  const { repository } = services;
  const price = await repository.getWorkPrice(input.organizationId,input.priceId);
  const work = price ? await repository.getWorkOrder(input.organizationId,price.workOrderId) : null;
  if (!work) throw new OpsDomainError("NOT_FOUND","Price not found.");
  await assertPriceAccess(repository,input.actor,work,true);
  const key = "price-plan:" + input.priceId + ":" + input.signature;
  const prior = await repository.getIdempotencyKey(input.organizationId, key);
  if (prior) {
    if(prior.command !== "work_price.plan" || prior.requestHash !== input.signature) throw new OpsDomainError("CONFLICT","This update was already used.");
    return prior.resultId;
  }
  const plan = await workPricePlan(services, input.organizationId, input.priceId, input.actor);
  if (plan.signature !== input.signature) throw new OpsDomainError("CONFLICT", "The plan changed. Reload to see the new prices.");
  const now = services.clock?.now() ?? new Date().toISOString();
  const id = services.ids?.next("replacement-benchmark") ?? "replacement-benchmark-" + crypto.randomUUID();
  const auditId = services.ids?.next("audit") ?? "audit-" + crypto.randomUUID();
  const amount = plan.price.amount;
  const fence = "__ops_internal__/price-plan:" + plan.profile.id + ":" + (plan.current?.id ?? "none");
  const statements = [
    priceInsert("ops_idempotency_keys", { organization_id: input.organizationId, key: fence, command: "work_price.plan_fence", result_id: id, request_hash: plan.signature, created_at: now, expires_at: "9999-12-31T23:59:59.999Z" }),
    ...(plan.current ? [{ sql: "UPDATE ops_replacement_benchmarks SET status = ?, superseded_at = ? WHERE organization_id = ? AND id = ? AND status = ?", params: ["superseded", now, input.organizationId, plan.current.id, "published"] }] : []),
    priceInsert("ops_replacement_benchmarks", { id, organization_id: input.organizationId, profile_id: plan.profile.id, source_type: "reported_price",
      source_work_order_id: plan.work.id, source_asset_id: plan.price.assetId, source_vendor_id: plan.price.vendorId,
      equipment_amount_minor: null, installation_amount_minor: null, other_amount_minor: null,
      total_amount_minor: amount.amountMinor, currency: amount.currency, effective_at: plan.price.recordedAt, status: "published",
      notes: "Reported installed price " + plan.price.id + ". Cost split not given.", created_at: now }),
    priceInsert("ops_idempotency_keys", { organization_id: input.organizationId, key, command: "work_price.plan", result_id: id, request_hash: plan.signature, created_at: now, expires_at: "9999-12-31T23:59:59.999Z" }),
    priceInsert("ops_audit_events", { id: auditId, organization_id: input.organizationId, aggregate_type: "replacement_profile", aggregate_id: plan.profile.id,
      event_type: "work_price.plan_applied", actor_type: input.actor.actorType, actor_id: input.actor.actorId, actor_name: input.actor.actorName,
      occurred_at: now, payload_json: JSON.stringify({ priceId: plan.price.id, benchmarkId: id, previousBenchmarkId: plan.current?.id,
        amount, affectedAssetIds: plan.rows.filter(row => !row.override).map(row => row.asset.id), retainedOverrideIds: plan.rows.flatMap(row => row.override ? [row.override.id] : []), amountBasis: "installed_total_unsplit" }) }),
  ];
  try { await atomicWorkOrderMutation({ repository, workOrder: plan.work, now, statements }); }
  catch (error) {
    const replay = await repository.getIdempotencyKey(input.organizationId, key);
    if (replay) return replay.resultId;
    if (await repository.getIdempotencyKey(input.organizationId, fence)) throw new OpsDomainError("CONFLICT", "The plan changed. Reload to see the new prices.");
    throw error;
  }
  return id;
}
