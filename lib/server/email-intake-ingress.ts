import { getQuoteUploadStore } from "@/components/ops-public/server-file-store";
import type { PublicUpload } from "@/components/ops-public/contracts";
import type { StoredFile } from "@/lib/ops/types";
import { OpsDomainError } from "@/lib/ops/commands";

export async function verifyEmailSignature(body: string, timestamp: string, signature: string, secret: string, now = Date.now()) {
  if (secret.length < 32 || !/^\d+$/.test(timestamp) || Math.abs(now - Number(timestamp) * 1000) > 300000 || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const key = await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{ name:"HMAC",hash:"SHA-256" },false,["verify"]);
  return crypto.subtle.verify("HMAC",key,Uint8Array.from(signature.match(/../g)!,part => parseInt(part,16)),new TextEncoder().encode(`${timestamp}.${body}`));
}

export async function storeEmailFiles(org: string, messageKey: string, uploads: PublicUpload[], demo: boolean): Promise<StoredFile[]> {
  if (uploads.length > 5 || uploads.reduce((sum,file) => sum + file.size,0) > 8 * 1024 * 1024 || uploads.some(file => !["application/pdf","image/png","image/jpeg","image/webp","text/plain"].includes(file.mediaType) || file.size !== file.bytes.byteLength)) throw new OpsDomainError("VALIDATION","Attach up to five PDF, image or text files, 8 MB total.");
  const stored = await getQuoteUploadStore(demo).store({ organizationId:org,subjectType:"inbound_email",subjectId:messageKey,uploads,idempotencyKey:messageKey });
  if (stored.some(file => !file.stored)) throw new Error("Email attachments could not be stored. Try again.");
  return stored.map(file => ({ id:`file-${crypto.randomUUID()}`,organizationId:org,storageKey:file.key,sha256:file.sha256,originalName:file.originalName,contentType:file.mediaType,byteLength:file.size,status:"available",createdAt:new Date().toISOString() }));
}
