import { approveArrivingVendor } from "@/lib/ops/vendor-arrival-review";
import { assertStoreInSessionScope, formText, getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
 try {
  const context=await getOpsRequestContext(["facilities"],"onboard_vendor",request,true),{id}=await params,data=await request.formData();
  const storeId=formText(data,"storeId",{required:true,max:120});await assertStoreInSessionScope(context.session,storeId);
  await approveArrivingVendor({repository:context.repository},{organizationId:context.session.organizationId,vendorId:id,storeId,trade:formText(data,"trade",{required:true,max:40}),name:formText(data,"name",{required:true,max:160}),email:formText(data,"email",{required:true,max:254}),phone:formText(data,"phone",{max:60}),actor:context.actor});
  return relativeRedirect303(`/app/vendors/${encodeURIComponent(id)}?notice=Vendor+approved+for+the+selected+store`);
 }catch(error){return opsApiError(error);}
}
