import { describe, expect, it } from "vitest";
import { buildNorthlinePresentationFixture, NORTHLINE_AS_OF } from "@/lib/ops/fixtures";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";

const capabilities = [
  ["store_gateway", "getPublicStoreGatewayByToken"],
  ["service_authorization", "getServiceAuthorizationByToken"],
  ["active_visit", "getActiveVisitByToken"],
  ["trusted_store_device", "getTrustedStoreDeviceByToken"],
  ["vendor_estimate", "getEstimateRequestByPublicToken"],
  ["service_run_response", "getServiceRunByPublicToken"],
] as const;

describe("capability and scoped read boundaries", () => {
  it.each(capabilities)("rejects expired, revoked, wrong-purpose and cross-tenant %s links", async (purpose, method) => {
    for (const invalid of ["valid", "expired", "revoked", "purpose", "tenant"] as const) {
      const data = buildNorthlinePresentationFixture();
      const token = data.publicTokens.find(row => row.purpose === purpose)!;
      if (invalid === "expired") token.expiresAt = NORTHLINE_AS_OF;
      if (invalid === "revoked") token.revokedAt = NORTHLINE_AS_OF;
      if (invalid === "tenant") token.organizationId = "another-company";
      const repository = createOpsFixtureRepository(data);
      const result = await repository[method]({ tokenHash: token.tokenHash, purpose: invalid === "purpose" ? "report_issue" : purpose, now: NORTHLINE_AS_OF });
      if (invalid === "valid") expect(result).not.toBeNull();
      else expect(result).toBeNull();
      expect(token.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("returns no records or aggregate values for another company or an empty assigned scope", async () => {
    const data = buildNorthlinePresentationFixture(); const repository = createOpsFixtureRepository(data);
    for (const scope of [{ organizationId: "another-company" }, { organizationId: data.organizations[0].id, storeIds: [] }, { organizationId: data.organizations[0].id, regionIds: [] }]) {
      const pages = await Promise.all([
        repository.searchStores(scope, ""), repository.searchAssets(scope, ""), repository.listRequests(scope), repository.listWorkOrders(scope),
        repository.listVisits(scope), repository.listExceptions(scope), repository.listPmOccurrences(scope),
      ]);
      for (const page of pages) expect(page.items).toEqual([]);
      expect(await repository.getStoreDetail(scope, data.stores[0].id)).toBeNull();
      expect(await repository.getWorkOrderDetail(scope, data.workOrders[0].id)).toBeNull();
      const snapshot = await repository.getExecutiveSnapshot(scope, { startsAt: "2026-01-01T00:00:00.000Z", endsAt: NORTHLINE_AS_OF });
      expect(snapshot.recordedCost.amountMinor).toBe(0);
      expect(Object.values(snapshot.sourceCounts).every(count => count === 0)).toBe(true);
    }
  });
});
