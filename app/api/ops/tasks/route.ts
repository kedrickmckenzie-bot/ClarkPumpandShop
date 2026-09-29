import {localDateTimeToIso} from "@/lib/ops/local-date-time";
import {operationsTimeZone} from "@/lib/ops/local-time";
import {getOpsRequestContext,assertStoreInSessionScope,opsApiError,formText} from "@/lib/server/ops-request-context";
import {createStoreTask,updateStoreTask,accessTask,markTaskSeen,taskIdentity} from "@/lib/ops/store-tasks";
import {taskRoles} from "@/lib/ops/store-task-types";
import type {NewStoreTask,TaskAction} from "@/lib/ops/store-tasks";
import {uploadInspectionFiles} from "@/lib/server/inspection-uploads";
export async function GET(request:Request) {
 try{const {session,repository,actor}=await getOpsRequestContext(taskRoles,undefined,request);const q=new URL(request.url).searchParams,store=q.get('store')??'';const location=await assertStoreInSessionScope(session,store);await taskIdentity(repository,session.organizationId,actor.actorId!,store);return Response.json({timeZone:operationsTimeZone(location.timeZone),people:await repository.listTaskPeople(session.organizationId,store,(q.get('q')??'').slice(0,120))});}catch(e){return opsApiError(e);}
}
export async function POST(request:Request) {
 try{
 const {session,repository,actor}=await getOpsRequestContext(taskRoles,undefined,request),form=await request.formData();
 const action=formText(form,'action'),id=formText(form,'id');
 const existing=id?await accessTask(repository,session.organizationId,id,actor.actorId!):null;
 const store=existing?.task.storeId??formText(form,'storeId',{required:true});const location=await assertStoreInSessionScope(session,store);
 const dueAt=["create","send_back"].includes(action)?localDateTimeToIso(formText(form,"dueAt"),operationsTimeZone(location.timeZone)):undefined;
 if(action==='seen'){await markTaskSeen(repository,actor,id,formText(form,'seenAt'));return Response.json({id});}
 const files=await uploadInspectionFiles(form,'files',session.organizationId,id||crypto.randomUUID(),session.accessMode==='preview','store_task');
 const body=formText(form,'body',{max:6000});
 if(action==='create') {
 const input:NewStoreTask={storeId:store,title:formText(form,'title'),instructions:formText(form,'instructions'),kind:formText(form,'kind') as NewStoreTask['kind'],assignment:formText(form,'assignment') as NewStoreTask['assignment'],assigneeId:formText(form,'assigneeId'),fallbackId:formText(form,'fallbackId'),priority:formText(form,'priority') as NewStoreTask['priority'],dueAt:dueAt!,notifyRequester:form.get('notifyRequester')==='on',windows:JSON.parse(formText(form,'windows',{max:16000})||'[]'),workOrderId:formText(form,'workOrderId'),invoiceId:formText(form,'invoiceId'),visitId:formText(form,'visitId'),assetId:formText(form,'assetId')};
 return Response.json({id:(await createStoreTask(repository,actor,input,files)).id});
 }
 const input:TaskAction={action:action as TaskAction['action'],expectedVersion:Number(form.get('version')),body,result:formText(form,'result') as TaskAction['result'],findings:JSON.parse(formText(form,'findings',{max:40000})||'[]'),assignment:formText(form,'assignment') as TaskAction['assignment'],assigneeId:formText(form,'assigneeId'),fallbackId:formText(form,'fallbackId')||undefined,dueAt:dueAt!};
 return Response.json({id:(await updateStoreTask(repository,actor,id,input,files)).id});
 }catch(e){return opsApiError(e);}
}
