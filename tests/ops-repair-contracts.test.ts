import { describe, expect, it } from "vitest";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import { navigationForRole } from "@/components/ops/navigation";

describe("repair contracts", () => {
  it("never counts another tenant's outbox messages", async () => {
    const fixture = buildNorthlinePresentationFixture();
    const own = fixture.outboxMessages.filter((row) => row.organizationId === NORTHLINE_ORGANIZATION_ID);
    expect(own.length).toBeGreaterThan(0);
    const repository = createOpsFixtureRepository({
      ...fixture,
      outboxMessages: [
        ...own,
        ...own.slice(0, 2).map((row, index) => ({ ...row, id: `${row.id}-foreign-${index}`, organizationId: "org-foreign" })),
      ],
    });

    const ownCounts = await repository.outboxStatusCounts(NORTHLINE_ORGANIZATION_ID);
    expect(ownCounts.reduce((sum, row) => sum + row.count, 0)).toBe(own.length);

    const foreignCounts = await repository.outboxStatusCounts("org-foreign");
    expect(foreignCounts.reduce((sum, row) => sum + row.count, 0)).toBe(2);
  });

  it("keeps the primary navigation at six destinations with one role-aware Overview slot", () => {
    for (const role of ["executive", "facilities", "regional", "store_manager", "finance"] as const) {
      const items = navigationForRole(role);
      expect(items.map((item) => item.id)).not.toContain("brief");
      expect(items.length).toBeLessThanOrEqual(6);
      const overview = items.find((item) => item.id === "overview")!;
      if (role === "executive") {
        expect(overview.href).toBe("/app/brief");
        expect(overview.matchPrefixes).toContain("/app/brief");
      } else {
        expect(overview.href).toBe("/app/overview");
      }
    }
  });
});
