import { expect } from "vitest";
import type { OpsRepository, OrganizationScope } from "@/lib/ops/repository";
import type { OpsFixture } from "@/lib/ops/types";
import { attentionFromFixture, type AttentionAccess, type AttentionQueueRow } from "@/lib/ops/attention-query";
import { attentionSourcesFromFixture } from "@/lib/ops/attention-sources";

export async function attentionQueryRegression(repository: OpsRepository, fixture: OpsFixture) {
  const organizationId = fixture.organizations[0].id;
  const store = fixture.stores.find(row => row.storeNumber === "104")!;
  const access: AttentionAccess = { role: "facilities_admin", membershipId: "membership-northline-facilities", canOpenWarranty: true, canOpenRequest: true };
  const query = { asOf: fixture.asOf, limit: 100 };
  for (const role of ["facilities_admin", "executive", "regional_manager", "store_manager", "finance_reviewer"] as const) {
    const viewer = { ...access, role, canOpenWarranty: role !== "store_manager", canOpenRequest: role !== "finance_reviewer" };
    for (const accountabilityOnly of [false, true]) {
      const scoped: OrganizationScope = { organizationId, storeIds: role === "store_manager" ? [store.id] : undefined, regionIds: role === "regional_manager" ? [store.regionId!] : undefined };
      expect(await repository.listAttention(scoped, { ...viewer, accountabilityOnly }, query), `${repository.kind}: ${role}/${accountabilityOnly}`).toEqual(attentionFromFixture(fixture, scoped, { ...viewer, accountabilityOnly }, query));
    }
  }
  for (const scope of [{ organizationId, storeIds: [] }, { organizationId, regionIds: [] }, { organizationId: "foreign-tenant", storeIds: [store.id] }]) {
    expect(await repository.listAttention(scope, access, query)).toEqual({ items: [], totalCount: 0, mineCount: 0, followUpCount: 0, nextCursor: undefined });
  }
  const scope = { organizationId };
  const first = await repository.listAttention(scope, access, { ...query, limit: 7 });
  expect(first.items).toHaveLength(7);
  expect(first.totalCount).toBeGreaterThan(7);
  const rows: AttentionQueueRow[] = [...first.items];
  let cursor = first.nextCursor;
  while (cursor) {
    if (rows.length > 500) throw new Error("Attention pagination did not terminate");
    const next = await repository.listAttention(scope, access, { ...query, cursor, limit: 7 });
    expect(next.totalCount).toBe(first.totalCount);
    expect(next.mineCount).toBe(first.mineCount);
    expect(next.followUpCount).toBe(first.followUpCount);
    rows.push(...next.items);
    cursor = next.nextCursor;
  }
  expect(rows).toEqual(attentionFromFixture(fixture, scope, access, query).items);
  expect(new Set(rows.map(row => row.id)).size).toBe(first.totalCount);
  expect(await repository.listAttention(scope, access, { ...query, offset: 10000 })).toEqual({ ...first, items: [], nextCursor: undefined });
  for (const lane of ["mine", "team", "waiting", "upcoming", "history"] as const) {
    expect(await repository.listAttention(scope, access, { ...query, lane })).toEqual(attentionFromFixture(fixture, scope, access, { ...query, lane }));
  }
  for (const filters of [{ q: "104" }, { q: "quote" }, { q: "Check the diagnosis" }, { q: "Create or link a work order" }, { q: "100%_\\" }, { priority: "urgent" as const, type: "follow-up" as const }, { lane: "history" as const, priority: "standard" as const }, { lane: "history" as const, priority: "urgent" as const }, { itemIds: first.items.slice(1, 3).map(row => row.id) }]) {
    expect(await repository.listAttention(scope, access, { ...query, ...filters })).toEqual(attentionFromFixture(fixture, scope, access, { ...query, ...filters }));
  }
  for (const kind of ["workflow_task","follow_up","exception","vendor_reminder","held_work","quote_round"] as const) {
    const item=rows.find(row=>row.sourceKind===kind); if(!item) continue;
    for(const page of [{limit:2},{limit:2,offset:2},{limit:2,offset:10000}]) {
      expect(await repository.listAttentionSources(scope,access,query,item.id,page)).toEqual(attentionSourcesFromFixture(fixture,scope,access,query,item.id,page));
    }
    expect(await repository.listAttentionSources({...scope,storeIds:[]},access,query,item.id,{limit:2})).toBeNull();
  }
  const scopedQuery={...query,store:store.id};
  expect(await repository.listAttention(scope,access,{...query,q:"Waiting on another party"})).toEqual(attentionFromFixture(fixture,scope,access,{...query,q:"Waiting on another party"}));
  expect(await repository.listAttention(scope,access,scopedQuery)).toEqual(attentionFromFixture(fixture,scope,access,scopedQuery));
  expect((await repository.listAttention({...scope,storeIds:[fixture.stores.find(s=>s.id!==store.id)!.id]},access,scopedQuery)).totalCount).toBe(0);
  const historyQuery={...query,lane:"history" as const,limit:2};
  const historyFirst=await repository.listAttention(scope,access,historyQuery);
  if(historyFirst.nextCursor) expect(await repository.listAttention(scope,access,{...historyQuery,cursor:historyFirst.nextCursor})).toEqual(attentionFromFixture(fixture,scope,access,{...historyQuery,cursor:historyFirst.nextCursor}));
  if(historyFirst.items[0]) expect(await repository.listAttentionSources(scope,access,historyQuery,historyFirst.items[0].id,{limit:25})).toEqual(attentionSourcesFromFixture(fixture,scope,access,historyQuery,historyFirst.items[0].id,{limit:25}));
  expect(await repository.listAttention(scope, access, { ...query, group: "financial" })).toEqual(attentionFromFixture(fixture, scope, access, { ...query, group: "financial" }));
  await expect(repository.listAttention(scope, access, { ...query, cursor: "broken" })).rejects.toThrow("page link");
  await expect(repository.listAttention(scope, access, { ...query, asOf: "broken" })).rejects.toThrow("review date");
}
