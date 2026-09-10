import type { StoredFile } from "@/lib/ops/types";
import { readPrivateUpload } from "@/components/ops-public/server-file-store";
export async function quoteFileResponse(file: StoredFile | null) {
  if (!file || file.status !== "available") return new Response("File unavailable", { status: 404 });
  const bytes = await readPrivateUpload(file.storageKey);
  if (!bytes) return new Response("This file is unavailable. Local demo files reset when the server restarts.", { status: 404 });
  return new Response(bytes, { headers: { "content-type": file.contentType, "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
}
