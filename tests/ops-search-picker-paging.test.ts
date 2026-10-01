import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SearchPicker, mergePickPage, pickerCountText, type PickOption } from "@/components/ops/search-picker";
import { storeVendorPickPage } from "@/components/ops/work-routing-fields";
import { buildNorthlinePresentationFixture, buildSyntheticScaleFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";

describe("store picker paging", () => {
  it("reaches every store through Load more, 25 at a time, with the full count", async () => {
    const fixture = buildSyntheticScaleFixture(65);
    const organizationId = fixture.organizations[0].id;
    const repository = createOpsFixtureRepository(fixture);
    const seen: string[] = [];
    let cursor: string | undefined, pages = 0, total: number | undefined;
    do {
      const page = await repository.searchStores({ organizationId }, "", { limit: 25, cursor });
      total = page.totalCount; seen.push(...page.items.map((store) => store.id)); cursor = page.nextCursor; pages += 1;
      if (pages === 1) expect(pickerCountText({ shown: seen.length, next: cursor, serverTotal: total, query: "" })).toBe("Showing 25 of 65 matches · load more or type to narrow");
    } while (cursor && pages < 10);
    expect(pages).toBe(3);
    expect(new Set(seen).size).toBe(65);
    expect(total).toBe(65);
    // A store only on the last page is selectable once loaded, and stays selected.
    const last = seen.at(-1)!;
    expect(seen.slice(0, 25)).not.toContain(last);
  });
});

describe("vendor picker paging", () => {
  it("offers the next page while more vendors cover the store, and stops at the end", async () => {
    const fixture = buildNorthlinePresentationFixture();
    const template = fixture.vendors.find((vendor) => vendor.organizationId === NORTHLINE_ORGANIZATION_ID && vendor.status === "approved")!;
    for (let index = 0; index < 30; index += 1) {
      const id = `vendor-extra-${String(index).padStart(2, "0")}`;
      fixture.vendors.push({ ...template, id, name: `Extra Vendor ${String(index).padStart(2, "0")}` });
      fixture.vendorCoverage.push({ ...fixture.vendorCoverage.find((row) => row.vendorId === template.id)!, id: `coverage-${id}`, vendorId: id, scopeKind: "organization", scopeId: NORTHLINE_ORGANIZATION_ID });
    }
    const repository = createOpsFixtureRepository(fixture);
    const scope = { organizationId: NORTHLINE_ORGANIZATION_ID };
    const first = storeVendorPickPage(await repository.queryStoreVendors(scope, "store-northline-104", { offset: 0 }), 0);
    expect(first.items).toHaveLength(25);
    expect(first.next).toBe("25");
    const second = storeVendorPickPage(await repository.queryStoreVendors(scope, "store-northline-104", { offset: 25 }), 25);
    expect(second.next).toBeUndefined();
    const all = mergePickPage(first.items, second.items);
    expect(all).toHaveLength(35);
    // Vendors after the first 25 alphabetically are only reachable on the second page.
    expect(first.items.map((vendor) => vendor.label)).not.toContain("PumpPro Fuel & Dispenser Repair");
    expect(second.items.map((vendor) => vendor.label)).toEqual(expect.arrayContaining(["GreenLot Landscaping & Snow Removal", "PumpPro Fuel & Dispenser Repair"]));
    expect(first.items.map((vendor) => vendor.value)).not.toContain(second.items.at(-1)!.value);
  });
});

describe("picker paging rules", () => {
  const option = (value: string): PickOption => ({ value, label: value });

  it("never reads as a complete list while more matches exist", () => {
    expect(pickerCountText({ shown: 25, next: "c", query: "" })).toBe("Showing the first 25 matches · more available");
    expect(pickerCountText({ shown: 25, next: "c", serverTotal: 70, query: "store" })).toBe("Showing 25 of 70 matches · load more or type to narrow");
    expect(pickerCountText({ shown: 12, query: "store" })).toBe("12 matches");
  });

  it("adds a page without repeating rows", () => {
    expect(mergePickPage([option("a"), option("b")], [option("b"), option("c")]).map((row) => row.value)).toEqual(["a", "b", "c"]);
  });

  it("keeps a selection that is not on the page being shown", () => {
    const html = renderToStaticMarkup(createElement(SearchPicker, { name: "storeId", label: "Store", options: [option("store-1"), option("store-2")], defaultOption: { value: "store-60", label: "Store 160" } }));
    expect(html).toContain('name="storeId" value="store-60"');
    expect(html).toContain("Store 160");
  });
});
