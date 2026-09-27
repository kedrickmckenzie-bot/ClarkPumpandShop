import { createWorkOrder, routeAndIssueWorkOrder, updateWorkOrderControl, OpsDomainError, type OpsCommandServices } from "./commands";
import { communicationAudit, evidenceFence, evidenceDigest, insertRecord } from "./email-intake";
import { masterDocuments, masterDocumentSnapshot } from "./compliance-documents";
import type { OpsRepository, OpsStatement } from "./repository";
import type { ActorContext, StoredFile } from "./types";
import type { ComplianceSchedule, Inspection } from "./compliance-types";
const DAY=86400000;
const nowOf=(svc:OpsCommandServices)=>svc.clock?.now()??new Date().toISOString();
const system=(organizationId:string):ActorContext=>({organizationId,actorType:"system",actorName:"Inspection scheduler"});
export function nextInspectionDate(s:ComplianceSchedule,after:string):string|null {
 if(s.intervalUnit==="once")return null;
 const first=new Date(`${s.firstDueDate}T12:00:00Z`),current=new Date(`${after}T12:00:00Z`);
 if(s.intervalUnit==="days")return new Date(current.getTime()+s.intervalCount*DAY).toISOString().slice(0,10);
 const month=current.getUTCMonth()+s.intervalCount;
 const next=new Date(Date.UTC(current.getUTCFullYear(),month,1,12));
 next.setUTCDate(Math.min(first.getUTCDate(),new Date(Date.UTC(next.getUTCFullYear(),next.getUTCMonth()+1,0)).getUTCDate()));
 return next.toISOString().slice(0,10);
}
function occurrence(s:ComplianceSchedule,dueDate:string,now:string):Inspection {return {id:`inspection-${s.id}-${dueDate}`,organizationId:s.organizationId,scheduleId:s.id,storeId:s.storeId,masterDocumentsJson:s.masterDocumentsJson,dueDate,status:"pending",version:0,createdAt:now};}
function inspectionInsert(i:Inspection) {return insertRecord("ops_inspections",{id:i.id,organization_id:i.organizationId,schedule_id:i.scheduleId,store_id:i.storeId,due_date:i.dueDate,master_documents_json:i.masterDocumentsJson,status:i.status,version:0,created_at:i.createdAt});}
function withStatements(repository:OpsRepository,extra:OpsStatement[]):OpsRepository {return new Proxy(repository,{get(target,key){if(key==="atomicWrite")return(statements:readonly OpsStatement[])=>target.atomicWrite([...statements,...extra]);const value=Reflect.get(target,key);return typeof value==="function"?value.bind(target):value;}});}
export async function createComplianceSchedule(svc:OpsCommandServices,input:Omit<ComplianceSchedule,"id"|"status"|"createdAt">,actor:ActorContext,templates:StoredFile[] = []) {
 if(actor.organizationId!==input.organizationId)throw new OpsDomainError("FORBIDDEN","Organization mismatch");
 if(!input.name.trim()||input.name.length>160||input.instructions.length>4000||!/^\d{4}-\d{2}-\d{2}$/.test(input.firstDueDate)||!Number.isFinite(Date.parse(input.firstDueDate))||new Date(input.firstDueDate).toISOString().slice(0,10)!==input.firstDueDate)throw new OpsDomainError("VALIDATION","Enter an inspection name and valid due date.");
 if(!["once","days","months"].includes(input.intervalUnit)||!Number.isInteger(input.intervalCount)||input.intervalCount<1||input.intervalCount>365||!Number.isInteger(input.leadDays)||input.leadDays<0||input.leadDays>90||![0,1].includes(input.evidenceRequired))throw new OpsDomainError("VALIDATION","Check the inspection frequency and reminder timing.");
 if(!input.evidenceLabel.trim()||input.evidenceLabel.length>300||input.requirementSource.length>500||!input.escalationTo.trim()||input.escalationTo.length>160||!Number.isInteger(input.escalationDays)||input.escalationDays<0||input.escalationDays>90||!["inspection","permit"].includes(input.kind))throw new OpsDomainError("VALIDATION","Check evidence requirements and escalation details.");
 if(input.assetId&&(await svc.repository.getAsset(input.organizationId,input.assetId))?.storeId!==input.storeId)throw new OpsDomainError("VALIDATION","Equipment must belong to this store.");
 if(!await svc.repository.getStore(input.organizationId,input.storeId))throw new OpsDomainError("NOT_FOUND","Store not found");
 if(input.handler==="vendor") {const v=input.vendorId?await svc.repository.getVendor(input.organizationId,input.vendorId):null;if(!v||v.status!=="approved"||input.membershipId||!await svc.repository.vendorCoversStore(input.organizationId,v.id,input.storeId))throw new OpsDomainError("VALIDATION","Choose an approved vendor covering this store.");}
 else if(input.handler==="internal") {const member=input.membershipId?await svc.repository.getMembership(input.organizationId,input.membershipId):null;if(!member||member.status!=="active"||!["facilities_admin","regional_manager","store_manager","internal_technician"].includes(member.role)||input.vendorId)throw new OpsDomainError("VALIDATION","Choose an active internal owner.");const grants=await svc.repository.listStoreIdsForMembership(input.organizationId,member.id);if(!grants.includes(input.storeId))throw new OpsDomainError("VALIDATION","The internal owner must have access to this store.");}
 else throw new OpsDomainError("VALIDATION","Choose internal or outside vendor.");
 const now=nowOf(svc),s:ComplianceSchedule={...input,masterDocumentsJson:masterDocumentSnapshot(templates,input.organizationId),name:input.name.trim(),id:`schedule-${crypto.randomUUID()}`,status:"active",createdAt:now};
 await svc.repository.atomicWrite([insertRecord("ops_compliance_schedules",{id:s.id,organization_id:s.organizationId,store_id:s.storeId,master_documents_json:s.masterDocumentsJson,name:s.name,instructions:s.instructions,requirement_source:s.requirementSource,evidence_label:s.evidenceLabel,asset_id:s.assetId,kind:s.kind,escalation_days:s.escalationDays,escalation_to:s.escalationTo,first_due_date:s.firstDueDate,interval_unit:s.intervalUnit,interval_count:s.intervalCount,lead_days:s.leadDays,handler:s.handler,membership_id:s.membershipId,vendor_id:s.vendorId,evidence_required:s.evidenceRequired,status:s.status,created_at:now}),inspectionInsert(occurrence(s,s.firstDueDate,now)),communicationAudit(s.organizationId,s.id,"compliance.schedule_created",actor,now,s,"compliance_schedule")]);
 return s;
}
export async function setComplianceScheduleStatus(svc:OpsCommandServices,s:ComplianceSchedule,status:"active"|"paused",actor:ActorContext) {
 if(actor.organizationId!==s.organizationId)throw new OpsDomainError("FORBIDDEN","Organization mismatch");
 await svc.repository.atomicWrite([{sql:"UPDATE ops_compliance_schedules SET status = ? WHERE organization_id = ? AND id = ?",params:[status,s.organizationId,s.id]},communicationAudit(s.organizationId,s.id,"compliance.schedule_status",actor,nowOf(svc),{status},"compliance_schedule")]);
}
export async function ensureInspectionWork(svc:OpsCommandServices,s:ComplianceSchedule,i:Inspection) {
 if(i.workOrderId)return svc.repository.getWorkOrder(i.organizationId,i.workOrderId);
 const now=nowOf(svc),actor=system(s.organizationId),key=`inspection-work:${i.id}`;
 const extra=[evidenceFence(s.organizationId,key,i.id,now),{sql:"UPDATE ops_inspections SET work_order_id = ? WHERE organization_id = ? AND id = ?",params:[] as unknown[]}];
 const id=`wo-${i.id}`;extra[1].params=[id,s.organizationId,i.id];
 const member=s.membershipId?await svc.repository.getMembership(s.organizationId,s.membershipId):null;
 const work=await createWorkOrder({...svc,clock:{now:()=>now},repository:withStatements(svc.repository,extra),ids:{next:prefix=>prefix==="work-order"?id:`${prefix}-${crypto.randomUUID()}`}},{organizationId:s.organizationId,storeId:s.storeId,assetId:s.assetId,problem:s.name,authorizedScope:`${s.instructions || s.name}\nInspection due ${i.dueDate}. ${s.evidenceRequired?"Provide the inspection report or photos.":"Record the inspection result."}`,priority:"planned",escalationTo:s.escalationTo,accountableParty:"Facilities coordinator",nextAction:"Complete inspection and record the result",dueAt:new Date(Math.max(Date.parse(now),Date.parse(`${i.dueDate}T23:59:59.000Z`))).toISOString(),initialAssignment:s.handler==="vendor"?{kind:"outside_vendor",vendorId:s.vendorId}:member?.role==="internal_technician"?{kind:"internal",internalMembershipId:member.id}:undefined,actor});
 return work;
}
async function issueInspection(svc:OpsCommandServices,s:ComplianceSchedule,i:Inspection) {
 const work=await ensureInspectionWork(svc,s,i);if(!work||s.handler!=="vendor")return;
 if(await svc.repository.getLatestIssuanceForWorkOrder(s.organizationId,work.id))return;
 const [store,vendor,org]=await Promise.all([svc.repository.getStore(s.organizationId,s.storeId),svc.repository.getVendor(s.organizationId,s.vendorId!),svc.repository.getOrganization(s.organizationId)]);
 if(!store||!vendor||!org)throw new Error("Inspection provider or store missing");
 const asset=work.assetId?await svc.repository.getAsset(s.organizationId,work.assetId):null;
 const now=nowOf(svc),id=`outbox-${crypto.randomUUID()}`;
 const extra=[insertRecord("ops_outbox_messages",{id,organization_id:s.organizationId,topic:"ops.compliance.authorization",aggregate_type:"inspection",aggregate_id:i.id,payload_json:JSON.stringify({workOrderId:work.id}),status:"pending",available_at:now,created_at:now,attempt_count:0})];
 await routeAndIssueWorkOrder({...svc,repository:withStatements(svc.repository,extra)},{organizationId:s.organizationId,workOrderId:work.id,vendorId:vendor.id,expectedRevision:0,channel:"email",publicToken:{tokenHash:await evidenceDigest(crypto.randomUUID()),expiresAt:new Date(Date.parse(now)+90*DAY).toISOString()},authorizationSnapshot:{organizationName:org.name,workOrderNumber:work.number,store:{id:store.id,storeNumber:store.storeNumber,name:store.name,formattedAddress:[store.address1,store.address2,`${store.city}, ${store.state} ${store.postalCode}`].filter(Boolean).join(", "),timeZone:store.timeZone},vendor:{id:vendor.id,name:vendor.name},problem:work.problem,priority:work.priority,asset:asset?{id:asset.id,name:asset.name,assetTag:asset.assetTag}:undefined,categoryKey:work.categoryKey,nte:work.nte,authorizedScope:work.authorizedScope,requestedTiming:work.dueAt,billingInstruction:`Include ${work.number} on inspection paperwork and invoices.`},actor:system(s.organizationId)});
}
export async function runInspectionCycle(svc:OpsCommandServices,onlyOrg?:string,onlySchedule?:string) {
 const now=nowOf(svc),today=now.slice(0,10),summary={created:0,prepared:0,reminders:0,failed:0,errors:[] as string[]};
 for(const org of onlyOrg?[onlyOrg]:await svc.repository.listComplianceOrganizations()) {
  for(let offset=0;;offset+=100){const schedules=await svc.repository.listComplianceSchedules({organizationId:org},offset);for(const s of schedules){if(s.status!=="active"||(onlySchedule&&s.id!==onlySchedule))continue;try{
   let last=await svc.repository.latestInspection(org,s.id);if(!last)continue;
   const horizon=new Date(Date.parse(now)+Math.max(90,s.leadDays)*DAY).toISOString().slice(0,10);
   for(let n=0;n<100;n++){const next=nextInspectionDate(s,last.dueDate);if(!next||next>horizon)break;const row=occurrence(s,next,now);await svc.repository.atomicWrite([evidenceFence(org,`inspection-cycle:${s.id}:${next}`,row.id,now),inspectionInsert(row),communicationAudit(org,row.id,"inspection.scheduled",system(org),now,{dueDate:next},"inspection")]);last=row;summary.created++;}
   for(let start=0;;start+=100){const page=await svc.repository.queryInspections({organizationId:org},{today,scheduleId:s.id,limit:100,offset:start});for(const i of page.items){if(i.status==="passed"||Date.parse(i.dueDate)-Date.parse(today)>s.leadDays*DAY)continue;try{
    await issueInspection(svc,s,i);summary.prepared++;
    const slot=Math.floor((Date.parse(today)-Date.parse(i.dueDate)+s.leadDays*DAY)/(7*DAY));const escalated=Date.parse(today)>=Date.parse(i.dueDate)-s.escalationDays*DAY;const key=`inspection-reminder:${i.id}:${slot}:${escalated?"escalated":"routine"}`;
    if(s.handler==="vendor"&&slot===0&&!escalated)continue;
    if(!await svc.repository.getIdempotencyKey(org,key)){const id=`outbox-${crypto.randomUUID()}`;await svc.repository.atomicWrite([evidenceFence(org,key,id,now),insertRecord("ops_outbox_messages",{id,organization_id:org,topic:"ops.compliance.reminder",aggregate_type:"inspection",aggregate_id:i.id,payload_json:"{}",status:"pending",available_at:now,created_at:now,attempt_count:0})]);summary.reminders++;}
   }catch(error){summary.failed++;if(summary.errors.length<10)summary.errors.push(error instanceof Error?error.message:"Inspection preparation failed");}}if(start+page.items.length>=page.totalCount)break;}
  }catch(error){summary.failed++;if(summary.errors.length<10)summary.errors.push(error instanceof Error?error.message:"Inspection preparation failed");}}if(schedules.length<100)break;}
 }
 return summary;
}
export async function recordInspectionResult(svc:OpsCommandServices,input:{inspectionId:string;organizationId:string;version:number;status:"performed"|"passed"|"action_needed";note:string;performedDate:string;documentExpiresOn?:string;files:StoredFile[]},actor:ActorContext) {
 if(actor.organizationId!==input.organizationId)throw new OpsDomainError("FORBIDDEN","Organization mismatch");
 const i=await svc.repository.getInspection(input.organizationId,input.inspectionId);if(!i)throw new OpsDomainError("NOT_FOUND","Inspection not found");
 if(i.version!==input.version)throw new OpsDomainError("CONFLICT","Inspection changed. Refresh before saving.");
 const s=await svc.repository.getComplianceSchedule(input.organizationId,i.scheduleId);if(!s)throw new OpsDomainError("NOT_FOUND","Schedule not found");
 if(input.status==="passed"&&actor.actorType==="user"){const reviewer=actor.actorId?await svc.repository.getMembership(input.organizationId,actor.actorId):null;if(!reviewer||reviewer.status!=="active"||!["facilities_admin","regional_manager"].includes(reviewer.role))throw new OpsDomainError("FORBIDDEN","A maintenance reviewer must approve the inspection result.");}
 const now=nowOf(svc);if(!["performed","passed","action_needed"].includes(input.status)||!input.note.trim()||input.note.length>4000||!/^\d{4}-\d{2}-\d{2}$/.test(input.performedDate)||!Number.isFinite(Date.parse(input.performedDate))||new Date(input.performedDate).toISOString().slice(0,10)!==input.performedDate||input.performedDate>now.slice(0,10))throw new OpsDomainError("VALIDATION","Enter the result, notes and a valid inspection date.");
 if(input.documentExpiresOn&&(!/^\d{4}-\d{2}-\d{2}$/.test(input.documentExpiresOn)||!Number.isFinite(Date.parse(input.documentExpiresOn))))throw new OpsDomainError("VALIDATION","Enter a valid document expiration date.");
 if(input.status==="passed"&&i.correctiveWorkOrderId){const correction=await svc.repository.getWorkOrder(i.organizationId,i.correctiveWorkOrderId);if(!correction||!["resolved","closed"].includes(correction.status))throw new OpsDomainError("VALIDATION","Resolve the corrective work before closing this inspection.");}
 const work=await ensureInspectionWork(svc,s,i);if(!work)throw new Error("Inspection work missing");
 if(input.files.length>5||input.files.reduce((sum,f)=>sum+f.byteLength,0)>8*1024*1024||input.files.some(f=>f.organizationId!==i.organizationId||f.status!=="available"||!Number.isSafeInteger(f.byteLength)||f.byteLength<0||!/^[a-f0-9]{64}$/.test(f.sha256)))throw new OpsDomainError("VALIDATION","Invalid inspection evidence");
 const existing=await svc.repository.listFilesForEntity(i.organizationId,"work_order",work.id);
 if(s.evidenceRequired&&input.status==="passed"&&!existing.length&&!input.files.length)throw new OpsDomainError("VALIDATION","Attach the report or photos before marking this inspection passed.");
 const statements:OpsStatement[]=[evidenceFence(i.organizationId,`inspection-result:${i.id}:${i.version}`,i.id,now),{sql:"UPDATE ops_inspections SET status = ?, completed_at = ?, result_note = ?, document_expires_on = ?, version = ? WHERE organization_id = ? AND id = ?",params:[input.status,input.performedDate,input.note.trim(),input.documentExpiresOn??null,i.version+1,i.organizationId,i.id]},communicationAudit(i.organizationId,i.id,"inspection.result_recorded",actor,now,{status:input.status,performedDate:input.performedDate,note:input.note,files:input.files.map(f=>f.id),previousVersion:i.version},"inspection")];
 for(const f of input.files)statements.push(insertRecord("ops_files",{id:f.id,organization_id:f.organizationId,storage_key:f.storageKey,sha256:f.sha256,original_name:f.originalName,content_type:f.contentType,byte_length:f.byteLength,status:f.status,created_at:now}),insertRecord("ops_entity_files",{id:`link-${crypto.randomUUID()}`,organization_id:i.organizationId,file_id:f.id,entity_type:"work_order",entity_id:work.id,purpose:"service_document",visibility:"internal",created_at:now}));
 if(input.status==="passed"&&!["closed","resolved"].includes(work.status))await updateWorkOrderControl({...svc,repository:withStatements(svc.repository,statements)},{organizationId:i.organizationId,workOrderId:work.id,expectedStatus:work.status,expectedVersion:work.version??0,status:"closed",manualCompletion:{source:"in_person",confirmedBy:actor.actorName},note:`Inspection result reviewed: ${input.note}`,actor});
 else await svc.repository.atomicWrite(statements);
}

