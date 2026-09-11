import { describe, it, expect } from "vitest";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID as organizationId } from "@/lib/ops/fixtures";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { recordWorkPrice, type RecordWorkPriceInput } from "@/lib/ops/work-price-commands";
import { workPricePlan, applyWorkPricePlan } from "@/lib/ops/work-price-planning";
import { lifecyclePriceEvidence } from "@/lib/ops/lifecycle-price-evidence";
import { lifecycleReviewWork } from "@/lib/ops/lifecycle-review-work";
import { resolveAssetReplacementEstimate } from "@/lib/ops/replacement-intelligence";
import type { OpsCommandServices } from "@/lib/ops/commands";

const actor={organizationId,actorType:"user" as const,actorId:"membership-northline-facilities",actorName:"Jordan Lee"};
function harness() {
  const fixture=buildNorthlinePresentationFixture();
  const repository=createOpsFixtureRepository(fixture);let seq=0;
  const services:OpsCommandServices={repository,clock:{now:()=>"2026-09-11T12:00:00.000Z"},ids:{next:prefix=>prefix+"-price-test-"+(++seq)}};
  const work=fixture.workOrders.find(row=>row.number.endsWith("0119"))!;
  const input:RecordWorkPriceInput={organizationId,workOrderId:work.id,vendorId:fixture.vendors[0].id,kind:"repair",scopeKind:"part",scope:"Compressor repair",amountMinor:890_000,currency:"USD",expectedVersion:work.version??0,submissionKey:"save-price-001",actor};
  return {fixture,repository,services,input,work};
}
describe("reported work prices",()=>{
  it("appends repair prices, updates the estimate, and keeps money and work authority separate",async()=>{
    const h=harness();const before=h.repository.snapshot();
    const first=await recordWorkPrice(h.services,h.input);
    await recordWorkPrice(h.services,{...h.input,expectedVersion:1,submissionKey:"save-price-002",amountMinor:910_000});
    const after=h.repository.snapshot();
    expect(after.workPrices).toHaveLength(2);expect(after.workPrices?.[0]).toEqual(first);
    expect(after.workOrders.find(row=>row.id===h.work.id)?.repairEstimate?.amountMinor).toBe(910_000);
    expect(after.auditEvents.filter(row=>row.eventType==="work_price.recorded")).toHaveLength(2);
    for(const key of ["costLines","estimateProposals","assignments","issuances","workflowTasks","replacementBenchmarks","replacementEvents"] as const)expect(after[key]).toEqual(before[key]);
    expect(after.workOrders).toHaveLength(before.workOrders.length);
  });
  it("replays a save once and rejects a changed payload or stale version",async()=>{
    const h=harness();const first=await recordWorkPrice(h.services,h.input);
    expect(await recordWorkPrice(h.services,h.input)).toEqual(first);
    await expect(recordWorkPrice(h.services,{...h.input,amountMinor:12})).rejects.toMatchObject({code:"CONFLICT"});
    await expect(recordWorkPrice(h.services,{...h.input,submissionKey:"save-price-003"})).rejects.toMatchObject({code:"CONFLICT"});
    expect(h.repository.snapshot().workPrices).toHaveLength(1);
  });
  it("allows only one competing save from the same work version",async()=>{
    const h=harness();const result=await Promise.allSettled([recordWorkPrice(h.services,h.input),recordWorkPrice(h.services,{...h.input,submissionKey:"save-price-004"})]);
    expect(result.filter(row=>row.status==="fulfilled")).toHaveLength(1);expect(h.repository.snapshot().workPrices).toHaveLength(1);
  });
  it("rejects another tenant, another region, and a read-only grant",async()=>{
    const h=harness();
    await expect(recordWorkPrice(h.services,{...h.input,actor:{...actor,organizationId:"other"}})).rejects.toMatchObject({code:"FORBIDDEN"});
    await expect(recordWorkPrice(h.services,{...h.input,actor:{...actor,actorId:"membership-northline-regional-3"}})).rejects.toMatchObject({code:"FORBIDDEN"});
    const fixture=h.fixture;fixture.scopeGrants=fixture.scopeGrants.map(row=>row.membershipId===actor.actorId?{...row,permission:"ops:read"}:row);
    await expect(recordWorkPrice({...h.services,repository:createOpsFixtureRepository(fixture)},h.input)).rejects.toMatchObject({code:"FORBIDDEN"});
  });
  it("requires a positive whole-unit price for planning; repair and part prices remain history",async()=>{
    const h=harness();const row=await recordWorkPrice(h.services,h.input);
    await expect(workPricePlan(h.services,organizationId,row.id,actor)).rejects.toMatchObject({code:"VALIDATION"});
    const part=await recordWorkPrice(h.services,{...h.input,kind:"replace",expectedVersion:1,submissionKey:"save-price-005"});
    await expect(workPricePlan(h.services,organizationId,part.id,actor)).rejects.toMatchObject({code:"VALIDATION"});
    const evidence=lifecyclePriceEvidence(h.repository.snapshot(),h.work);
    expect(evidence.replacement).toBeUndefined();expect(evidence.quotes.some(quote=>quote.id===part.id)).toBe(true);
  });
  it("previews without writing, then updates exact matches and preserves equipment overrides",async()=>{
    const h=harness();const price=await recordWorkPrice(h.services,{...h.input,kind:"replace",scopeKind:"whole",amountMinor:3_500_000});
    const before=h.repository.snapshot();const plan=await workPricePlan(h.services,organizationId,price.id,actor);
    expect(h.repository.snapshot()).toEqual(before);
    const result=await applyWorkPricePlan(h.services,{organizationId,priceId:price.id,signature:plan.signature,actor});
    expect(await applyWorkPricePlan(h.services,{organizationId,priceId:price.id,signature:plan.signature,actor})).toBe(result);
    const after=h.repository.snapshot();const benchmark=after.replacementBenchmarks.find(row=>row.id===result)!;
    expect(benchmark).toMatchObject({sourceType:"reported_price",totalAmount:price.amount});
    expect(benchmark.equipmentAmount).toBeUndefined();expect(benchmark.installationAmount).toBeUndefined();expect(benchmark.otherAmount).toBeUndefined();
    expect(after.assetReplacementOverrides).toEqual(before.assetReplacementOverrides);
    const overridden=plan.rows.find(row=>row.override)!;
    expect(resolveAssetReplacementEstimate(after,overridden.asset,price.recordedAt).amount).toEqual(overridden.override!.amount);
    const shared=plan.rows.find(row=>!row.override)!;
    expect(resolveAssetReplacementEstimate(after,shared.asset,price.recordedAt).benchmarkId).toBe(result);
    for(const key of ["costLines","estimateProposals","assignments","issuances","workflowTasks","replacementEvents"] as const)expect(after[key]).toEqual(before[key]);
  });
  it("rejects a stale plan and leaves all prices unchanged",async()=>{
    const h=harness();const price=await recordWorkPrice(h.services,{...h.input,kind:"replace",scopeKind:"whole"});
    const before=h.repository.snapshot();await expect(applyWorkPricePlan(h.services,{organizationId,priceId:price.id,signature:"old",actor})).rejects.toMatchObject({code:"CONFLICT"});expect(h.repository.snapshot()).toEqual(before);
  });
  it("blocks a price when equipment details change after the call",async()=>{
    const h=harness();const price=await recordWorkPrice(h.services,{...h.input,kind:"replace",scopeKind:"whole"});
    const fixture=h.repository.snapshot();const source=fixture.assets.find(row=>row.id===price.assetId)!;const profile=fixture.replacementProfiles.find(row=>row.id===price.profileId)!;
    const key=profile.matchKeys[0];profile.attributes[key]="different size";source.replacementAttributes![key]="different size";
    const repo=createOpsFixtureRepository(fixture);
    await expect(workPricePlan({...h.services,repository:repo},organizationId,price.id,actor)).rejects.toMatchObject({code:"CONFLICT"});
  });
  it("omits retired, excluded, and uncertain matches from a confirmed plan",async()=>{
    const h=harness();const price=await recordWorkPrice(h.services,{...h.input,kind:"replace",scopeKind:"whole"});
    const fixture=h.repository.snapshot();const peers=fixture.assets.filter(row=>row.replacementProfileId===price.profileId && row.id!==price.assetId);
    peers[0].status="retired";peers[1].replacementPlanningExcludedAt=fixture.asOf;peers[2].replacementAttributes={};
    const plan=await workPricePlan({...h.services,repository:createOpsFixtureRepository(fixture)},organizationId,price.id,actor);
    expect(plan.rows.some(row=>peers.slice(0,3).some(peer=>peer.id===row.asset.id))).toBe(false);
  });
  it("requires a fresh preview when a matching unit leaves the plan",async()=>{
    const h=harness();const price=await recordWorkPrice(h.services,{...h.input,kind:"replace",scopeKind:"whole"});
    const plan=await workPricePlan(h.services,organizationId,price.id,actor);const fixture=h.repository.snapshot();
    fixture.assets.find(row=>row.replacementProfileId===price.profileId && row.id!==price.assetId)!.status="retired";
    await expect(applyWorkPricePlan({...h.services,repository:createOpsFixtureRepository(fixture)},{organizationId,priceId:price.id,signature:plan.signature,actor})).rejects.toMatchObject({code:"CONFLICT"});
  });
  it("keeps an approved quote above a newer reported price",async()=>{
    const h=harness();const approved=h.fixture.replacementEvents.find(row=>row.status==="approved")!;
    const work=h.fixture.workOrders.find(row=>row.id===approved.workOrderId)!;
    await recordWorkPrice(h.services,{...h.input,workOrderId:work.id,expectedVersion:work.version??0,kind:"replace",scopeKind:"whole",amountMinor:1});
    expect(lifecyclePriceEvidence(h.repository.snapshot(),work).replacement).toEqual(approved.approvedAmount);
  });
  it("returns a stable, tenant and store scoped history",async()=>{
    const h=harness();await recordWorkPrice(h.services,h.input);await recordWorkPrice(h.services,{...h.input,expectedVersion:1,submissionKey:"save-price-006"});
    expect((await h.repository.listWorkPrices("another-tenant",{})).total).toBe(0);
    expect((await h.repository.listWorkPrices(organizationId,{storeIds:[]})).total).toBe(0);
    const first=await h.repository.listWorkPrices(organizationId,{workOrderId:h.work.id,limit:1});const second=await h.repository.listWorkPrices(organizationId,{workOrderId:h.work.id,limit:1,offset:1});
    expect(first.total).toBe(2);expect(first.items[0].id).not.toBe(second.items[0].id);
  });
  it("keeps a selected compressor repair when a newer fan job exists",()=>{
    const h=harness();const result=lifecycleReviewWork(h.fixture,organizationId,h.work.assetId!,h.work.id,h.work.componentId);
    expect(result?.id).toBe(h.work.id);
    expect(lifecycleReviewWork(h.fixture,organizationId,h.work.assetId!,"wrong-work",h.work.componentId)).toBeUndefined();
    expect(lifecycleReviewWork(h.fixture,organizationId,h.work.assetId!,undefined,h.work.componentId)?.componentId).toBe(h.work.componentId);
  });
});
