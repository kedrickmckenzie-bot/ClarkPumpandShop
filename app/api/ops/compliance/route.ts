import { getOpsRequestContext,assertStoreInSessionScope,formText,opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";
import { OpsDomainError } from "@/lib/ops/commands";
import { createComplianceSchedule,runInspectionCycle,recordInspectionResult,setComplianceScheduleStatus,createInspectionCorrection,replaceComplianceDocuments } from "@/lib/ops/compliance";
import { uploadInspectionFiles as uploadFiles } from "@/lib/server/inspection-uploads";
import { createInspectionLink } from "@/lib/ops/inspection-access";
import type { ComplianceSchedule } from "@/lib/ops/compliance-types";
export async function POST(request:Request) {
 let back="/app/compliance";
 try {
  const {session,repository,actor}=await getOpsRequestContext(["facilities","regional","store_manager"],undefined,request);
  const form=await request.formData(),action=formText(form,"action"),org=session.organizationId,svc={repository};
  const manage=["facilities","regional"].includes(session.role);
  if(action!=="result"&&!manage)throw new OpsDomainError("FORBIDDEN","Schedule management is restricted to facilities and regional managers.");
  if(action==="cycle") {
   if(session.role!=="facilities"||session.storeIds!==undefined||session.regionIds!==undefined)throw new OpsDomainError("FORBIDDEN","Companywide facilities access is required.");
   const result=await runInspectionCycle(svc,org);return relativeRedirect303(`/app/compliance?notice=${encodeURIComponent(`${result.created} dates created; ${result.prepared} inspections prepared; ${result.reminders} reminders queued; ${result.failed} need review.${result.errors.length?` ${result.errors.join("; ")}`:""} No email sent by this action.`)}`);
  }
  if(action==="create") {
   back="/app/compliance/new";const storeId=formText(form,"storeId",{required:true});await assertStoreInSessionScope(session,storeId);
   const tag=formText(form,"assetTag",{max:100});const assets=tag?(await repository.searchAssets({...session,storeIds:[storeId]},tag,{limit:100})).items.filter(a=>a.assetTag===tag):[];
   if(tag&&assets.length!==1)throw new OpsDomainError("VALIDATION","Enter an exact equipment tag at the selected store.");
   const templates=await uploadFiles(form,"templates",org,`schedule-${crypto.randomUUID()}`,session.accessMode==="preview");
   const schedule=await createComplianceSchedule(svc,{organizationId:org,storeId,name:formText(form,"name",{required:true,max:160}),instructions:formText(form,"instructions",{max:4000}),requirementSource:formText(form,"requirementSource",{max:500}),evidenceLabel:formText(form,"evidenceLabel",{required:true,max:300}),assetId:assets[0]?.id,kind:formText(form,"kind") as ComplianceSchedule["kind"],firstDueDate:formText(form,"firstDueDate"),intervalUnit:formText(form,"intervalUnit") as ComplianceSchedule["intervalUnit"],intervalCount:Number(form.get("intervalCount")),leadDays:Number(form.get("leadDays")),handler:formText(form,"handler") as ComplianceSchedule["handler"],membershipId:formText(form,"membershipId")||undefined,vendorId:formText(form,"vendorId")||undefined,evidenceRequired:Number(form.get("evidenceRequired")),escalationDays:Number(form.get("escalationDays")),escalationTo:formText(form,"escalationTo",{required:true,max:160})},actor,templates);
   const result=await runInspectionCycle(svc,org,schedule.id);const first=await repository.queryInspections(session,{today:new Date().toISOString().slice(0,10),scheduleId:schedule.id,limit:1});
   return relativeRedirect303(`/app/compliance/${first.items[0].id}?notice=${encodeURIComponent(result.failed?"Schedule saved. Work preparation needs review; check the assigned provider and work order.":"Schedule created. Eligible work and reminders queued.")}`);
  }
  const id=formText(form,"inspectionId",{required:true,max:200});back=`/app/compliance/${encodeURIComponent(id)}`;
  const inspection=await repository.getInspection(org,id);if(!inspection)throw new OpsDomainError("NOT_FOUND","Inspection not found");await assertStoreInSessionScope(session,inspection.storeId);
  const schedule=await repository.getComplianceSchedule(org,inspection.scheduleId);if(!schedule)throw new OpsDomainError("NOT_FOUND","Schedule not found");
  if(action==="link") { return relativeRedirect303(await createInspectionLink(repository,org,id,actor)); }
  if(action==="templates") { await replaceComplianceDocuments(svc,schedule,await uploadFiles(form,"templates",org,schedule.id,session.accessMode==="preview"),actor); }
  else if(action==="pause") {const status=formText(form,"scheduleStatus");if(status!=="active"&&status!=="paused")throw new OpsDomainError("VALIDATION","Choose a schedule status");await setComplianceScheduleStatus(svc,schedule,status,actor);}
  else if(action==="correction") {await createInspectionCorrection(svc,inspection,formText(form,"problem",{required:true,max:4000}),actor);}
  else if(action==="result") {
   const status=formText(form,"status");if(!["performed","passed","action_needed"].includes(status)||status==="passed"&&!manage)throw new OpsDomainError("FORBIDDEN","Only a maintenance reviewer can close an inspection.");
   if(inspection.version!==Number(form.get("version")))throw new OpsDomainError("CONFLICT","Inspection changed. Refresh before saving.");
   const storedFiles=await uploadFiles(form,"attachments",org,id,session.accessMode==="preview");
   await recordInspectionResult(svc,{organizationId:org,inspectionId:id,version:inspection.version,createCorrection:form.get("createCorrection")==="on",status:status as "performed"|"passed"|"action_needed",note:formText(form,"note",{required:true,max:4000}),performedDate:formText(form,"performedDate"),documentExpiresOn:formText(form,"documentExpiresOn")||undefined,files:storedFiles},actor);
  }else throw new OpsDomainError("VALIDATION","Unknown inspection action");
  return relativeRedirect303(`${back}?notice=Inspection+updated`);
 }catch(error){if(error instanceof OpsDomainError&&["VALIDATION","CONFLICT"].includes(error.code))return relativeRedirect303(`${back}?error=${encodeURIComponent(error.message)}`);return opsApiError(error);}
}
