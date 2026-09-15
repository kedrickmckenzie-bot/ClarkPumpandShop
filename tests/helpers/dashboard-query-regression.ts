import { expect } from "vitest";
import { briefQueryRegression } from "./brief-query-regression";
import { recordIntegrityRegression } from "./record-integrity-regression";
import { attentionQueryRegression } from "./attention-query-regression";
import type { OpsRepository, OrganizationScope } from "@/lib/ops/repository";
import type { OpsFixture } from "@/lib/ops/types";
import { createOpsFixtureReadRepository } from "@/lib/ops/fixture-repository";
import type { DashboardBreakdownKind, DashboardBreakdownRow } from "@/lib/ops/dashboard-query";

/** Run unchanged against migrated SQLite and PostgreSQL before mutating their shared fixture. */
export async function dashboardQueryRegression(repository: OpsRepository, fixture: OpsFixture) {
  await (await import("./pm-record-query-regression")).pmRecordQueryRegression(repository, fixture);
  await recordIntegrityRegression(repository, fixture);
  await briefQueryRegression(repository, fixture);
  await attentionQueryRegression(repository, fixture);
  const reference = createOpsFixtureReadRepository(fixture);
  const organizationId = fixture.organizations[0].id;
  const store = fixture.stores.find(row => row.storeNumber === "104")!;
  const window = { asOf: fixture.asOf, costFrom: "2025-09-01", costTo: fixture.asOf.slice(0, 10), currency: "USD" };
  const scopes: OrganizationScope[] = [
    { organizationId }, { organizationId, storeIds: [store.id] },
    { organizationId, regionIds: [store.regionId!] },
    { organizationId, storeIds: [] }, { organizationId, regionIds: [] },
    { organizationId: "another-organization", storeIds: [store.id] },
  ];
  for (const scope of scopes) {
    expect(await repository.getDashboardContext(scope)).toEqual(await reference.getDashboardContext(scope));
    expect(await repository.getDashboardLifecycle(scope, fixture.asOf)).toEqual(await reference.getDashboardLifecycle(scope, fixture.asOf));
    const summary = await repository.getDashboardActivity(scope, window);
    expect(summary).toEqual(await reference.getDashboardActivity(scope, window));
    const pending = await repository.listRequests(scope, { status: "pending", limit: 100 });
    const vendorWait = await repository.listWorkOrders(scope, { stage: "vendor-response", limit: 100 });
    expect(summary.pendingRequests).toBe(pending.items.length);
    expect(summary.awaitingVendor).toBe(vendorWait.items.length);
    for (const kind of ["work_status", "cost_category", "cost_store", "cost_month", "active_vendor", "observed_vendor"] satisfies DashboardBreakdownKind[]) {
      const expected = await reference.listDashboardBreakdown(scope, window, { kind, limit: 100 });
      const actual = await repository.listDashboardBreakdown(scope, window, { kind, limit: 100 });
      expect(actual, `${repository.kind}: ${kind}`).toEqual(expected);
      if (kind.startsWith("cost_")) expect(actual.totalValue).toBe(summary.recordedCostMinor);
      if (kind === "work_status") expect(actual.totalValue).toBe(summary.openWork);
    }
  }
  const scope = { organizationId };
  for (const search of ["104", "store", "a%_literal", "does-not-exist"]) {
    expect(await repository.listDashboardBreakdown(scope, window, { kind: "cost_store", search })).toEqual(await reference.listDashboardBreakdown(scope, window, { kind: "cost_store", search }));
  }
  const first = await repository.listDashboardBreakdown(scope, window, { kind: "cost_store", limit: 2 });
  const all: DashboardBreakdownRow[] = [...first.items];
  let cursor = first.nextCursor;
  let pages = 1;
  while (cursor) {
    if (++pages > 20) throw new Error("Dashboard pagination did not terminate");
    const next = await repository.listDashboardBreakdown(scope, window, { kind: "cost_store", limit: 2, cursor });
    expect(next.items.length).toBeLessThanOrEqual(2);
    expect(next.totalCount).toBe(first.totalCount);
    expect(next.totalValue).toBe(first.totalValue);
    all.push(...next.items);
    cursor = next.nextCursor;
  }
  expect(all).toEqual((await reference.listDashboardBreakdown(scope, window, { kind: "cost_store", limit: 100 })).items);
  expect(new Set(all.map(row => row.id)).size).toBe(first.totalCount);
  const pastEnd = await repository.listDashboardBreakdown(scope, window, { kind: "cost_store", offset: 10_000 });
  expect(pastEnd).toEqual({ items: [], totalCount: first.totalCount, totalValue: first.totalValue, nextCursor: undefined });
  await expect(repository.listDashboardBreakdown(scope, window, { kind: "cost_store", cursor: "not-a-page" })).rejects.toThrow("page link");
  await expect(repository.getDashboardActivity(scope, { ...window, costTo: "2026-12-31" })).rejects.toThrow("cost period");
  // A different cost window must not remove older still-open work or active visits.
  const narrow = await repository.getDashboardActivity(scope, { ...window, costFrom: window.costTo });
  const broad = await repository.getDashboardActivity(scope, window);
  expect(narrow.openWork).toBe(broad.openWork);
  expect(narrow.activeVisits).toBe(broad.activeVisits);
  expect(narrow.awaitingVendor).toBe(broad.awaitingVendor);
  expect(narrow).toEqual(await reference.getDashboardActivity(scope, { ...window, costFrom: window.costTo }));
  expect(await repository.getDashboardActivity(scope, { ...window, currency: "CAD" })).toEqual(await reference.getDashboardActivity(scope, { ...window, currency: "CAD" }));
}
