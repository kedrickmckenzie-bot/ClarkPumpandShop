import { createInspectionLink,inspectionAssignee } from "./inspection-access";
import { masterDocuments } from "./compliance-documents";
import type { OpsRepository } from "./repository";
import type { TransactionalEmailProvider } from "./email-delivery";
import type { OutboxDeliveryMessage } from "./outbox-delivery";
export async function deliverInspectionEmail(input:{repository:OpsRepository;provider:TransactionalEmailProvider|null;baseUrl:string;readAttachment?:(key:string)=>Promise<ArrayBuffer|null>},message:OutboxDeliveryMessage,now=new Date().toISOString()) {
 const r=input.repository,i=await r.getInspection(message.organizationId,message.aggregateId);if(!i||i.status==="passed")return;
 const s=await r.getComplianceSchedule(message.organizationId,i.scheduleId);if(!s||s.status!=="active")return;
 const store=await r.getStore(message.organizationId,i.storeId);if(!store)return;
 const recipients=new Set<string>();let body="",subject="";
 const assignee=await inspectionAssignee(r,s);
 if(!assignee)throw new Error("No inspection recipient is configured");
 recipients.add(assignee.email);
 if(message.topic==="ops.compliance.authorization") {
  const work=i.workOrderId?await r.getWorkOrder(message.organizationId,i.workOrderId):null;
  const issuance=work?await r.getLatestIssuanceForWorkOrder(message.organizationId,work.id):null;
  const assignment=work?await r.getActiveAssignment(message.organizationId,work.id):null;
  const vendor=s.vendorId?await r.getVendor(message.organizationId,s.vendorId):null;
  if(!work||!issuance||!vendor||assignment?.vendorId!==vendor.id||["closed","cancelled","resolved"].includes(work.status))return;
  const snapshot=JSON.parse(issuance.immutablePayloadJson);
  recipients.add(vendor.dispatchEmail);subject=`${work.number} — ${s.name}`;
  body=`Work Order / Service Authorization\n${work.number}\nStore ${store.storeNumber} · ${store.name}\n${snapshot.store.formattedAddress}\n\n${snapshot.authorizedScope}\n\n${snapshot.billingInstruction}\nUse the inspection link below to record the result and upload paperwork or photos.`;
 } else {
  const escalate=Date.parse(now.slice(0,10))>=Date.parse(i.dueDate)-s.escalationDays*86400000;
  subject=`${s.name} — Store ${store.storeNumber} — due ${i.dueDate}`;
  body=`${s.name}\nStore ${store.storeNumber} · ${store.name}\nDue ${i.dueDate}\n${i.status==="performed"?"Inspection performed; paperwork or review is still pending.":i.status==="action_needed"?"Inspection finding requires corrective action.":"Complete the inspection and record the result."}\nEvidence: ${s.evidenceLabel}\n${escalate?`Escalation: ${s.escalationTo}\n`:""}`;
  if(escalate)for(const person of await r.listNotificationRecipients(message.organizationId,"facilities_admin",{storeId:i.storeId,regionId:store.regionId}))recipients.add(person.email);
 }
 if(!recipients.size)throw new Error("No inspection recipient is configured");if(!input.provider)throw new Error("Inspection email delivery is not configured");
 const work=i.workOrderId?await r.getWorkOrder(message.organizationId,i.workOrderId):null;
 if(!work||work.status==="cancelled")return;
 const path=await createInspectionLink(r,i.organizationId,i.id,{organizationId:i.organizationId,actorType:"system",actorName:"Inspection delivery"},now);
 const actionUrl=new URL(path,input.baseUrl).toString();
 subject=`${work.number} — ${s.name} — due ${i.dueDate}`;
 const escape=(value:string)=>value.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
 const attachments=[];
 if(message.topic==="ops.compliance.authorization"||s.handler==="internal")for(const f of masterDocuments(i)) {
  const bytes=await input.readAttachment?.(f.storageKey);if(!bytes)throw new Error("Inspection instruction file is unavailable");
  attachments.push({filename:f.originalName,content:Buffer.from(bytes).toString("base64"),contentType:f.contentType});
 }
 if(attachments.length)body+="\n\nBlank forms and instructions are attached. Download or print them, then return the completed paperwork and photos.";
 for(const to of recipients){const text=`${body}\n\n${to===assignee.email?`Complete inspection and upload paperwork/photos: ${actionUrl}`:`Review inspection: ${new URL(`/app/compliance/${i.id}`,input.baseUrl)}`}`;await input.provider.send({to,subject,attachments,text,html:`<div style="white-space:pre-line">${escape(text)}</div>`,idempotencyKey:`${message.id}/${to}`});}
}
