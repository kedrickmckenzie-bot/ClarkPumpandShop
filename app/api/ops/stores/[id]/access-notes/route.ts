import { saveStoreAccessNotes } from "@/lib/ops/store-access-notes";
import { assertStoreInSessionScope, formText, getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
  try {
    const context=await getOpsRequestContext(["facilities","regional","store_manager"],undefined,request), {id}=await params;
    await assertStoreInSessionScope(context.session,id);
    const data=await request.formData();
    await saveStoreAccessNotes(context.repository,{organizationId:context.session.organizationId,storeId:id,actor:context.actor,expectedVersion:Number(formText(data,"expectedVersion",{required:true,max:16})),key:formText(data,"submissionKey",{required:true,max:120}),notes:formText(data,"notes",{max:3000})});
    return relativeRedirect303(`/app/stores/${encodeURIComponent(id)}?saved=access`);
  } catch(error) {return opsApiError(error);}
}
