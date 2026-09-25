import { vendorFacingScope } from "./public-visibility";
import { OpsDomainError } from "./errors";
import { heldWorkVendorEligibility } from "./held-work-policy";
import type { OpsRepository } from "./repository";
import type { ServiceAuthorizationSnapshot } from "./view-models";
export type OfferedWork = { id:string; number:string; problem:string; scope:string; category?:string; version:number; holdId:string; holdVersion:number };
export const offerResponseKey = (issuanceId:string, workId:string) => `optional-work:${issuanceId}:${workId}`;
export async function prepareOfferedWork(repository:OpsRepository, organizationId:string, storeId:string, vendorId:string, ids:readonly string[], now:string) {
  if (ids.length > 20 || new Set(ids).size !== ids.length) throw new OpsDomainError("VALIDATION", "Choose each saved job once, up to 20 jobs.");
  return Promise.all(ids.map(async id => {
    const work = await repository.getWorkOrder(organizationId,id);
    const hold = await repository.getWorkOrderVisitHold(organizationId,id);
    if (!work || work.storeId !== storeId || work.status !== "approved" || !hold || hold.status !== "active") throw new OpsDomainError("CONFLICT", "A selected saved job changed. Review the list before sending.");
    const eligibility = await heldWorkVendorEligibility({repository,organizationId,vendorId,workOrder:work,now});
    if (!eligibility.allowed) throw new OpsDomainError("CONFLICT", `${work.number}: ${eligibility.reason}`);
    return {id:work.id,number:work.number,problem:work.problem,scope:(hold.posture === "look_and_report" ? "Inspect and report back only; repairs need separate approval. " : "") + vendorFacingScope(work.authorizedScope ?? work.problem),category:work.categoryKey,version:work.version ?? 0,holdId:hold.id,holdVersion:hold.version} satisfies OfferedWork;
  }));
}
export async function resolveOfferedWork(repository:OpsRepository, organizationId:string, issuanceId:string, workId:string, vendorId:string, now:string) {
  const source=await repository.getIssuance(organizationId,issuanceId);
  if (!source) throw new OpsDomainError("NOT_FOUND","Offer not found.");
  const parent=await repository.getWorkOrder(organizationId,source.workOrderId);
  const latest=await repository.getLatestIssuanceForWorkOrder(organizationId,source.workOrderId);
  const assignment=await repository.getActiveAssignment(organizationId,source.workOrderId);
  const snapshot=JSON.parse(source.immutablePayloadJson) as ServiceAuthorizationSnapshot;
  const offered=snapshot.offeredWork?.find(j=>j.id===workId);
  if (!parent || !offered || workId===parent.id || latest?.id!==source.id || assignment?.id!==source.assignmentId || assignment.vendorId!==vendorId || ["declined","cancelled","superseded"].includes(assignment.status) || ["closed","cancelled","resolved","completed_pending_review"].includes(parent.status)) throw new OpsDomainError("FORBIDDEN","This offer is no longer available.");
  const prior=await repository.getIdempotencyKey(organizationId,offerResponseKey(issuanceId,workId));
  if (prior) return {parent,offered,prior};
  const [current]=await prepareOfferedWork(repository,organizationId,parent.storeId,vendorId,[workId],now);
  if (JSON.stringify(current)!==JSON.stringify(offered)) throw new OpsDomainError("CONFLICT","This saved job changed. Ask the operator to send an updated offer.");
  return {parent,offered,prior:null};
}
