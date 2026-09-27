import { OpsDomainError } from "@/lib/ops/commands";
import { getOpsRequestContext,opsApiError } from "@/lib/server/ops-request-context";
import { quoteFileResponse } from "@/lib/server/quote-file-response";
export async function GET(request:Request,{params}:{params:Promise<{id:string;documentId:string}>}) {
  try {
    const {session,repository}=await getOpsRequestContext(["facilities","executive","finance"],undefined,undefined,true);
    if(session.storeIds!==undefined||session.regionIds!==undefined)throw new OpsDomainError("FORBIDDEN","Companywide access is required for vendor documents.");
    const {id,documentId}=await params;
    const document=(await repository.listVendorComplianceDocuments(session.organizationId,id)).find(d=>d.id===documentId);
    const file=document?.storedFileId?await repository.getStoredFileById(session.organizationId,document.storedFileId):null;
    const response=await quoteFileResponse(file);
    if(response.ok&&file&&new URL(request.url).searchParams.get("download")!=="1"&&["application/pdf","image/jpeg","image/png","image/webp","text/plain"].includes(file.contentType)) {
      response.headers.set("content-disposition",`inline; filename*=UTF-8''${encodeURIComponent(file.originalName)}`);
      response.headers.set("content-security-policy","sandbox; default-src 'none'; frame-ancestors 'self'");
    }
    return response;
  } catch(error) { return opsApiError(error); }
}
