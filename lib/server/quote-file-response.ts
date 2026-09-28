import type { StoredFile } from "@/lib/ops/types";
import { readPrivateUpload } from "@/components/ops-public/server-file-store";
export async function quoteFileResponse(file: StoredFile | null, request?: Request) {
  if (!file || file.status !== "available") return new Response("File unavailable", { status: 404 });
  const bytes = await readPrivateUpload(file.storageKey);
  if (!bytes) return new Response("The document is not available in storage. Ask the record owner to upload it again.", { status: 404 });
  const preview = ["application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain"].includes(file.contentType) && (!request || new URL(request.url).searchParams.get("download") !== "1");
  return new Response(bytes, { headers: { "content-type": file.contentType, "content-disposition": `${preview ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.originalName)}`, "cache-control": "private, no-store", "x-content-type-options": "nosniff", "content-security-policy": "sandbox; default-src 'none'; frame-ancestors 'self'" } });
}
