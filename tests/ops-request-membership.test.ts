import { describe, expect, it, vi } from "vitest";
import type { OperatorSession } from "@/components/ops/data-contract";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import {
  NORTHLINE_ORGANIZATION_ID,
  buildNorthlinePresentationFixture,
} from "@/lib/ops/fixtures";
import { assertActiveOperatorMembership } from "@/lib/server/ops-request-context";

vi.mock("server-only", () => ({}));

function facilitiesSession(overrides: Partial<OperatorSession> = {}): OperatorSession {
  return {
    userId: "user-northline-facilities",
    membershipId: "membership-northline-facilities",
    displayName: "Jordan Lee",
    email: "jordan.lee@clark-demo.example",
    role: "facilities",
    organizationId: NORTHLINE_ORGANIZATION_ID,
    organizationName: "Clark Pump and Shop",
    scopeLabel: "Clark Pump and Shop companywide · 15 stores",
    ...overrides,
  };
}

describe("operator mutation membership boundary", () => {
  it("accepts the exact active membership and role in the current tenant", async () => {
    const repository = createOpsFixtureRepository(buildNorthlinePresentationFixture());

    await expect(assertActiveOperatorMembership(repository, facilitiesSession())).resolves.toMatchObject({
      id: "membership-northline-facilities",
      organizationId: NORTHLINE_ORGANIZATION_ID,
      role: "facilities_admin",
      status: "active",
    });
  });

  it("fails closed without a membership or for a cross-tenant identifier", async () => {
    const repository = createOpsFixtureRepository(buildNorthlinePresentationFixture());

    await expect(assertActiveOperatorMembership(repository, facilitiesSession({ membershipId: undefined })))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(assertActiveOperatorMembership(repository, facilitiesSession({ membershipId: "membership-other-tenant" })))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects a suspended membership and a role-cookie mismatch", async () => {
    const fixture = buildNorthlinePresentationFixture();
    fixture.memberships.find((membership) => membership.id === "membership-northline-facilities")!.status = "suspended";
    const suspendedRepository = createOpsFixtureRepository(fixture);

    await expect(assertActiveOperatorMembership(suspendedRepository, facilitiesSession()))
      .rejects.toMatchObject({ code: "FORBIDDEN" });

    const activeRepository = createOpsFixtureRepository(buildNorthlinePresentationFixture());
    await expect(assertActiveOperatorMembership(activeRepository, facilitiesSession({ role: "executive" })))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
