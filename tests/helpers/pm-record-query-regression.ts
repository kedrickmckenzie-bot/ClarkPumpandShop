import { expect } from "vitest";
import type { OpsRepository } from "@/lib/ops/repository";
import type { OpsFixture } from "@/lib/ops/types";
import { readPmOccurrenceRecord, readPmPlanRecord, workVisitEvidenceFromFixture } from "@/lib/ops/pm-record-query";

export async function pmRecordQueryRegression(repository: OpsRepository, fixture: OpsFixture) {
  const organizationId = fixture.organizations[0].id;
  const occurrence = fixture.pmOccurrences.find(row => row.workOrderId)!;
  const store = fixture.stores.find(row => row.id === occurrence.storeId)!;
  const other = fixture.stores.find(row => row.id !== store.id && row.regionId !== store.regionId)!;
  const scopes = [ { organizationId }, { organizationId, storeIds: [store.id] }, { organizationId, regionIds: [store.regionId!] }, { organizationId, storeIds: [] }, { organizationId, regionIds: [] }, { organizationId, storeIds: [other.id] }, { organizationId, storeIds: [store.id], regionIds: [other.regionId!] }, { organizationId: "foreign-organization" } ];
  for (const scope of scopes) {
    for (const offset of [0, 1, 10000]) {
      const query = { limit: 1, offset };
      expect(await repository.listWorkVisitEvidence(scope, occurrence.workOrderId!, query)).toEqual(workVisitEvidenceFromFixture(fixture, scope, occurrence.workOrderId!, query));
    }
    const visible = scope.organizationId === organizationId && (scope.storeIds === undefined || scope.storeIds.includes(store.id)) && (scope.regionIds === undefined || scope.regionIds.includes(store.regionId!));
    const record = await readPmOccurrenceRecord(repository, scope, occurrence.id);
    expect(record?.occurrence.id ?? null).toBe(visible ? occurrence.id : null);
    if (visible) {
      expect(record?.store.id).toBe(store.id);
      expect(record?.work?.storeId).toBe(store.id);
      expect((await readPmPlanRecord(repository, scope, occurrence.planId))?.store.id).toBe(store.id);
    }
  }
  expect(await readPmOccurrenceRecord(repository, { organizationId }, "missing")).toBeNull();
  expect(await readPmPlanRecord(repository, { organizationId }, "missing")).toBeNull();
}
