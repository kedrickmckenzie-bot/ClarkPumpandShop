import { describe, expect, it } from "vitest";
import type { OperatorSession } from "@/components/ops/data-contract";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import { buildSpendDashboard, buildSpendEquipment, buildSpendStores, buildSpendVendors, spendScope } from "@/app/app/_data/spend-dashboard";

const session = (role: OperatorSession["role"] = "facilities", storeIds?: string[]): OperatorSession => ({ organizationId: NORTHLINE_ORGANIZATION_ID, userId: "u", displayName: "Manager", email: "m@example.test", organizationName: "Clark Pump and Shop", scopeLabel: "All stores", role, ...(storeIds ? { storeIds } : {}) });
const minor = (label: string) => Math.round(Number(label.replace(/[^0-9.-]/g, "")) * 100);

describe("Spending dashboard", () => {
  const fixture = buildNorthlinePresentationFixture();
  it("adds up: the grid, service areas and vendors all total the recorded job cost", () => {
    const model = buildSpendDashboard(fixture, session(), {});
    const expected = fixture.costLines.filter(line => line.organizationId === NORTHLINE_ORGANIZATION_ID && line.amount.currency === "USD" && line.serviceDate >= model.scope.period.start && line.serviceDate.slice(0, 10) <= model.scope.through).reduce((sum, line) => sum + line.amount.amountMinor, 0);
    expect(model.scope.total).toBe(expected);
    expect(model.metrics.find(metric => metric.id === "recorded")?.value).toBe(model.grid.grandTotal);
    expect(model.areas.reduce((sum, segment) => sum + segment.amount, 0)).toBe(expected);
    const vendors = buildSpendVendors(fixture, session(), {});
    expect(vendors.rows.reduce((sum, row) => sum + row.amount, 0)).toBe(expected);
    const stores = buildSpendStores(fixture, session(), {});
    expect(stores.grid.rows.reduce((sum, row) => sum + minor(row.total), 0)).toBeCloseTo(expected, -3);
  });
  it("pages long lists and keeps every link inside Spending with the same filters", () => {
    const query = { period: "6m", region: fixture.stores[0].regionId! };
    const stores = buildSpendStores(fixture, session(), { ...query });
    expect(stores.grid.rows.length).toBeLessThanOrEqual(15);
    for (const cell of stores.grid.rows.flatMap(row => row.cells).filter(cell => cell.amount)) expect(new URL(cell.href, "https://x.test").searchParams.get("period")).toBe("6m");
    const equipment = buildSpendEquipment(fixture, session(), { page: "2" });
    expect(equipment.rows.length).toBeLessThanOrEqual(25);
    expect(equipment.offset).toBe(25);
  });
  it("narrows to one store for a store manager, by machine, without the company-wide in-house total", () => {
    const store = fixture.stores[3].id;
    const model = buildSpendDashboard(fixture, session("store_manager", [store]), {});
    expect(model.scope.singleStoreId).toBe(store);
    expect(model.metrics.find(metric => metric.id === "in-house")?.value).toBe("—");
    expect(model.metrics.some(metric => metric.id === "typical")).toBe(false);
    expect(spendScope(fixture, session("store_manager", [store]), {}).facts.every(row => row.storeId === store)).toBe(true);
  });
});
