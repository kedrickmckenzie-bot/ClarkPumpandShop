import { expect } from "vitest";
import type { OpsRepository } from "@/lib/ops/repository";
import { createWorkOrder } from "@/lib/ops/commands";
import { recordWorkPrice } from "@/lib/ops/work-price-commands";
import { workPricePlan, applyWorkPricePlan } from "@/lib/ops/work-price-planning";

export async function workPricePersistenceRegression(repository: OpsRepository) {
  const organizationId="org-northline-demo";
  const actor={organizationId,actorType:"user" as const,actorId:"membership-northline-facilities",actorName:"Jordan Lee"};
  const services={repository,clock:{now:()=>"2026-09-11T12:00:00.000Z"}};
  const work=await createWorkOrder(services,{organizationId,storeId:"store-northline-101",assetId:"asset-101-beer-cave",problem:"Price history integration check",accountableParty:"Facilities",nextAction:"Review prices",actor});
  const input={organizationId,workOrderId:work.id,vendorId:"vendor-northline-summit",kind:"repair" as const,scopeKind:"job" as const,scope:"Repair price from phone call",amountMinor:900_000,currency:"USD",expectedVersion:0,submissionKey:"persisted-price-"+crypto.randomUUID(),actor};
  const repair=await recordWorkPrice(services,input);
  expect(await recordWorkPrice(services,input)).toEqual(repair);
  expect((await repository.getWorkOrder(organizationId,work.id))?.repairEstimate).toEqual(repair.amount);
  const replacement=await recordWorkPrice(services,{...input,kind:"replace",scopeKind:"whole",expectedVersion:1,amountMinor:3_500_000,submissionKey:"persisted-price-"+crypto.randomUUID()});
  const plan=await workPricePlan(services,organizationId,replacement.id,actor);
  const benchmarkId=await applyWorkPricePlan(services,{organizationId,priceId:replacement.id,signature:plan.signature,actor});
  expect(await applyWorkPricePlan(services,{organizationId,priceId:replacement.id,signature:plan.signature,actor})).toBe(benchmarkId);
  const benchmark=await repository.getPublishedReplacementBenchmark(organizationId,plan.profile.id);
  expect(benchmark).toMatchObject({id:benchmarkId,sourceType:"reported_price",totalAmount:replacement.amount});
  expect(benchmark?.installationAmount).toBeUndefined();expect(benchmark?.equipmentAmount).toBeUndefined();
  const history=await repository.listWorkPrices(organizationId,{workOrderId:work.id,limit:1});
  expect(history.total).toBe(2);expect(history.items).toHaveLength(1);
  expect((await repository.listWorkPrices(organizationId,{storeIds:[]})).total).toBe(0);
  expect(await repository.getWorkPrice("another-tenant",repair.id)).toBeNull();
  expect((await repository.listWorkPrices(organizationId,{workOrderId:work.id,kind:"repair"})).items[0].amount).toEqual(repair.amount);
}
