import { expect } from "vitest";
import type { OpsRepository,OrganizationScope } from "@/lib/ops/repository";
import type { OpsFixture } from "@/lib/ops/types";
import { pmReviewFromFixture,type PmReviewQuery } from "@/lib/ops/pm-review-query";

export async function pmReviewQueryRegression(repository:OpsRepository,fixture:OpsFixture){
  const organizationId=fixture.organizations[0].id,review=fixture.serviceDiscrepancies.find(r=>r.factsJson.includes("pm_billed_vs_observed"))!,work=fixture.workOrders.find(w=>w.id===review.workOrderId)!,store=fixture.stores.find(s=>s.id===work.storeId)!;
  const scopes:OrganizationScope[]=[{organizationId},{organizationId,storeIds:[store.id]},{organizationId,regionIds:[store.regionId!]},{organizationId,storeIds:[fixture.stores.find(s=>s.id!==store.id)!.id]},{organizationId,storeIds:[]},{organizationId,regionIds:[]},{organizationId:"foreign"}];
  for(const kind of ["reviews","invoices","occurrences","visits"] as const){
    const base:PmReviewQuery={kind,review:kind==="reviews"?undefined:review.id,limit:2};
    for(const scope of scopes)expect(await repository.listPmReview(scope,base),`${repository.kind} ${kind} ${JSON.stringify(scope)}`).toEqual(pmReviewFromFixture(fixture,scope,base));
    for(const change of [{offset:2},{offset:1000},{missing:true},{store:store.id},{store:"missing"},{program:JSON.parse(review.factsJson).programId},{program:"missing"},{review:"missing"}]){const q={...base,...change};expect(await repository.listPmReview({organizationId},q),`${repository.kind} ${JSON.stringify(q)}`).toEqual(pmReviewFromFixture(fixture,{organizationId},q));}
  }
}
