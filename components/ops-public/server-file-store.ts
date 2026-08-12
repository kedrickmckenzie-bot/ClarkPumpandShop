import type { PublicUpload } from "./contracts";

export interface StoredPublicUpload {
  key: string;
  originalName: string;
  mediaType: string;
  size: number;
  sha256: string;
  stored: boolean;
}

export interface PublicUploadStore {
  store(input: {
    organizationId: string;
    subjectType: "request" | "visit";
    subjectId: string;
    uploads: PublicUpload[];
  }): Promise<StoredPublicUpload[]>;
}

class SitesR2PublicUploadStore implements PublicUploadStore {
  async store(input: {
    organizationId: string;
    subjectType: "request" | "visit";
    subjectId: string;
    uploads: PublicUpload[];
  }): Promise<StoredPublicUpload[]> {
    const { env } = await import("cloudflare:workers");
    const bindings = env as unknown as { FILES?: R2Bucket };
    const stored: StoredPublicUpload[] = [];
    for (const upload of input.uploads) {
      const key = `ops-public/${input.organizationId}/${input.subjectType}/${input.subjectId}/${crypto.randomUUID()}`;
      const digest = await crypto.subtle.digest("SHA-256", upload.bytes);
      const sha256 = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
      if (bindings.FILES) {
        await bindings.FILES.put(key, upload.bytes, {
          httpMetadata: { contentType: upload.mediaType },
          customMetadata: {
            organizationId: input.organizationId,
            subjectType: input.subjectType,
            subjectId: input.subjectId,
            originalName: upload.name,
          },
        });
      }
      stored.push({
        key,
        originalName: upload.name,
        mediaType: upload.mediaType,
        size: upload.size,
        sha256,
        stored: Boolean(bindings.FILES),
      });
    }
    return stored;
  }
}

export function getPublicUploadStore(): PublicUploadStore {
  // Cloudflare-specific code is isolated here. Replace this adapter with an
  // S3-compatible implementation when the production Render runtime is wired.
  return new SitesR2PublicUploadStore();
}
