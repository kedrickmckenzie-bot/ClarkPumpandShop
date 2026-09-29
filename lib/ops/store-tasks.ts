import { OpsDomainError } from "./errors";
import type { OpsRepository,OpsStatement,OrganizationScope } from "./repository";
import type { ActorContext,StoredFile } from "./types";
import type { StoreTask,TaskAccess,TaskAssignment,TaskKind,TaskResult,CameraWindow,CameraFinding } from "./store-task-types";
import { communicationAudit,evidenceFence,insertRecord } from "./email-intake";
const supervisors=['executive','facilities_admin','regional_manager'];
const writers=['ops:*','ops:write','ops:read_write','ops:store_manage'];
function fail(message:string):never {throw new OpsDomainError('VALIDATION',message);}
function forbidden():never {throw new OpsDomainError('FORBIDDEN','This task is not available to your account.');}
function text(value:string,max:number,label:string) {if(!value?.trim()||value.trim().length>max)fail(`${label} is required (up to ${max} characters).`);return value.trim();}
function date(value:string) {if(!value||!Number.isFinite(Date.parse(value)))fail('Choose a valid date and time.');return new Date(value).toISOString();}
export async function taskIdentity(r:OpsRepository,org:string,id:string,storeId?:string):Promise<TaskAccess> {
 const m=await r.getMembership(org,id);if(!m||m.status!=='active'||!['executive','facilities_admin','regional_manager','store_manager','finance_reviewer'].includes(m.role))forbidden();
 const u=await r.getUserInOrganization(org,m.userId);if(!u||u.status!=='active')forbidden();
 const grants=await r.listScopeGrantsForMembership(org,id);
 const store=storeId?await r.getStore(org,storeId):null;
 const covers=(g:typeof grants[number])=>!storeId||store&&(g.scopeKind==='organization'&&g.scopeId===org||g.scopeKind==='division'&&g.scopeId===store.divisionId||g.scopeKind==='region'&&g.scopeId===store.regionId||g.scopeKind==='store'&&g.scopeId===store.id);
 if(!grants.some(g=>writers.includes(g.permission)&&covers(g)))forbidden();
 return {membershipId:id,supervisor:supervisors.includes(m.role),local:!!storeId&&grants.some(g=>g.scopeKind==='store'&&g.scopeId===storeId&&writers.includes(g.permission))};
}
export async function taskScope(r:OpsRepository,scope:OrganizationScope,id:string) {
 await taskIdentity(r,scope.organizationId,id);
 const ids=await r.listStoreIdsForMembership(scope.organizationId,id);
 return {...scope,storeIds:scope.storeIds?ids.filter(i=>scope.storeIds!.includes(i)):ids};
}
export async function accessTask(r:OpsRepository,org:string,id:string,actorId:string) {
 const t=await r.getStoreTask(org,id);if(!t)throw new OpsDomainError('NOT_FOUND','Task not found.');
 const access=await taskIdentity(r,org,actorId,t.storeId);
 const participants=await r.listTaskParticipants(org,id);
 const eligible=t.assignment==='responsible'||t.assignment==='local'&&access.local;
 if(!access.supervisor&&!participants.some(p=>p.membershipId===actorId)&&!(t.status==='open'&&!t.claimantId&&eligible))forbidden();
 return {task:t,access,participants,eligible};
}
function fileStatements(t:StoreTask,files:StoredFile[],messageId:string,now:string) {
 if(files.length>5)fail('Attach up to five files.');
 return files.flatMap(f=>{
 if(f.organizationId!==t.organizationId||f.status!=='available')forbidden();
 return [insertRecord('ops_files',{id:f.id,organization_id:f.organizationId,storage_key:f.storageKey,sha256:f.sha256,original_name:f.originalName,content_type:f.contentType,byte_length:f.byteLength,status:f.status,created_at:now}),insertRecord('ops_entity_files',{id:`link-${crypto.randomUUID()}`,organization_id:t.organizationId,file_id:f.id,entity_type:'store_task',entity_id:t.id,purpose:messageId,visibility:'internal',created_at:now})];
 });
}
function participant(t:StoreTask,id:string,now:string) {return insertRecord('ops_store_task_people',{id:`task-person-${crypto.randomUUID()}`,organization_id:t.organizationId,task_id:t.id,membership_id:id,seen_at:now});}
function record(t:StoreTask,actor:ActorContext,kind:string,body:string,findings:CameraFinding[],now:string,files:StoredFile[]=[]) {
 const id=`task-message-${crypto.randomUUID()}`;
 return [insertRecord('ops_store_task_messages',{id,organization_id:t.organizationId,task_id:t.id,actor_id:actor.actorId!,actor_name:actor.actorName,kind,body,findings_json:JSON.stringify(findings),created_at:now}),communicationAudit(t.organizationId,t.id,`store_task.${kind}`,actor,now,{body,findings,messageId:id,version:t.version,status:t.status,result:t.result,assigneeId:t.assigneeId,claimantId:t.claimantId,fallbackId:t.fallbackId,files:files.map(f=>f.id)},'store_task'),...fileStatements(t,files,id,now)];
}
export interface NewStoreTask {storeId:string;title:string;instructions:string;kind:TaskKind;assignment:TaskAssignment;assigneeId?:string;fallbackId:string;priority:'routine'|'urgent';dueAt:string;notifyRequester:boolean;windows:CameraWindow[];workOrderId?:string;invoiceId?:string;visitId?:string;assetId?:string;}
export async function validateTaskAssignment(r:OpsRepository,org:string,store:string,assignment:TaskAssignment,assignee:string|undefined,fallback:string) {
 if(!['person','responsible','local'].includes(assignment))fail('Choose who should handle this task.');
 await taskIdentity(r,org,fallback,store);
 if(assignment==='person'){if(!assignee)fail('Choose a person.');await taskIdentity(r,org,assignee,store);}
 if(assignment==='local'&&!(await r.listTaskPeople(org,store,'',true)).some(p=>p.local))fail('No store team is assigned here. Choose a person instead.');
}
export async function createStoreTask(r:OpsRepository,actor:ActorContext,input:NewStoreTask,files:StoredFile[]=[],now=new Date().toISOString()) {
 const org=actor.organizationId;if(actor.actorType!=='user')forbidden();
 await taskIdentity(r,org,actor.actorId!,input.storeId);
 await validateTaskAssignment(r,org,input.storeId,input.assignment,input.assigneeId,input.fallbackId);
 if(!['general','camera','equipment'].includes(input.kind)||!['routine','urgent'].includes(input.priority))fail('Choose a task type and priority.');
 if(input.workOrderId){const w=await r.getWorkOrder(org,input.workOrderId);if(!w||w.storeId!==input.storeId)fail('The work order must belong to this store.');}
 if(input.visitId){const v=await r.getVisit(org,input.visitId);if(!v||v.storeId!==input.storeId)fail('The visit must belong to this store.');}
 if(input.assetId){const a=await r.getAsset(org,input.assetId);if(!a||a.storeId!==input.storeId)fail('The equipment must belong to this store.');}
 if(input.invoiceId){const invoice=await r.getInvoice(org,input.invoiceId);if(!invoice)fail('Invoice not found.');
   const lines=await r.listInvoiceLines(org,input.invoiceId);
   const allocations=(await Promise.all(lines.map(l=>r.listInvoiceLineAllocations(org,l.id)))).flat();
   if(allocations.some(a=>a.storeId!==input.storeId))fail('Choose an invoice for this store.');
   if(!allocations.length){const grants=await r.listScopeGrantsForMembership(org,actor.actorId!);if(!grants.some(g=>g.scopeKind==='organization'&&g.scopeId===org&&writers.includes(g.permission)))forbidden();}
 }
 if(!Array.isArray(input.windows)||input.windows.length>12||input.windows.some(w=>!w||typeof w.start!=='string'||typeof w.end!=='string'||typeof w.area!=='string'))fail('Add up to 12 camera windows.');
 const windows=input.kind==='camera'?input.windows.map(w=>({start:date(w.start),end:date(w.end),area:w.area.trim().slice(0,160)})):[];
 if(input.kind==='camera'&&(!windows.length||windows.length>12||windows.some(w=>w.end<=w.start)))fail('Add 1–12 time windows, with the end after the start.');
 const task:StoreTask={id:`task-${crypto.randomUUID()}`,organizationId:org,storeId:input.storeId,title:text(input.title,160,'Title'),instructions:text(input.instructions,4000,'Instructions'),kind:input.kind,assignment:input.assignment,assigneeId:input.assignment==='person'?input.assigneeId!:null,claimantId:null,requesterId:actor.actorId!,fallbackId:input.fallbackId,status:'open',priority:input.priority,dueAt:date(input.dueAt),notifyRequester:input.notifyRequester?1:0,workOrderId:input.workOrderId||null,invoiceId:input.invoiceId||null,visitId:input.visitId||null,assetId:input.assetId||null,windowsJson:JSON.stringify(windows),result:null,version:1,createdAt:now,updatedAt:now};
 const values=Object.fromEntries(Object.entries(task).map(([k,v])=>[k.replace(/[A-Z]/g,c=>'_'+c.toLowerCase()),v]));
 await r.atomicWrite([insertRecord('ops_store_tasks',values),...Array.from(new Set([task.requesterId,task.fallbackId,task.assigneeId].filter((v):v is string=>!!v))).map(id=>participant(task,id,id===actor.actorId!?now:'1970-01-01T00:00:00.000Z')),...record(task,actor,'created','Task created.',[],now,files)]);
 return task;
}
export type TaskAction={action:'claim'|'reply'|'complete'|'review'|'send_back'|'reassign';expectedVersion:number;body?:string;result?:TaskResult;findings?:CameraFinding[];assignment?:TaskAssignment;assigneeId?:string;fallbackId?:string;dueAt?:string;};
export async function updateStoreTask(r:OpsRepository,actor:ActorContext,id:string,input:TaskAction,files:StoredFile[]=[],now=new Date().toISOString()) {
 const {task:t,access,participants,eligible}=await accessTask(r,actor.organizationId,id,actor.actorId!);
 if(t.version!==input.expectedVersion)throw new OpsDomainError('CONFLICT','This task changed. Refresh to see the latest update.');
 const next={...t,version:t.version+1,updatedAt:now};let body=input.body?.trim()??'';const findings=input.findings??[];if(!Array.isArray(findings)||findings.length>12)fail('Add findings for each requested window.');
 if(body.length>6000)fail('Keep your notes under 6,000 characters.');
 const handler=t.claimantId??t.assigneeId;
 if(input.action==='claim'){
  if(t.status!=='open'||t.claimantId||t.assignment==='person'&&t.assigneeId!==actor.actorId!||t.assignment!=='person'&&!eligible)forbidden();
  next.claimantId=actor.actorId!;body="I'll take it.";
 }else if(input.action==='reply'){
  if(t.status==='closed')fail('This task is closed.');body=text(body,6000,'Reply');
 }else if(input.action==='complete'){
  if(t.status!=='open'||handler!==actor.actorId!)forbidden();
  if(!input.result||!['done','attention','unable'].includes(input.result))fail('Choose a result.');
  body=text(body,6000,'Findings');
  if(t.kind==='camera'){
   const windows=JSON.parse(t.windowsJson) as CameraWindow[];
   if(findings.length!==windows.length)fail('Record a finding for every camera window.');
   findings.forEach(f=>{if(!f||typeof f.notes!=='string'||!['matches','different','partial','unavailable'].includes(f.result)||!f.notes?.trim()||f.notes.length>2000)fail('Add a result and notes for every camera window.');if(f.start||f.end){f.start=date(f.start);f.end=date(f.end);if(f.end<f.start)fail('Observed end must follow observed start.');}});
   if(input.result==='done'&&findings.some(f=>f.result!=='matches'))fail('Choose Needs attention or Couldn’t complete when a camera window does not match.');
  }
  body=({done:'Done — no issues',attention:'Needs attention',unable:'Couldn’t complete'}[input.result])+': '+body;
  next.result=input.result;next.status=input.result!=='done'||t.notifyRequester?'review':'closed';
 }else if(input.action==='review'||input.action==='send_back'){
  if(t.status!=='review'||t.requesterId!==actor.actorId!)forbidden();
  next.status=input.action==='review'?'closed':'open';
  if(input.action==='send_back'){body=text(body,6000,'What else is needed');next.dueAt=date(input.dueAt??'');next.result=null;}
  else body=body||'Reviewed and closed.';
 }else if(input.action==='reassign'){
  if(t.status==='closed'||!access.supervisor&&t.requesterId!==actor.actorId!)forbidden();
  await validateTaskAssignment(r,t.organizationId,t.storeId,input.assignment!,input.assigneeId,input.fallbackId??t.fallbackId);
  next.assignment=input.assignment!;next.assigneeId=next.assignment==='person'?input.assigneeId!:null;next.fallbackId=input.fallbackId??t.fallbackId;next.claimantId=null;
  body=text(body,6000,'Reason for reassignment');
  const assigned=next.assigneeId?await r.getMembership(t.organizationId,next.assigneeId):null;
  const assignedName=assigned?(await r.getUserInOrganization(t.organizationId,assigned.userId))?.displayName:next.assignment==='local'?'Someone at the store':'Anyone responsible for this store';
  body=`Assigned to ${assignedName}. ${body}`;
 }else fail('Choose a valid action.');
 const added=Array.from(new Set([actor.actorId!,next.assigneeId,next.fallbackId].filter((x):x is string=>!!x))).filter(id=>!participants.some(p=>p.membershipId===id));
 const changes={status:next.status,claimant_id:next.claimantId,assignee_id:next.assigneeId,assignment:next.assignment,fallback_id:next.fallbackId,result:next.result,due_at:next.dueAt,version:next.version,updated_at:now};
 const statements:OpsStatement[]=[evidenceFence(t.organizationId,`store-task:${t.id}:v${t.version}`,t.id,now),{sql:`UPDATE ops_store_tasks SET ${Object.keys(changes).map(k=>k+' = ?').join(', ')} WHERE organization_id = ? AND id = ?`,params:[...Object.values(changes),t.organizationId,t.id]},...added.map(id=>participant(t,id,'1970-01-01T00:00:00.000Z')),...record(next,actor,input.action,body,findings,now,files)];
 try{await r.atomicWrite(statements);}catch(error){if((await r.getStoreTask(t.organizationId,t.id))?.version!==t.version)throw new OpsDomainError('CONFLICT','Someone already updated this task. Refresh to see their update.');throw error;}
 return next;
}
export async function markTaskSeen(r:OpsRepository,actor:ActorContext,id:string,now=new Date().toISOString()) {
 const {participants}=await accessTask(r,actor.organizationId,id,actor.actorId!);
 if(!Number.isFinite(Date.parse(now))||Date.parse(now)>Date.now())fail('Invalid read timestamp.');
 if((participants.find(p=>p.membershipId===actor.actorId)?.seenAt??'')>=now)return;
 await r.atomicWrite([{sql:'UPDATE ops_store_task_people SET seen_at = ? WHERE organization_id = ? AND task_id = ? AND membership_id = ?',params:[now,actor.organizationId,id,actor.actorId!]}]);
}
