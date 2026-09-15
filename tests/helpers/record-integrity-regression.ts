import { expect } from "vitest";
import type { OpsRepository } from "@/lib/ops/repository";
import type { OpsFixture } from "@/lib/ops/types";
import { INTEGRITY_SOURCES, integrityFromFixture, type IntegritySource } from "@/lib/ops/record-integrity-query";

export async function recordIntegrityRegression(repository: OpsRepository, fixture: OpsFixture) {
  const organizationId = fixture.organizations[0].id, store = fixture.stores[0];
  for (const scope of [{ organizationId }, { organizationId, storeIds: [store.id] }, { organizationId, regionIds: [store.regionId!] }, { organizationId, storeIds: [] }, { organizationId: "foreign", storeIds: [store.id] }]) {
    for (const kind of Object.keys(INTEGRITY_SOURCES) as IntegritySource[]) {
      const query = { kind, limit: 2 };
      const actual = await repository.listRecordIntegrity(scope, fixture.asOf, query);
      expect(actual, `${kind} ${JSON.stringify(scope)}`).toEqual(integrityFromFixture(fixture, scope, fixture.asOf, query));
      expect(actual.counts.with_outcome + actual.counts.without_outcome).toBe(actual.counts.closed_work);
      expect(actual.counts.with_cost + actual.counts.without_cost).toBe(actual.counts.closed_work);
      expect(actual.counts.verified + actual.counts.unverified).toBe(actual.counts.vendor_closed);
      if (actual.nextOffset !== undefined) {
        const next = { ...query, offset: actual.nextOffset };
        expect(await repository.listRecordIntegrity(scope, fixture.asOf, next)).toEqual(integrityFromFixture(fixture, scope, fixture.asOf, next));
      }
    }
    const empty = await repository.listRecordIntegrity(scope, fixture.asOf, { kind: "closed_work", offset: 10000 });
    expect(empty.items).toEqual([]);
    expect(empty.counts).toEqual(integrityFromFixture(fixture, scope, fixture.asOf, { kind: "closed_work" }).counts);
  }
}
