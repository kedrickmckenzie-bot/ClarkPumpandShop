import { describe, expect, it, vi } from "vitest";
import { createPublicUploadStore } from "@/components/ops-public/server-file-store";

const uploadBytes = new TextEncoder().encode("private evidence").buffer;
const upload = {
  name: "technician photo 1.jpg",
  mediaType: "image/jpeg",
  size: uploadBytes.byteLength,
  bytes: uploadBytes,
};

describe("public evidence private object storage", () => {
  it("uses a stable opaque object key when an idempotent checkout upload is retried", async () => {
    const put = vi.fn(async () => undefined);
    const store = createPublicUploadStore({
      environment: { OPS_OBJECT_STORAGE_PROVIDER: "r2" },
      r2Bucket: { put },
    });
    const input = {
      organizationId: "organization-secret-id",
      subjectType: "visit" as const,
      subjectId: "visit-secret-id",
      uploads: [upload],
      idempotencyKey: "checkout-browser-submit-0001",
    };

    const [first] = await store.store(input);
    const [retry] = await store.store(input);
    const [differentAction] = await store.store({ ...input, idempotencyKey: "checkout-browser-submit-0002" });

    expect(retry?.key).toBe(first?.key);
    expect(differentAction?.key).not.toBe(first?.key);
    expect(first?.key).toMatch(/^ops-private\/v1\/[a-f0-9]{32}\/visit\/[a-f0-9]{32}\/retry-[a-f0-9]{48}$/);
    expect(first?.key).not.toContain(input.idempotencyKey);
    expect(put).toHaveBeenCalledTimes(3);
  });

  it("preserves the Sites R2 binding and accepts the legacy provider alias during migration", async () => {
    const put = vi.fn(async () => undefined);
    const store = createPublicUploadStore({
      environment: { TRACEOPS_OBJECT_STORAGE_PROVIDER: "r2" },
      r2Bucket: { put },
      randomUUID: () => "11111111-2222-4333-8444-555555555555",
    });

    const [result] = await store.store({
      organizationId: "organization-secret-id",
      subjectType: "visit",
      subjectId: "visit-secret-id",
      uploads: [upload],
    });

    expect(result).toMatchObject({
      originalName: upload.name,
      mediaType: "image/jpeg",
      size: upload.size,
      stored: true,
    });
    expect(result?.key).toMatch(/^ops-private\/v1\/[a-f0-9]{32}\/visit\/[a-f0-9]{32}\/11111111-2222-4333-8444-555555555555$/);
    expect(result?.key).not.toContain("organization-secret-id");
    expect(result?.key).not.toContain("visit-secret-id");
    expect(put).toHaveBeenCalledWith(
      result?.key,
      upload.bytes,
      expect.objectContaining({
        httpMetadata: {
          contentType: "image/jpeg",
          cacheControl: "private, no-store",
        },
        customMetadata: expect.objectContaining({
          organizationId: "organization-secret-id",
          subjectType: "visit",
          subjectId: "visit-secret-id",
          originalName: upload.name,
          sha256: result?.sha256,
        }),
      }),
    );
  });

  it("uses a private SigV4-signed PUT for Render S3-compatible storage", async () => {
    let capturedUrl: URL | undefined;
    let capturedInit: RequestInit | undefined;
    const fetchRequest: typeof fetch = async (url, init) => {
      capturedUrl = new URL(String(url));
      capturedInit = init;
      return new Response(null, { status: 200 });
    };
    const store = createPublicUploadStore({
      environment: {
        RENDER: "true",
        S3_ENDPOINT: "https://objects.example.test",
        S3_REGION: "us-east-1",
        S3_BUCKET: "cstore-operations-files",
        S3_ACCESS_KEY_ID: "test-access-key",
        S3_SECRET_ACCESS_KEY: "test-secret-key",
        S3_SERVER_SIDE_ENCRYPTION: "AES256",
      },
      fetch: fetchRequest,
      now: () => new Date("2026-08-13T14:15:16.000Z"),
      randomUUID: () => "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    });

    const [result] = await store.store({
      organizationId: "org-northline-demo",
      subjectType: "request",
      subjectId: "request-104-opaque",
      uploads: [upload],
    });

    expect(result?.stored).toBe(true);
    expect(result?.key).not.toContain("org-northline-demo");
    expect(result?.key).not.toContain("request-104-opaque");
    const headers = capturedInit?.headers as Record<string, string>;
    expect(capturedUrl?.origin).toBe("https://objects.example.test");
    expect(capturedUrl?.pathname).toBe(`/cstore-operations-files/${result?.key}`);
    expect(capturedInit).toMatchObject({ method: "PUT", body: upload.bytes, redirect: "error" });
    expect(headers.authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=test-access-key\/20260813\/us-east-1\/s3\/aws4_request, SignedHeaders=/,
    );
    expect(headers["x-amz-date"]).toBe("20260813T141516Z");
    expect(headers["x-amz-content-sha256"]).toBe(result?.sha256);
    expect(headers["x-amz-server-side-encryption"]).toBe("AES256");
    expect(headers["cache-control"]).toBe("private, no-store");
    expect(headers["x-amz-meta-organization-id-b64"]).not.toContain("org-northline-demo");
    expect(headers["x-amz-meta-original-name-b64"]).not.toContain("technician photo");
  });

  it("fails closed when Render selects S3 without private-storage credentials", () => {
    expect(() => createPublicUploadStore({ environment: { RENDER: "true" } })).toThrow(
      /S3_ENDPOINT.*not configured/,
    );
  });

  it("does not report a failed S3 response as stored evidence", async () => {
    const store = createPublicUploadStore({
      environment: {
        OPS_OBJECT_STORAGE_PROVIDER: "s3",
        S3_ENDPOINT: "https://objects.example.test",
        S3_REGION: "us-east-1",
        S3_BUCKET: "cstore-operations-files",
        S3_ACCESS_KEY_ID: "test-access-key",
        S3_SECRET_ACCESS_KEY: "test-secret-key",
      },
      fetch: async () => new Response(null, { status: 503, headers: { "x-amz-request-id": "retry-later" } }),
      now: () => new Date("2026-08-13T14:15:16.000Z"),
      randomUUID: () => "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    });

    await expect(store.store({
      organizationId: "org-northline-demo",
      subjectType: "visit",
      subjectId: "visit-104",
      uploads: [upload],
    })).rejects.toThrow("status 503 (request retry-later)");
  });
});
