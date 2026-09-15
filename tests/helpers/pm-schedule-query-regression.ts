import { expect } from "vitest";
import type { OpsRepository, OrganizationScope } from "@/lib/ops/repository";
import type { OpsFixture } from "@/lib/ops/types";
import { PM_SCHEDULE_STATES, pmScheduleFromFixture, type PmScheduleQuery } from "@/lib/ops/pm-schedule-query";
import { pmAnalysisFromFixture, type PmAnalysisQuery } from "@/lib/ops/pm-analysis-query";

export async function pmScheduleQueryRegression(repository: OpsRepository, fixture: OpsFixture) {
  const organizationId = fixture.organizations[0].id, store = fixture.stores[0];
  const base = { asOf: fixture.asOf, limit: 7 };
  const queries: PmScheduleQuery[] = [base, ...PM_SCHEDULE_STATES.map(status => ({ ...base, status })),
    { ...base, status: "follow-up" }, { ...base, window: "closed" }, { ...base, view: "attention" }, { ...base, view: "upcoming" },
    { ...base, program: fixture.maintenancePrograms[0].id }, { ...base, occurrence: fixture.pmOccurrences[0].id },
    { ...base, store: store.id }, { ...base, region: store.regionId }, { ...base, store: "missing" }, { ...base, offset: 14 }, { ...base, offset: 100000 }];
  for (const query of queries) expect(await repository.listPmSchedule({ organizationId }, query), `${repository.kind}: ${JSON.stringify(query)}`).toEqual(pmScheduleFromFixture(fixture, { organizationId }, query));
  const scopes: OrganizationScope[] = [{ organizationId, storeIds: [store.id] }, { organizationId, regionIds: [store.regionId!] }, { organizationId, storeIds: [] }, { organizationId, regionIds: [] }, { organizationId: "foreign" }];
  for (const scope of scopes) for (const query of [base, { ...base, store: fixture.stores[6].id }, { ...base, region: fixture.stores[6].regionId }]) expect(await repository.listPmSchedule(scope, query)).toEqual(pmScheduleFromFixture(fixture, scope, query));
  for (const kind of ["months", "reactive-cost", "reactive-work", "cohort-equipment"] as const) {
    const analysisQueries: PmAnalysisQuery[] = [{ ...base, kind }, { ...base, kind, cohort: "completed" }, { ...base, kind, cohort: "missed" }, { ...base, kind, program: fixture.maintenancePrograms[0].id }, { ...base, kind, window: "closed" }, { ...base, kind, offset: 10000 }];
    if (kind === "reactive-cost" || kind === "months") analysisQueries.push({ ...base, kind, month: fixture.asOf.slice(0, 7) });
    for (const query of analysisQueries) expect(await repository.listPmAnalysis({ organizationId }, query), `${repository.kind}: ${JSON.stringify(query)}`).toEqual(pmAnalysisFromFixture(fixture, { organizationId }, query));
    for (const scope of scopes) expect(await repository.listPmAnalysis(scope, { ...base, kind })).toEqual(pmAnalysisFromFixture(fixture, scope, { ...base, kind }));
  }
}
