import { expect } from "vitest";
import type { OpsRepository, OrganizationScope } from "@/lib/ops/repository";
import type { OpsFixture } from "@/lib/ops/types";
import { BRIEF_SOURCES, briefSourcesFromFixture, type BriefSource } from "@/lib/ops/owner-brief-query";

export async function briefQueryRegression(repository: OpsRepository, fixture: OpsFixture) {
  const organizationId = fixture.organizations[0].id;
  const store = fixture.stores[0];
  const period = { from: "2026-07-27", to: fixture.asOf.slice(0, 10), asOf: fixture.asOf, currency: "USD" };
  const scopes: OrganizationScope[] = [{ organizationId }, { organizationId, regionIds: [store.regionId!] }, { organizationId, storeIds: [store.id] }, { organizationId, storeIds: [] }, { organizationId: "foreign", storeIds: [store.id] }];
  for (const scope of scopes) for (const kind of Object.keys(BRIEF_SOURCES) as BriefSource[]) {
    const query = { kind, limit: 2 };
    const first = await repository.listBriefSources(scope, period, query);
    expect(first, `${kind} ${JSON.stringify(scope)}`).toEqual(briefSourcesFromFixture(fixture, scope, period, query));
    if (first.nextOffset !== undefined) {
      const next = { ...query, offset: first.nextOffset };
      expect(await repository.listBriefSources(scope, period, next), `${kind} second page`).toEqual(briefSourcesFromFixture(fixture, scope, period, next));
    }
    const empty = await repository.listBriefSources(scope, period, { ...query, offset: 10000 });
    expect(empty.items).toEqual([]);
    expect(empty.totalAmountMinor).toBe(first.totalAmountMinor);
    expect(empty.totalCount).toBe(first.totalCount);
  }
  for (const kind of Object.keys(BRIEF_SOURCES) as BriefSource[]) {
    const query = { kind, storeId: store.id, limit: 100 };
    expect(await repository.listBriefSources({ organizationId }, period, query)).toEqual(briefSourcesFromFixture(fixture, { organizationId }, period, query));
    expect((await repository.listBriefSources({ organizationId, storeIds: [] }, period, query)).totalCount).toBe(0);
  }
}
