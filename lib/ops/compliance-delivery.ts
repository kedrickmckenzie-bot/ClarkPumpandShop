import { masterDocuments } from "./compliance-documents";
import type { OpsRepository } from "./repository";
import type { TransactionalEmailProvider } from "./email-delivery";
import type { OutboxDeliveryMessage } from "./outbox-delivery";
export async function deliverInspectionEmail(input:{repository:OpsRepository;provider:TransactionalEmailProvider|null;baseUrl:string;readAttachment?:(key:string)=>Promise<ArrayBuffer|null>},message:OutboxDeliveryMessage,now=new Date().toISOString()) {
 const r=input.repository,i=await r.getInspection(message.organizationId,message.aggregateId);if(!i||i.status==="passed")return;
 const s=await r.getComplianceSchedule(message.organizationId,i.scheduleId);if(!s||s.status!=="active")return;
 const store=await r.getStore(message.organizationId,i.storeId);if(!store)return;
 const recipients=new Set<string>();let body="",subject="";
 if(message.topic==="ops.compliance.authorization") {
  const work=i.workOrderId?await r.getWorkOrder(message.organizationId,i.workOrderId):null;
  const issuance=work?await r.getLatestIssuanceForWorkOrder(message.organizationId,work.id):null;
  const assignment=work?await r.getActiveAssignment(message.organizationId,work.id):null;
  const vendor=s.vendorId?await r.getVendor(message.organizationId,s.vendorId):null;
  if(!work||!issuance||!vendor||assignment?.vendorId!==vendor.id||["closed","cancelled","resolved"].includes(work.status))return;
  const snapshot=JSON.parse(issuance.immutablePayloadJson);
  recipients.add(vendor.dispatchEmail);subject=`${work.number} — ${s.name}`;
  body=`Work Order / Service Authorization\n${work.number}\nStore ${store.storeNumber} · ${store.name}\n${snapshot.store.formattedAddress}\n\n${snapshot.authorizedScope}\n\n${snapshot.billingInstruction}\nReply with your service date and inspection report, keeping the work order number in the subject. Store QR check-in is available on arrival.`;
 } else {
  const escalate=Date.parse(now.slice(0,10))>=Date.parse(i.dueDate)-s.escalationDays*86400000;
  subject=`${s.name} — Store ${store.storeNumber} — due ${i.dueDate}`;
  const href=new URL(`/app/compliance/${i.id}`,input.baseUrl).toString();
  body=`${s.name}\nStore ${store.storeNumber} · ${store.name}\nDue ${i.dueDate}\n${i.status==="performed"?"Inspection performed; paperwork or review is still pending.":i.status==="action_needed"?"Inspection finding requires corrective action.":"Complete the inspection and record the result."}\nEvidence: ${s.evidenceLabel}\n${escalate?`Escalation: ${s.escalationTo}\n`:""}`;
  if(s.handler==="vendor"&&!escalate){const vendor=await r.getVendor(message.organizationId,s.vendorId!);if(vendor?.status==="approved")recipients.add(vendor.dispatchEmail);const work=i.workOrderId?await r.getWorkOrder(message.organizationId,i.workOrderId):null;body+=`Reply with an update${work?` for ${work.number}`:""}.`;}
  else {if(s.membershipId&&!escalate){const m=await r.getMembership(message.organizationId,s.membershipId);const user=m?.status==="active"?await r.getUserInOrganization(message.organizationId,m.userId):null;const allowed=m?await r.listStoreIdsForMembership(message.organizationId,m.id):[];if(user?.status==="active"&&allowed.includes(i.storeId))recipients.add(user.email);}else for(const person of await r.listNotificationRecipients(message.organizationId,"facilities_admin",{storeId:i.storeId,regionId:store.regionId}))recipients.add(person.email);body+=`Open inspection: ${href}`;}
 }
 if(!recipients.size)throw new Error("No inspection recipient is configured");if(!input.provider)throw new Error("Inspection email delivery is not configured");
 const escape=(value:string)=>value.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
 const attachments=[];
 if(message.topic==="ops.compliance.authorization")for(const f of masterDocuments(i)) {
  const bytes=await input.readAttachment?.(f.storageKey);if(!bytes)throw new Error("Inspection instruction file is unavailable");
  attachments.push({filename:f.originalName,content:Buffer.from(bytes).toString("base64"),contentType:f.contentType});
 }
 if(attachments.length)body+="\n\nBlank forms and instructions are attached. Download or print them, then return the completed paperwork and photos.";
 for(const to of recipients)await input.provider.send({to,subject,attachments,text:body,html:`<div style="white-space:pre-line">${escape(body)}</div>`,idempotencyKey:`${message.id}/${to}`});
}
