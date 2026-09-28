import type { OpsRepository, OpsStatement } from "./repository";
import type { ActorContext, StoredFile } from "./types";
import type { InvoiceUpload } from "./invoice-upload-types";
import { invoiceExtractionSchema, invoiceReadingIssues, type InvoiceExtraction } from "./invoice-extraction";
import { OpsDomainError } from "./errors";
import { receiveInvoice } from "./financial-control-commands";
const insert=(table:string,values:Record<string,unknown>):OpsStatement=>{const entries=Object.entries(values).filter(([,v])=>v!==undefined);return{sql:`INSERT INTO ${table} (${entries.map(([k])=>k).join(", ")}) VALUES (${entries.map(()=>"?").join(", ")})`,params:entries.map(([,v])=>v)}};
const normalized=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,"");
export async function assertInvoiceReceiver(repository:OpsRepository,actor:ActorContext) {
  const member=actor.actorType==="user"&&actor.actorId?await repository.getMembership(actor.organizationId,actor.actorId):null;
  if(!member||member.status!=="active"||!["facilities_admin","executive","finance_reviewer"].includes(member.role))throw new OpsDomainError("FORBIDDEN","Company invoice access is required.");
  const grants=await repository.listScopeGrantsForMembership(actor.organizationId,member.id);
  if(!grants.some(g=>g.scopeKind==="organization"&&g.scopeId===actor.organizationId&&["ops:*","ops:write","ops:read_write"].includes(g.permission)))throw new OpsDomainError("FORBIDDEN","Company invoice write access is required.");
}
function audit(row:InvoiceUpload,actor:ActorContext,event:string,payload:unknown):OpsStatement {return insert("ops_audit_events",{id:`audit-${crypto.randomUUID()}`,organization_id:row.organizationId,aggregate_type:"invoice_upload",aggregate_id:row.id,event_type:event,actor_type:actor.actorType,actor_id:actor.actorId,actor_name:actor.actorName,occurred_at:new Date().toISOString(),payload_json:JSON.stringify(payload)});}
function fence(row:InvoiceUpload):OpsStatement {return insert("ops_idempotency_keys",{organization_id:row.organizationId,key:`__ops_internal__/invoice-upload:${row.id}:${row.version}`,command:"invoice_upload.transition",result_id:row.id,request_hash:row.sha256,created_at:new Date().toISOString(),expires_at:"9999-12-31T23:59:59.999Z"});}
export async function saveInvoiceUpload(repository:OpsRepository,actor:ActorContext,file:StoredFile) {
  await assertInvoiceReceiver(repository,actor);
  if(file.organizationId!==actor.organizationId||file.status!=="available"||!file.sha256.match(/^[a-f0-9]{64}$/))throw new OpsDomainError("VALIDATION","Invoice file is invalid.");
  const existing=await repository.findInvoiceUpload(actor.organizationId,file.sha256);if(existing)return existing;
  const now=new Date().toISOString();const row:InvoiceUpload={id:`invoice-upload-${crypto.randomUUID()}`,organizationId:actor.organizationId,fileId:file.id,sha256:file.sha256,filename:file.originalName,status:"queued",version:0,issuesJson:"[]",uploadedByMembershipId:actor.actorId!,createdAt:now,updatedAt:now};
  try {await repository.atomicWrite([insert("ops_idempotency_keys",{organization_id:row.organizationId,key:`__ops_internal__/invoice-upload-file:${file.sha256}`,command:"invoice_upload.received",result_id:row.id,request_hash:file.sha256,created_at:now,expires_at:"9999-12-31T23:59:59.999Z"}),insert("ops_files",{id:file.id,organization_id:file.organizationId,storage_key:file.storageKey,sha256:file.sha256,original_name:file.originalName,content_type:file.contentType,byte_length:file.byteLength,status:file.status,created_at:now}),insert("ops_invoice_uploads",{id:row.id,organization_id:row.organizationId,file_id:row.fileId,sha256:row.sha256,filename:row.filename,status:row.status,version:0,issues_json:"[]",uploaded_by_membership_id:row.uploadedByMembershipId,created_at:now,updated_at:now}),audit(row,actor,"invoice_upload.received",{fileId:file.id,sha256:file.sha256})]);}catch(error){const duplicate=await repository.findInvoiceUpload(actor.organizationId,file.sha256);if(duplicate)return duplicate;throw error;}return row;
}
export async function reviewInvoiceUpload(repository:OpsRepository,actor:ActorContext,row:InvoiceUpload,issues:string[],data?:InvoiceExtraction) {
  await assertInvoiceReceiver(repository,actor);if(row.organizationId!==actor.organizationId)throw new OpsDomainError("FORBIDDEN","Invoice is outside your company.");
  if(row.status==="recorded"||row.status==="dismissed")throw new OpsDomainError("CONFLICT","This upload is already closed.");
  await repository.atomicWrite([fence(row),{sql:"UPDATE ops_invoice_uploads SET status = ?, issues_json = ?, extracted_json = ?, version = ?, updated_at = ? WHERE organization_id = ? AND id = ? AND version = ?",params:["review",JSON.stringify(issues),data?JSON.stringify(data):row.extractedJson??null,row.version+1,new Date().toISOString(),row.organizationId,row.id,row.version]},audit(row,actor,"invoice_upload.needs_review",{issues,extraction:data??null})]);
  return (await repository.getInvoiceUpload(row.organizationId,row.id))!;
}
export async function matchInvoiceExtraction(repository:OpsRepository,org:string,data:InvoiceExtraction) {
  const issues=invoiceReadingIssues(data);
  const work=data.workOrderNumber?await repository.findWorkOrderByNumber(org,data.workOrderNumber):null;
  if(!work||work.status==="cancelled")issues.push("No exact work-order match. Choose the work order.");
  const vendorId=work?await repository.getInvoiceVendorId(org,work.id):null;
  const vendor=vendorId?await repository.getVendor(org,vendorId):null;
  if(!vendor||vendor.status==="inactive"||!data.vendorName||![vendor.name,vendor.code].some(name=>normalized(name)===normalized(data.vendorName!)))issues.push("Confirm the invoice vendor.");
  const store=work?await repository.getStore(org,work.storeId):null;
  if(store){
    const refs=[data.storeNumber,data.storeName,data.serviceAddress];
    if(!refs.some(Boolean))issues.push("The service location could not be read.");
    if(data.storeNumber&&normalized(data.storeNumber)!==normalized(store.storeNumber))issues.push("Store number does not match the work order.");
    if(data.storeName&&![store.name,...store.aliases].some(n=>normalized(n)===normalized(data.storeName!)))issues.push("Store name needs confirmation.");
    if(data.serviceAddress&&![store.address1,[store.address1,store.city,store.state,store.postalCode].join(" "),[store.address1,store.address2,store.city,store.state,store.postalCode].filter(Boolean).join(" ")].some(a=>normalized(a)===normalized(data.serviceAddress!)))issues.push("Service address needs confirmation.");
  }
  return {issues,work,vendor};
}
export async function recordInvoiceUpload(repository:OpsRepository,actor:ActorContext,row:InvoiceUpload,dataInput:InvoiceExtraction,manual?:{workOrderId:string;vendorId:string;reason:string;contractVersionId?:string}) {
  await assertInvoiceReceiver(repository,actor);if(row.organizationId!==actor.organizationId)throw new OpsDomainError("FORBIDDEN","Invoice is outside your company.");
  if(row.status==="recorded")return row;
  if(row.status==="dismissed")throw new OpsDomainError("CONFLICT","This upload was dismissed.");
  const data=invoiceExtractionSchema.parse(dataInput);
  if(manual){if(!manual.reason.trim())throw new OpsDomainError("VALIDATION","Add a review note.");const issues=invoiceReadingIssues({...data,uncertainFields:[]});if(issues.length)throw new OpsDomainError("VALIDATION",issues.join(" "));}
  const match=manual?null:await matchInvoiceExtraction(repository,row.organizationId,data);
  if(match?.issues.length)return reviewInvoiceUpload(repository,actor,row,match.issues,data);
  const workOrderId=manual?.workOrderId??match!.work!.id,vendorId=manual?.vendorId??match!.vendor!.id;
  const invoiceId=`invoice-from-${row.id}`;
  const extra:OpsStatement[]=[fence(row),{sql:"UPDATE ops_invoices SET supporting_file_id = ? WHERE organization_id = ? AND id = ?",params:[row.fileId,row.organizationId,invoiceId]},insert("ops_entity_files",{id:`link-${crypto.randomUUID()}`,organization_id:row.organizationId,file_id:row.fileId,entity_type:"invoice",entity_id:invoiceId,purpose:"invoice",visibility:"internal",created_at:new Date().toISOString()}),{sql:"UPDATE ops_invoice_uploads SET status = ?, invoice_id = ?, extracted_json = ?, issues_json = ?, version = ?, updated_at = ? WHERE organization_id = ? AND id = ? AND version = ?",params:["recorded",invoiceId,row.extractedJson??JSON.stringify(data),"[]",row.version+1,new Date().toISOString(),row.organizationId,row.id,row.version]},audit(row,actor,"invoice_upload.recorded",{invoiceId,automatic:!manual,extraction:data,reviewNote:manual?.reason,paymentApproved:false})];
  const transaction=new Proxy(repository,{get(target,key){if(key==="atomicWrite")return(statements:readonly OpsStatement[])=>target.atomicWrite([...statements,...extra]);const value=Reflect.get(target,key);return typeof value==="function"?value.bind(target):value;}});
  try {await receiveInvoice({organizationId:row.organizationId,invoiceId,workOrderId,vendorId,contractVersionId:manual?.contractVersionId,vendorInvoiceNumber:data.invoiceNumber!,invoiceDate:data.invoiceDate!,currency:data.currency!,lines:data.lines.map(l=>({category:l.category,description:l.description,amount:{amountMinor:l.amountMinor,currency:data.currency!}})),automatic:!manual,optionalControls:true,actor},{repository:transaction});}
  catch(error){const current=await repository.getInvoiceUpload(row.organizationId,row.id);if(current?.status==="recorded")return current;if(current?.version!==row.version)throw new OpsDomainError("CONFLICT","This upload changed. Refresh before reviewing.");if((await repository.readInvoiceIntakeChecks(row.organizationId,workOrderId,vendorId,data.invoiceNumber!)).duplicateNumber)return reviewInvoiceUpload(repository,actor,row,["This vendor invoice number has already been received."],data);if(error instanceof OpsDomainError&&error.code==="CONFLICT")return reviewInvoiceUpload(repository,actor,row,[error.message],data);throw error;}
  return (await repository.getInvoiceUpload(row.organizationId,row.id))!;
}
export async function dismissInvoiceUpload(repository:OpsRepository,actor:ActorContext,row:InvoiceUpload,reason:string) {
  await assertInvoiceReceiver(repository,actor);if(row.organizationId!==actor.organizationId||row.status==="recorded")throw new OpsDomainError("CONFLICT","This upload cannot be dismissed.");if(!reason.trim())throw new OpsDomainError("VALIDATION","Add a reason.");
  await repository.atomicWrite([fence(row),{sql:"UPDATE ops_invoice_uploads SET status = ?, version = ?, updated_at = ? WHERE organization_id = ? AND id = ? AND version = ?",params:["dismissed",row.version+1,new Date().toISOString(),row.organizationId,row.id,row.version]},audit(row,actor,"invoice_upload.dismissed",{reason})]);
}
