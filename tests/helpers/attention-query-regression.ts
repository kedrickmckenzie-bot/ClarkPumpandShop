import { expect } from "vitest";
import type { OpsRepository, OrganizationScope } from "@/lib/ops/repository";
import type { OpsFixture } from "@/lib/ops/types";
import { attentionFromFixture, type AttentionAccess, type AttentionQueueRow } from "@/lib/ops/attention-query";

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
  for (const lane of ["mine", "team", "waiting", "upcoming"] as const) {
    expect(await repository.listAttention(scope, access, { ...query, lane })).toEqual(attentionFromFixture(fixture, scope, access, { ...query, lane }));
  }
  expect(await repository.listAttention(scope, access, { ...query, group: "financial" })).toEqual(attentionFromFixture(fixture, scope, access, { ...query, group: "financial" }));
  await expect(repository.listAttention(scope, access, { ...query, cursor: "broken" })).rejects.toThrow("page link");
  await expect(repository.listAttention(scope, access, { ...query, asOf: "broken" })).rejects.toThrow("review date");
}
