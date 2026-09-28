import { getQuoteUploadStore } from "@/components/ops-public/server-file-store";
import { OpsDomainError } from "@/lib/ops/errors";
import { saveInvoiceUpload, assertInvoiceReceiver } from "@/lib/ops/invoice-upload-commands";
import { invoiceUploadContext } from "@/lib/server/invoice-upload-access";
import { opsApiError } from "@/lib/server/ops-request-context";
export async function POST(request:Request){try{
 const c=await invoiceUploadContext(request);await assertInvoiceReceiver(c.repository,c.actor);
 const form=await request.formData(),file=form.get("file");
 if(!(file instanceof File)||!file.size||file.size>15*1024*1024)throw new OpsDomainError("VALIDATION","Choose a PDF or photo up to 15 MB.");
 const bytes=await file.arrayBuffer(),b=new Uint8Array(bytes),head=new TextDecoder().decode(b.slice(0,12));
 const type=head.startsWith("%PDF-")?"application/pdf":b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71?"image/png":b[0]===255&&b[1]===216&&b[2]===255?"image/jpeg":head.startsWith("RIFF")&&head.slice(8)==="WEBP"?"image/webp":null;
 if(!type)throw new OpsDomainError("VALIDATION","Use a PDF, JPEG, PNG, or WebP file.");
 const hash=Buffer.from(await crypto.subtle.digest("SHA-256",bytes)).toString("hex");
 const existing=await c.repository.findInvoiceUpload(c.session.organizationId,hash);if(existing)return Response.json(existing);
 const [stored]=await getQuoteUploadStore(c.session.accessMode==="preview").store({organizationId:c.session.organizationId,subjectType:"invoice",subjectId:hash,idempotencyKey:hash,uploads:[{name:file.name.slice(0,180),mediaType:type,size:file.size,bytes}]});
 if(!stored?.stored)throw new Error("File storage unavailable");
 const row=await saveInvoiceUpload(c.repository,c.actor,{id:`file-${crypto.randomUUID()}`,organizationId:c.session.organizationId,storageKey:stored.key,sha256:hash,originalName:stored.originalName,contentType:type,byteLength:stored.size,status:"available",createdAt:new Date().toISOString()});
 return Response.json(row,{status:201});
}catch(error){return opsApiError(error)}}
