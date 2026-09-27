import { getOpsRequestContext, assertStoreInSessionScope, formText, opsApiError } from "@/lib/server/ops-request-context";
import { OpsDomainError } from "@/lib/ops/commands";
import { setStoreVendorPreference } from "@/lib/ops/store-vendors";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
  try {
    const context=await getOpsRequestContext(["facilities","regional","store_manager","executive","finance"],undefined,request);
    const {id}=await params;await assertStoreInSessionScope(context.session,id);
    const q=new URL(request.url).searchParams;
    const page=await context.repository.queryStoreVendors(context.session,id,{search:q.get("q")?.slice(0,160),offset:Math.min(100000,Math.max(0,Math.floor(Number(q.get("offset"))||0)))});
    return Response.json(page);
  }catch(error){return opsApiError(error);}
}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
  try {
    const context=await getOpsRequestContext(["facilities","regional"],undefined,request);
    const {id}=await params;await assertStoreInSessionScope(context.session,id);
    const form=await request.formData(),keys=form.getAll("tradeKeys");
    if(keys.some(k=>typeof k!=="string"))throw new OpsDomainError("VALIDATION","Choose valid specialties.");
    await setStoreVendorPreference({repository:context.repository},{organizationId:context.session.organizationId,storeId:id,vendorId:formText(form,"vendorId",{required:true,max:200}),tradeKeys:keys as string[],version:Number(formText(form,"version",{required:true,max:20})),actor:context.actor});
    return relativeRedirect303(`/app/stores/${encodeURIComponent(id)}/vendors?notice=Store+preferences+saved`);
  }catch(error){return opsApiError(error);}
}
