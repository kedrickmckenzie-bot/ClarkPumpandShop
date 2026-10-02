import {expect} from "vitest";
import {setStoreVendorPreference} from "@/lib/ops/store-vendors";
import type {OpsRepository} from "@/lib/ops/repository";
export async function storeVendorRegression(repository:OpsRepository) {
  const org="org-northline-demo",storeId="store-northline-104",other="store-northline-105";
  const actor={organizationId:org,actorType:"user" as const,actorId:"membership-northline-facilities",actorName:"Jordan Lee"};
  const svc={repository},scope={organizationId:org};
  const page=await repository.queryStoreVendors(scope,storeId,{});
  expect(page.items).toHaveLength(5);expect(page.items.every(v=>v.preferenceKeys.length===0)).toBe(true);
  expect(page).toMatchObject({total:5,preferredTotal:0,coveredTotal:5});
  const vendor=page.items.find(v=>v.specialties.some(s=>s.key==="electrical"))!;
  const companyPreference=(await repository.getVendor(org,vendor.id))!.preferred;
  const input={organizationId:org,storeId,vendorId:vendor.id,tradeKeys:["electrical"],version:0,actor};
  await setStoreVendorPreference(svc,input);
  expect((await repository.queryStoreVendors(scope,storeId,{})).items[0]).toMatchObject({id:vendor.id,preferenceKeys:["electrical"]});
  expect(await repository.queryStoreVendors(scope,storeId,{})).toMatchObject({preferredTotal:1,coveredTotal:5});
  expect((await repository.queryStoreVendors(scope,other,{})).items.find(v=>v.id===vendor.id)?.preferenceKeys).toEqual([]);
  expect((await repository.getVendor(org,vendor.id))!.preferred).toBe(companyPreference);
  await expect(setStoreVendorPreference(svc,input)).rejects.toMatchObject({code:"CONFLICT"});
  await expect(setStoreVendorPreference(svc,{...input,version:1,tradeKeys:["foreign-trade"]})).rejects.toMatchObject({code:"VALIDATION"});
  expect((await repository.queryStoreVendors({...scope,storeIds:[other]},storeId,{})).total).toBe(0);
  expect((await repository.queryStoreVendors({organizationId:"foreign"},storeId,{})).total).toBe(0);
  await expect(setStoreVendorPreference(svc,{...input,organizationId:"foreign",version:1})).rejects.toMatchObject({code:"FORBIDDEN"});
  await setStoreVendorPreference(svc,{...input,version:1,tradeKeys:[]});
  expect((await repository.queryStoreVendors(scope,storeId,{})).items.every(v=>v.preferenceKeys.length===0)).toBe(true);
  const race=await Promise.allSettled([setStoreVendorPreference(svc,{...input,version:2,tradeKeys:["*"]}),setStoreVendorPreference(svc,{...input,version:2})]);
  expect(race.filter(r=>r.status==="fulfilled")).toHaveLength(1);
  const store=(await repository.getStore(org,storeId))!;
  for(const search of [store.storeNumber,store.name,store.address1,store.postalCode,...store.aliases]) {
    expect((await repository.searchStores(scope,search,{limit:100})).items.some(s=>s.id===storeId)).toBe(true);
  }
}
