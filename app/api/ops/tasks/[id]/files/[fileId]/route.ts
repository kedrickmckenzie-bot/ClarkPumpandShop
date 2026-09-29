import {getOpsRequestContext,assertStoreInSessionScope,opsApiError} from "@/lib/server/ops-request-context";
import {accessTask} from "@/lib/ops/store-tasks";
import {taskRoles} from "@/lib/ops/store-task-types";
import {quoteFileResponse} from "@/lib/server/quote-file-response";
export async function GET(request:Request,{params}:{params:Promise<{id:string;fileId:string}>}) {
 try{const {session,repository,actor}=await getOpsRequestContext(taskRoles,undefined,request);const {id,fileId}=await params;const {task}=await accessTask(repository,session.organizationId,id,actor.actorId!);await assertStoreInSessionScope(session,task.storeId);const files=await repository.listFilesForEntity(session.organizationId,'store_task',id);return quoteFileResponse(files.find(f=>f.id===fileId)??null,request);}catch(e){return opsApiError(e);}
}
