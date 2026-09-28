import { resolveInspectionMasterFiles } from "@/components/ops-public/server-gateway";
import { publicApiError } from "@/components/ops-public/server-http";
import { quoteFileResponse } from "@/lib/server/quote-file-response";
export async function GET(request:Request,{params}:{params:Promise<{token:string;fileId:string}>}) {
  try { const {token,fileId}=await params;const files=await resolveInspectionMasterFiles(token);return await quoteFileResponse(files.find(f=>f.id===fileId)??null, request); }
  catch(error) { return publicApiError(error); }
}
