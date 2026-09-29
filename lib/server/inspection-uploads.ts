import { getQuoteUploadStore } from "@/components/ops-public/server-file-store";
import { OpsDomainError } from "@/lib/ops/errors";
export async function uploadInspectionFiles(form:FormData,field:string,org:string,id:string,preview:boolean,subjectType:"inspection"|"store_task"="inspection") {
 const files=form.getAll(field).filter((f):f is File=>f instanceof File&&f.size>0);
 if(files.length>5||files.reduce((n,f)=>n+f.size,0)>8*1024*1024||files.some(f=>!["application/pdf","image/jpeg","image/png","image/webp","text/plain"].includes(f.type)))throw new OpsDomainError("VALIDATION","Attach up to five PDF, JPG, PNG, WebP or text files, 8 MB total.");
 if(!files.length)return [];
 const uploads=await Promise.all(files.map(async f=>({name:f.name.slice(0,180),mediaType:f.type,size:f.size,bytes:await f.arrayBuffer()})));
 let stored;
 try {stored=await getQuoteUploadStore(preview).store({organizationId:org,subjectType,subjectId:id,uploads,idempotencyKey:`${id}:${crypto.randomUUID()}`});}
 catch(error){console.error("Evidence upload failed",error);throw new OpsDomainError("VALIDATION","File uploads are unavailable right now. Try again later, or remove the attachments to save without them.");}
 if(stored.some(f=>!f.stored))throw new OpsDomainError("VALIDATION","Files could not be stored. Please try again.");
 return stored.map(f=>({id:`file-${crypto.randomUUID()}`,organizationId:org,storageKey:f.key,sha256:f.sha256,originalName:f.originalName,contentType:f.mediaType,byteLength:f.size,status:"available" as const,createdAt:new Date().toISOString()}));
}
