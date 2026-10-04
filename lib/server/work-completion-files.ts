import { getQuoteUploadStore } from "@/components/ops-public/server-file-store";
import { OpsDomainError } from "@/lib/ops/errors";
export async function storeCompletionFiles(form: FormData, organizationId: string, workOrderId: string, preview: boolean, submissionKey?: string) {
  const files = form.getAll("attachments").filter((value): value is File => value instanceof File && value.size > 0);
  if (files.length > 5 || files.reduce((sum, file) => sum + file.size, 0) > 8 * 1024 * 1024 || files.some(file => !["application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain"].includes(file.type))) throw new OpsDomainError("VALIDATION", "Attach up to five PDF, JPG, PNG, WebP or text files, 8 MB total.");
  if (!files.length) return [];
  const uploads = await Promise.all(files.map(async file => ({ name: file.name.slice(0, 180), mediaType: file.type, size: file.size, bytes: await file.arrayBuffer() })));
  let stored:Awaited<ReturnType<import("@/components/ops-public/server-file-store").PublicUploadStore["store"]>>;
  try { stored = await getQuoteUploadStore(preview).store({ organizationId, subjectType: "work_order", subjectId: workOrderId, uploads, idempotencyKey: submissionKey ?? crypto.randomUUID() }); }
  catch(error){const configuration=error instanceof Error && /not configured|configuration|binding|credentials|storage provider/i.test(error.message);throw new OpsDomainError("VALIDATION",configuration?"File storage is not configured. Ask an administrator to connect private storage, or save without files.":"Files could not be stored. Your details are still here; try again.");}
  if (stored.some(file => !file.stored)) throw new OpsDomainError("VALIDATION", "Files could not be stored. Please try again.");
  return stored.map((file,index) => ({ id: submissionKey ? `result-file-${workOrderId}-${submissionKey}-${index}` : `file-${crypto.randomUUID()}`, organizationId, storageKey: file.key, sha256: file.sha256, originalName: file.originalName, contentType: file.mediaType, byteLength: file.size, status: "available" as const, createdAt: new Date().toISOString() }));
}

export async function completionFileIntent(form:FormData){
  const files=form.getAll("attachments").filter((value):value is File=>value instanceof File&&value.size>0);
  if(files.length>5||files.reduce((sum,file)=>sum+file.size,0)>8*1024*1024||files.some(file=>!["application/pdf","image/jpeg","image/png","image/webp","text/plain"].includes(file.type)))throw new OpsDomainError("VALIDATION","Attach up to five PDF, JPG, PNG, WebP or text files, 8 MB total.");
  return Promise.all(files.map(async(file)=>({sha256:Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",await file.arrayBuffer())),b=>b.toString(16).padStart(2,"0")).join(""),originalName:file.name.slice(0,180),contentType:file.type})));
}
