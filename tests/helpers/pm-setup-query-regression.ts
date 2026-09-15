import { expect } from "vitest";
import type { OpsRepository, OrganizationScope } from "@/lib/ops/repository";
import type { OpsFixture } from "@/lib/ops/types";
import { pmSetupFromFixture, type PmSetupQuery } from "@/lib/ops/pm-setup-query";

export async function pmSetupQueryRegression(repository:OpsRepository,fixture:OpsFixture) {
  const organizationId=fixture.organizations[0].id,store=fixture.stores[0];
  const scopes:OrganizationScope[]=[{organizationId},{organizationId,storeIds:[store.id]},{organizationId,regionIds:[store.regionId!]},{organizationId,storeIds:[]},{organizationId,regionIds:[]},{organizationId:"foreign"}];
  for(const kind of ["programs","targets","plans"] as const) {
    const base:PmSetupQuery={asOf:fixture.asOf,kind,limit:7};
    for(const scope of scopes) expect(await repository.listPmSetup(scope,base),`${repository.kind} ${kind} ${JSON.stringify(scope)}`).toEqual(pmSetupFromFixture(fixture,scope,base));
    for(const changes of [{offset:14},{offset:100000},{filter:"gaps" as const},{filter:"changes" as const},{store:store.id},{region:store.regionId},{program:fixture.maintenancePrograms[0].id},{asset:"store"},{asset:fixture.assets[0].id},{store:"missing"}]) {
      const query={...base,...changes}; expect(await repository.listPmSetup({organizationId},query),`${repository.kind} ${JSON.stringify(query)}`).toEqual(pmSetupFromFixture(fixture,{organizationId},query));
    }
  }
}
