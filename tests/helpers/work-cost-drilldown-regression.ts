import { expect } from "vitest";
import type { OpsRepository } from "@/lib/ops/repository";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";

/** Shared expectations run against fixture, SQLite/D1 and PostgreSQL. */
export async function workCostDrilldownRegression(repository: OpsRepository) {
  const fixture = buildNorthlinePresentationFixture();
  const scope = { organizationId: NORTHLINE_ORGANIZATION_ID };
  const query = { costFrom: "2026-01-01", costTo: "2026-07-20", costMonth: "2026-07", hasCost: true };
  const july = fixture.costLines.filter((line) => line.serviceDate.slice(0, 7) === "2026-07" && line.serviceDate.slice(0, 10) <= query.costTo && line.amount.currency === "USD");
  const expected = new Map<string, number>();
  for (const line of july) expected.set(line.workOrderId, (expected.get(line.workOrderId) ?? 0) + line.amount.amountMinor);
  const result = await repository.listWorkOrders(scope, { ...query, limit: 100 });
  expect(new Set(result.items.map((row) => row.id))).toEqual(new Set(expected.keys()));
  for (const row of result.items) expect(row.recordedCostMinor).toBe(expected.get(row.id));
  expect((await repository.listWorkOrders(scope, { ...query, costFrom: "2026-08-01" })).items).toEqual([]);
  expect((await repository.listWorkOrders(scope, { ...query, costTo: "2026-06-30" })).items).toEqual([]);
  expect((await repository.listWorkOrders({ organizationId: "other-tenant" }, query)).items).toEqual([]);
  expect((await repository.listWorkOrders({ ...scope, storeIds: [] }, query)).items).toEqual([]);

  const storeId = "store-northline-104";
  const asset = fixture.assets.find((row) => row.storeId === storeId && row.groupPath.length > 0
    && fixture.workOrders.some((work) => work.assetId === row.id && fixture.costLines.some((line) => line.workOrderId === work.id)))!;
  const category = asset.categoryKey.replaceAll("_", " ");
  const categoryPath = asset.groupPath[0].toLowerCase() === category ? asset.groupPath : [category, ...asset.groupPath];
  const grouped = await repository.listWorkOrders({ ...scope, storeIds: [storeId] }, { hasCost: true, categoryPath, assetId: asset.id, limit: 100 });
  expect(grouped.items.length).toBeGreaterThan(0);
  expect(grouped.items.every((row) => row.storeId === storeId && fixture.workOrders.find((work) => work.id === row.id)?.assetId === asset.id)).toBe(true);
  expect((await repository.listWorkOrders(scope, { hasCost: true, categoryPath: [...categoryPath, "Nonexistent subgroup"] })).items).toEqual([]);

  const first = await repository.listWorkOrders(scope, { ...query, limit: 2 });
  const next = await repository.listWorkOrders(scope, { ...query, limit: 2, offset: 2 });
  expect(new Set([...first.items, ...next.items].map((row) => row.id)).size).toBe(4);
}
