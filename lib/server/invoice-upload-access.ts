import "server-only";
import { getOpsRequestContext } from "./ops-request-context";
import { OpsDomainError } from "@/lib/ops/errors";
export async function invoiceUploadContext(request:Request) {
 const context=await getOpsRequestContext(["executive","facilities","finance"],undefined,request,true);
 if(context.session.storeIds!==undefined||context.session.regionIds!==undefined)throw new OpsDomainError("FORBIDDEN","Companywide invoice access is required.");
 return context;
}
export async function invoiceUploadRecord(request:Request,id:string) {
 const context=await invoiceUploadContext(request);
 const row=await context.repository.getInvoiceUpload(context.session.organizationId,id);
 if(!row)throw new OpsDomainError("NOT_FOUND","Invoice upload not found.");
 return {...context,row};
}
