import { beforeEach, describe, expect, it } from "vitest";
import { PUBLIC_DEMO_LINKS, resolveServiceJobContext, resolveServiceJobPhoto } from "@/components/ops-public/server-gateway";
import { getNorthlineFixtureRepository, resetNorthlineFixtureRepository } from "@/lib/ops/fixture-repository";
import { NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import { setJobPhotoSharing } from "@/lib/ops/commands";

describe("what a vendor technician sees about the job", () => {
  beforeEach(() => { resetNorthlineFixtureRepository(); });

  it("shows equipment facts and only this vendor's own earlier work on the unit", async () => {
    const job = await resolveServiceJobContext(PUBLIC_DEMO_LINKS.serviceToken);
    expect(job).not.toBeNull();
    expect(job!.reportedAt).toBeTruthy();
    expect(job!.equipment?.name).toBeTruthy();
    const repository = getNorthlineFixtureRepository(), org = NORTHLINE_ORGANIZATION_ID;
    const snapshot = repository.snapshot();
    for (const item of job!.history) {
      const assignments = snapshot.assignments.filter(a => a.organizationId === org && a.workOrderId === item.id);
      expect(assignments.some(a => a.kind === "outside_vendor")).toBe(true);
    }
    // The vendor history never carries money or internal people.
    expect(JSON.stringify(job)).not.toMatch(/Minor|costMinor|Maria Santos|Jordan Lee/);
  });

  it("serves only photos shared with the vendor", async () => {
    expect(await resolveServiceJobPhoto(PUBLIC_DEMO_LINKS.serviceToken, "not-a-shared-file")).toBeNull();
    await expect(resolveServiceJobContext("not-a-real-token")).rejects.toThrow(/invalid/);
  });

  it("shows a photo only after a manager shares it, records each change, and can hide it again", async () => {
    const repository = getNorthlineFixtureRepository(), org = NORTHLINE_ORGANIZATION_ID;
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(PUBLIC_DEMO_LINKS.serviceToken));
    const tokenHash = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
    const view = await repository.getServiceAuthorizationByToken({ tokenHash, purpose: "service_authorization", now: new Date().toISOString() });
    const work = (await repository.getWorkOrder(org, view!.workOrderId))!;
    const now = "2026-10-01T12:00:00.000Z", sha = "a".repeat(64);
    const addPhoto = (fileId: string, entityType: string, entityId: string) => repository.atomicWrite([
      { sql: "INSERT INTO ops_files (id, organization_id, storage_key, sha256, original_name, content_type, byte_length, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", params: [fileId, org, `test/${fileId}.jpg`, sha, `${fileId}.jpg`, "image/jpeg", 10, "available", now] },
      { sql: "INSERT INTO ops_entity_files (id, organization_id, file_id, entity_type, entity_id, purpose, visibility, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", params: [`link-${fileId}`, org, fileId, entityType, entityId, "photo", "internal", now] },
    ]);
    await addPhoto("photo-job", "work_order", work.id);
    if (work.requestId) await addPhoto("photo-report", "request", work.requestId);
    const actor = { organizationId: org, actorType: "user" as const, actorId: "membership-northline-facilities", actorName: "Jordan Lee" };
    const seen = async () => (await resolveServiceJobContext(PUBLIC_DEMO_LINKS.serviceToken))!.photos.map(p => p.id);

    expect(await seen()).not.toContain("photo-job");
    expect(await resolveServiceJobPhoto(PUBLIC_DEMO_LINKS.serviceToken, "photo-job")).toBeNull();
    await setJobPhotoSharing({ repository }, { organizationId: org, workOrderId: work.id, fileId: "photo-job", shared: true, actor });
    expect(await seen()).toContain("photo-job");
    expect((await resolveServiceJobPhoto(PUBLIC_DEMO_LINKS.serviceToken, "photo-job"))?.id).toBe("photo-job");
    if (work.requestId) {
      expect(await seen()).not.toContain("photo-report");
      await setJobPhotoSharing({ repository }, { organizationId: org, workOrderId: work.id, fileId: "photo-report", shared: true, actor });
      expect(await seen()).toContain("photo-report");
    }
    expect(await setJobPhotoSharing({ repository }, { organizationId: org, workOrderId: work.id, fileId: "photo-job", shared: true, actor })).toMatchObject({ changed: false });
    await setJobPhotoSharing({ repository }, { organizationId: org, workOrderId: work.id, fileId: "photo-job", shared: false, actor });
    expect(await seen()).not.toContain("photo-job");
    const events = repository.snapshot().auditEvents.filter(e => e.aggregateId === work.id && /photo_(un)?shared_with_vendor/.test(e.eventType)).map(e => e.eventType);
    expect(events.filter(e => e === "work_order.photo_shared_with_vendor")).toHaveLength(work.requestId ? 2 : 1);
    expect(events).toContain("work_order.photo_unshared_with_vendor");
    await expect(setJobPhotoSharing({ repository }, { organizationId: org, workOrderId: work.id, fileId: "not-on-this-job", shared: true, actor })).rejects.toThrow(/not found/i);
    await expect(setJobPhotoSharing({ repository }, { organizationId: "other-org", workOrderId: work.id, fileId: "photo-job", shared: true, actor })).rejects.toThrow();
  });
});
