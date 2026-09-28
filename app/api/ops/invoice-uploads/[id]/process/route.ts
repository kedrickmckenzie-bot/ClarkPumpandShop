import { invoiceUploadRecord } from "@/lib/server/invoice-upload-access";
import { processInvoiceUpload } from "@/lib/server/invoice-upload-processing";
import { opsApiError } from "@/lib/server/ops-request-context";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{const c=await invoiceUploadRecord(request,(await params).id);const row=await processInvoiceUpload(c.repository,c.actor,c.row);const invoice=row.invoiceId?await c.repository.getInvoice(c.session.organizationId,row.invoiceId):null;return Response.json({...row,hasFlags:invoice?.status==="exception"||invoice?.status==="warranty_hold"});}catch(error){return opsApiError(error)}}
