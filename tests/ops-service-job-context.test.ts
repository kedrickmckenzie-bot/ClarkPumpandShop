import { beforeEach, describe, expect, it } from "vitest";
import { PUBLIC_DEMO_LINKS, resolveServiceJobContext, resolveServiceJobPhoto } from "@/components/ops-public/server-gateway";
import { getNorthlineFixtureRepository, resetNorthlineFixtureRepository } from "@/lib/ops/fixture-repository";
import { NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";

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
});
