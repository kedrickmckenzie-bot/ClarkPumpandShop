import type { OpsRepository } from "./repository";
import type { ComplianceSchedule } from "./compliance-types";
import type { ActorContext } from "./types";
import { OpsDomainError } from "./errors";
import { communicationAudit, evidenceDigest, insertRecord } from "./email-intake";

const assigneeKey=(s:ComplianceSchedule)=>`inspection:${s.handler}:${s.membershipId??s.vendorId}`;
export async function inspectionAssignee(r:OpsRepository,s:ComplianceSchedule) {
 if(s.handler==="vendor") {
  const vendor=s.vendorId?await r.getVendor(s.organizationId,s.vendorId):null;
  if(!vendor||vendor.status!=="approved"||!await r.vendorCoversStore(s.organizationId,vendor.id,s.storeId))return null;
  return {email:vendor.dispatchEmail,name:vendor.name,actor:{organizationId:s.organizationId,actorType:"vendor_link",actorId:vendor.id,actorName:`${vendor.name} · inspection link`} as ActorContext};
 }
 const member=s.membershipId?await r.getMembership(s.organizationId,s.membershipId):null;
 if(!member||member.status!=="active"||["vendor_user","support"].includes(member.role)||!(await r.listStoreIdsForMembership(s.organizationId,member.id)).includes(s.storeId))return null;
 const user=await r.getUserInOrganization(s.organizationId,member.userId);
 if(!user||user.status!=="active")return null;
 return {email:user.email,name:user.displayName,actor:{organizationId:s.organizationId,actorType:"user",actorId:member.id,actorName:`${user.displayName} · inspection link`} as ActorContext};
}
export async function createInspectionLink(r:OpsRepository,org:string,id:string,actor:ActorContext,now=new Date().toISOString()) {
 if(actor.organizationId!==org)throw new OpsDomainError("FORBIDDEN","Organization mismatch");
 const inspection=await r.getInspection(org,id),schedule=inspection?await r.getComplianceSchedule(org,inspection.scheduleId):null;
 if(!inspection||!schedule||schedule.status!=="active"||!inspection.workOrderId||inspection.status==="passed"||!await inspectionAssignee(r,schedule))throw new OpsDomainError("VALIDATION","Prepare the inspection work and check its assignee before creating a link.");
 const raw=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,"0")).join("");
 const tokenId=`inspection-token-${crypto.randomUUID()}`;
 await r.atomicWrite([insertRecord("ops_public_tokens",{id:tokenId,organization_id:org,purpose:"inspection_submission",subject_type:assigneeKey(schedule),subject_id:id,token_hash:await evidenceDigest(raw),expires_at:new Date(Date.parse(now)+30*86400000).toISOString(),created_at:now}),communicationAudit(org,id,"inspection.link_created",actor,now,{tokenId},"inspection")]);
 return `/public/inspection/${raw}`;
}
export async function resolveInspectionLink(r:OpsRepository,raw:string,now=new Date().toISOString()) {
 if(!/^[a-f0-9]{64}$/.test(raw))throw new OpsDomainError("NOT_FOUND","This inspection link is unavailable or expired.");
 const token=await r.getInspectionAccessToken({purpose:"inspection_submission",tokenHash:await evidenceDigest(raw),now});
 const inspection=token?await r.getInspection(token.organizationId,token.inspectionId):null;
 const schedule=inspection?await r.getComplianceSchedule(inspection.organizationId,inspection.scheduleId):null;
 if(!token||!inspection||!schedule||schedule.status!=="active"||assigneeKey(schedule)!==token.assigneeKey||!inspection.workOrderId)throw new OpsDomainError("NOT_FOUND","This inspection link is unavailable or expired.");
 const [assignee,work,store]=await Promise.all([inspectionAssignee(r,schedule),r.getWorkOrder(inspection.organizationId,inspection.workOrderId),r.getStore(inspection.organizationId,inspection.storeId)]);
 const assignment=await r.getLatestServiceAssignment(inspection.organizationId,inspection.workOrderId);
 if(!assignee||!work||!store||work.status==="cancelled"||assignment && (schedule.handler==="vendor"?assignment.vendorId!==schedule.vendorId:assignment.internalMembershipId!==schedule.membershipId))throw new OpsDomainError("NOT_FOUND","This inspection link is unavailable or expired.");
 return {inspection,schedule,assignee,work,store};
}

export async function inspectionSubmissionFiles(r:OpsRepository,org:string,inspectionId:string,workId:string) {
 const history=await r.inspectionHistory(org,inspectionId);
 const fileIds=new Set<string>(history.filter(h=>h.eventType==="inspection.result_recorded").flatMap(h=>{try{return JSON.parse(h.payloadJson).files??[];}catch{return [];}}));
 return (await r.listFilesForEntity(org,"work_order",workId)).filter(f=>fileIds.has(f.id));
}
