import { invoiceUploadRecord } from "@/lib/server/invoice-upload-access";
import { dismissInvoiceUpload } from "@/lib/ops/invoice-upload-commands";
import { formText,opsApiError } from "@/lib/server/ops-request-context";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{const c=await invoiceUploadRecord(request,(await params).id),form=await request.formData();await dismissInvoiceUpload(c.repository,c.actor,c.row,formText(form,"reason",{required:true,max:2000}));return Response.json({ok:true});}catch(error){return opsApiError(error)}}
