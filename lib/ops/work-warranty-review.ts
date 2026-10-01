import type { OpsRepository, OrganizationScope } from "./repository";

/** Enrich only the visible page, sharing reads when multiple tasks reference one job. */
export async function workWarrantyMarkers(repository:OpsRepository,scope:OrganizationScope,workIds:string[],today:string) {
  const ids=[...new Set(workIds)];
  const matches=await Promise.all(ids.map(async id=>[id,(await workWarrantyReview(repository,scope,id,today))?.possible??false] as const));
  return new Map(matches);
}

export async function workWarrantyReview(repository: OpsRepository, scope: OrganizationScope, workId: string, today: string) {
  const work = await repository.getWorkOrderDetail(scope, workId);
  if (!work?.asset) return null;
  const [coverage, decisions, sources] = await Promise.all([
    repository.listWarrantyDirectory(scope, { today, view: "active", assetId: work.asset.id, componentId: work.component?.id, limit: 100 }),
    repository.listWorkWarrantyDecisions(scope.organizationId, workId),
    repository.getAssetWarrantySources(scope.organizationId,work.asset.id),
  ]);
  const terms=coverage.items.map(c=>{
    const applied=sources.appliedWarranties.find(w=>w.id===c.id),registered=sources.manufacturerWarranties.find(w=>w.id===c.id);
    const repair=applied?sources.repairItems.find(r=>r.id===applied.repairItemId):undefined;
    return {...c,diagnostic:(applied?.coverageType==="diagnostic" || (applied?.coveredCharges??registered?.coveredCharges??[]).includes("diagnostic"))?"Covered by this term":"Not recorded as covered",replacementDate:repair?.installedComponentId?repair.completionDate:undefined};
  });
  const signature = JSON.stringify([work.asset.id, work.component?.id ?? null, coverage.totalCount, terms.map(c => [c.id, c.start, c.end, c.parts, c.labor, c.travel,c.diagnostic]).sort()]);
  const decision = decisions.find(d => { try { return JSON.parse(d.payloadJson).signature === signature; } catch { return false; } });
  return { work, coverage:{...coverage,items:terms}, signature, decision, possible: coverage.totalCount > 0 && !decision };
}
