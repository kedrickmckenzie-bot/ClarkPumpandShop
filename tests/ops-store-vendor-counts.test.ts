import { expect, it } from "vitest";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";
import { storeVendorsFromFixture } from "@/lib/ops/store-vendors";

it("counts preferred and covering vendors across every match, not just the first page", () => {
  const fixture = buildNorthlinePresentationFixture(), organizationId = fixture.organizations[0].id, storeId = "store-northline-104";
  const template = fixture.vendors[0];
  for (let i = 0; i < 40; i++) {
    const id = `vendor-count-${String(i).padStart(2, "0")}`;
    fixture.vendors.push({ ...template, id, name: `Zeta Count Vendor ${i}` });
    fixture.vendorCoverage.push({ ...fixture.vendorCoverage.find((c) => c.vendorId === template.id)!, id: `coverage-${id}`, vendorId: id, scopeKind: "store", scopeId: storeId });
    // The last ten sort onto later pages, so a first-page count would miss them.
    if (i >= 30) fixture.storeVendorPreferences = [...(fixture.storeVendorPreferences ?? []), { id: `pref-${id}`, organizationId, storeId, vendorId: id, tradeKeysJson: "[\"*\"]", version: 1, createdAt: "2026-09-01T12:00:00.000Z" }];
  }
  const page = storeVendorsFromFixture(fixture, { organizationId }, storeId, {});
  expect(page.items).toHaveLength(25);
  expect(page).toMatchObject({ total: 45, preferredTotal: 10, coveredTotal: 45 });
});
