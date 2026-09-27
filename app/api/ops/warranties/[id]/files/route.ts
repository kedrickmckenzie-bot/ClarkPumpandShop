import {getOpsRequestContext,opsApiError} from "@/lib/server/ops-request-context";
import {warrantyFileContext} from "@/lib/server/warranty-file-context";
import {relativeRedirect303} from "@/lib/server/relative-redirect";
import {getQuoteUploadStore} from "@/components/ops-public/server-file-store";
import {attachWarrantyFiles} from "@/lib/ops/warranty-commands";
import {OpsDomainError} from "@/lib/ops/errors";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {try {const {id}=await params,{session,repository,actor}=await getOpsRequestContext(["executive","facilities","regional"],undefined,request),{back}=await warrantyFileContext(repository,session,id),form=await request.formData();
 const files=form.getAll("files").filter((f):f is File=>f instanceof File&&f.size>0);
 if(!files.length||files.length>5||files.reduce((n,f)=>n+f.size,0)>8*1024*1024||files.some(f=>!["application/pdf","image/jpeg","image/png","image/webp","text/plain"].includes(f.type)))throw new OpsDomainError("VALIDATION","Attach up to five PDF, JPG, PNG, WebP or text files, 8 MB total.");
 const stored=await getQuoteUploadStore(session.accessMode==="preview").store({organizationId:session.organizationId,subjectType:"warranty",subjectId:id,uploads:await Promise.all(files.map(async f=>({name:f.name.slice(0,180),mediaType:f.type,size:f.size,bytes:await f.arrayBuffer()}))),idempotencyKey:crypto.randomUUID()});
 if(stored.some(f=>!f.stored))throw new OpsDomainError("VALIDATION","Files could not be stored. Try again.");
 await attachWarrantyFiles({organizationId:session.organizationId,actor,id,files:stored.map(f=>({id:`file-${crypto.randomUUID()}`,organizationId:session.organizationId,storageKey:f.key,sha256:f.sha256,originalName:f.originalName,contentType:f.mediaType,byteLength:f.size,status:"available",createdAt:new Date().toISOString()}))},{repository});
 return relativeRedirect303(back+"?saved=files#documents");}catch(error){return opsApiError(error);}}