export async function createInspectionCorrection(svc:OpsCommandServices,i:Inspection,problem:string,actor:ActorContext) {
 if(actor.organizationId!==i.organizationId)throw new OpsDomainError("FORBIDDEN","Organization mismatch");
 if(i.correctiveWorkOrderId)return svc.repository.getWorkOrder(i.organizationId,i.correctiveWorkOrderId);
 if(i.status!=="action_needed"||!problem.trim())throw new OpsDomainError("VALIDATION","Record a finding before creating corrective work.");
 const id=`correction-${i.id}`,now=nowOf(svc);
 const extra=[evidenceFence(i.organizationId,`inspection-result:${i.id}:${i.version}`,i.id,now),evidenceFence(i.organizationId,`inspection-correction:${i.id}`,id,now),{sql:"UPDATE ops_inspections SET corrective_work_order_id = ?, version = ? WHERE organization_id = ? AND id = ?",params:[id,i.version+1,i.organizationId,i.id]},communicationAudit(i.organizationId,i.id,"inspection.correction_created",actor,now,{workOrderId:id},"inspection")];
 return createWorkOrder({...svc,clock:{now:()=>now},repository:withStatements(svc.repository,extra),ids:{next:prefix=>prefix==="work-order"?id:`${prefix}-${crypto.randomUUID()}`}},{organizationId:i.organizationId,storeId:i.storeId,problem,accountableParty:"Facilities coordinator",nextAction:"Assign corrective work",actor});
}

export async function replaceComplianceDocuments(svc:OpsCommandServices,s:ComplianceSchedule,files:StoredFile[],actor:ActorContext) {
 if(actor.organizationId!==s.organizationId)throw new OpsDomainError("FORBIDDEN","Organization mismatch");
 const snapshot=masterDocumentSnapshot(files,s.organizationId),now=nowOf(svc);
 await svc.repository.atomicWrite([evidenceFence(s.organizationId,`inspection-forms:${s.id}:${await evidenceDigest(s.masterDocumentsJson??"[]")}`,crypto.randomUUID(),now),{sql:"UPDATE ops_compliance_schedules SET master_documents_json = ? WHERE organization_id = ? AND id = ?",params:[snapshot,s.organizationId,s.id]},communicationAudit(s.organizationId,s.id,"compliance.forms_updated",actor,now,{previous:masterDocuments(s),files},"compliance_schedule")]);
}
