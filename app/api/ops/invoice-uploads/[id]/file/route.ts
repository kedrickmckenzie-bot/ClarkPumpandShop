import { invoiceUploadRecord } from "@/lib/server/invoice-upload-access";
import { quoteFileResponse } from "@/lib/server/quote-file-response";
import { opsApiError } from "@/lib/server/ops-request-context";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{const c=await invoiceUploadRecord(request,(await params).id);return quoteFileResponse(await c.repository.getStoredFileById(c.session.organizationId,c.row.fileId),request);}catch(error){return opsApiError(error)}}
