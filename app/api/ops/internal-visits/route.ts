import { internalCheckoutNotes } from "@/lib/server/internal-checkout-notes";
import { checkInVisit, checkOutVisit, addHeldWorkToActiveVisit } from "@/lib/ops/commands";
import { dispatchIdentity } from "@/lib/ops/internal-dispatch";
import { persistedWorkOrderVersion } from "@/lib/ops/concurrency";
import { getOpsRequestContext, formText, assertStoreInSessionScope, opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";
import { storeCompletionFiles } from "@/lib/server/work-completion-files";
import { OpsDomainError } from "@/lib/ops/errors";
import type { SiteVisitWorkOrderOutcome } from "@/lib/ops/types";

export async function POST(request:Request){try{
  const form=await request.formData(), c=await getOpsRequestContext(["technician"],"record_internal_result",request), r=c.repository,org=c.session.organizationId;
  const action=formText(form,"action",{required:true,max:20}),key=formText(form,"submissionKey",{required:true,max:120});
  if(!/^[A-Za-z0-9_-]{8,120}$/.test(key)||!["check_in","check_out","add_work"].includes(action))throw new OpsDomainError("VALIDATION","Choose a valid visit action.");
  const visitId=formText(form,"visitId",{max:120}), visit=visitId?await r.getVisit(org,visitId):undefined;
  if(visitId&&(!visit||visit.internalMembershipId!==c.session.membershipId))throw new OpsDomainError("FORBIDDEN","This visit belongs to another technician.");
  const storeId=visit?.storeId??formText(form,"storeId",{required:true,max:120});await assertStoreInSessionScope(c.session,storeId);
  const identity=await dispatchIdentity(r,org,c.session.membershipId!,storeId,["internal_technician"]);
  const uploaded=[...form.values()].filter((value):value is File=>typeof value!=="string"&&value.size>0);
  if(uploaded.length>5||uploaded.reduce((total,file)=>total+file.size,0)>8*1024*1024)throw new OpsDomainError("VALIDATION","Attach up to five files, 8 MB total for this save.");
  const intent=await Promise.all([...form.entries()].filter(([name])=>name!=="submissionKey").map(async([name,value])=>[name,typeof value==="string"?value:{name:value.name,type:value.type,sha256:Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",await value.arrayBuffer())),b=>b.toString(16).padStart(2,"0")).join("")} ]));
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(intent))),hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
  const idempotency={key:`internal-visit:${identity.membershipId}:${key}`,command:`internal_visit.${action}`,requestHash:hash,expiresAt:"9999-12-31T23:59:59.999Z"};
  const receipt=await r.getIdempotencyKey(org,idempotency.key);if(receipt){if(receipt.requestHash!==hash)throw new OpsDomainError("CONFLICT","Submission details changed.");return relativeRedirect303(action==="check_out"?"/app/my-work/next?saved=1":`/app/my-work/visits/${encodeURIComponent(receipt.resultId)}`);}
  if(action==="check_in"){
    const workId=formText(form,"workOrderId",{max:120});
    if(workId){const work=await r.getWorkOrder(org,workId),a=await r.getActiveAssignment(org,workId);if(!work||persistedWorkOrderVersion(work)!==Number(form.get("expectedVersion"))||a?.id!==form.get("expectedAssignmentId")||a.internalMembershipId!==identity.membershipId)throw new OpsDomainError("CONFLICT","This job changed. Refresh before checking in.");}
    const hold=workId?await r.getWorkOrderVisitHold(org,workId):undefined;
    const ownHeld=hold?.status==="active";
    const started=await checkInVisit({repository:r},{organizationId:org,storeId,internalMembershipId:identity.membershipId,technicianName:identity.name,workOrderIds:workId&&!ownHeld?[workId]:[],heldWorkOrderIds:[...(ownHeld?[workId]:[]),...form.getAll("heldWorkOrderId").map(String)],unmatchedReason:formText(form,"unmatchedReason",{max:1000})||undefined,purpose:workId?"Internal maintenance":"Unmatched internal maintenance",channel:"internal_web",location:{result:"not_requested",capturedAt:new Date().toISOString()},actor:{...c.actor,actorName:identity.name},idempotency});
    return relativeRedirect303(`/app/my-work/visits/${encodeURIComponent(started.id)}`);
  }
  if(!visit)throw new OpsDomainError("NOT_FOUND","Visit not found.");
  if(action==="add_work")await addHeldWorkToActiveVisit({repository:r},{organizationId:org,visitId,heldWorkOrderIds:form.getAll("heldWorkOrderId").map(String),actor:c.actor,idempotency});
  else {
    const links=await r.listSiteVisitWorkOrders(org,visitId), files:Record<string,Awaited<ReturnType<typeof storeCompletionFiles>>>={};
    const outcomes=await Promise.all(links.map(async link=>{const prefix=`${link.workOrderId}:`,filesForm=new FormData();form.getAll(`${prefix}attachments`).forEach(file=>filesForm.append("attachments",file));files[link.workOrderId]=await storeCompletionFiles(filesForm,org,link.workOrderId,c.session.accessMode==="preview",key);return {expectedVersion:Number(formText(form,`${prefix}expectedVersion`,{required:true,max:16})),expectedAssignmentId:formText(form,`${prefix}expectedAssignmentId`,{required:true,max:120}),blocker:formText(form,`${prefix}blocker`,{max:30}) as import("@/lib/ops/types").WorkResult["blocker"]||undefined,workOrderId:link.workOrderId,outcome:formText(form,`${prefix}outcome`,{required:true,max:40}) as SiteVisitWorkOrderOutcome,outcomeNotes:internalCheckoutNotes(form,prefix)};}));
    await checkOutVisit({repository:r},{organizationId:org,visitId,channel:"internal_web",perWorkOrderOutcomes:outcomes.length?outcomes:undefined,outcome:outcomes.length?undefined:"other",outcomeNotes:outcomes.length?undefined:formText(form,"notes",{required:true,max:3000}),resultFiles:files,location:{result:"not_requested",capturedAt:new Date().toISOString()},actor:{...c.actor,actorName:identity.name},idempotency});
  }
  return relativeRedirect303(action==="check_out"?"/app/my-work/next?saved=1":`/app/my-work/visits/${encodeURIComponent(visitId)}`);
}catch(error){return opsApiError(error);}}
