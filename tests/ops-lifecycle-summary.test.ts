import { expect, it } from "vitest";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";
import { buildOpsSeedStatements } from "@/lib/ops/seed";
import { createOpsSqlRepository } from "@/lib/ops/sql-repository";
import { dashboardLifecycleFromFixture } from "@/lib/ops/lifecycle-summary";
import { calculateRepairReplacementScreening } from "@/lib/ops/lifecycle-analytics";
import type { OpsSqlDriver, SqlRow } from "@/lib/ops/sql-driver";

it("streams every asset through bounded native batches and finds a candidate beyond the first three pages", async () => {
  const fixture = buildNorthlinePresentationFixture();
  const baseAsset = fixture.assets.find(row => row.id === "asset-115-beer-cave")!;
  const baseWork = fixture.workOrders.find(row => row.id === "wo-northline-115")!;
  const baseTask = fixture.workflowTasks.find(row => row.workOrderId === baseWork.id && row.status === "open" && row.requiredForProgress)!;
  for (let index = 0; index < 225; index++) {
    const suffix = String(index).padStart(3, "0"), assetId = `z-density-${suffix}`, workId = `wo-density-${suffix}`;
    fixture.assets.push({ ...baseAsset, id: assetId, assetTag: `DENSITY-${suffix}`, installedAt: "2020-01-01T00:00:00.000Z", expectedLifeYears: 15, replacementProfileId: undefined, replacementEstimate: { amountMinor: 5_000_000, currency: "USD" } });
    fixture.workOrders.push({ ...baseWork, id: workId, number: `DENSITY-${suffix}`, assetId, componentId: undefined, requestId: undefined, status: "approved", repairEstimate: { amountMinor: index === 224 ? 30_000_000 : 2_500_000, currency: "USD" } });
    fixture.workflowTasks.push({ ...baseTask, id: `task-density-${suffix}`, workOrderId: workId, sourceFollowUpId: undefined, sourceApprovalRequestId: undefined });
  }
  fixture.assets.push({ ...baseAsset, id: "cad-density", assetTag: "CAD-DENSITY", replacementProfileId: undefined, replacementEstimate: { amountMinor: 123456, currency: "CAD" } });
  const sourceCost = fixture.costLines[0];
  for (const currency of ["CAD", "USD"]) fixture.costLines.push({ ...sourceCost, id: `density-cost-${currency}`, workOrderId: "wo-density-224", serviceDate: "2026-08-01", amount: { amountMinor: 12345, currency } });
  fixture.costLines.push({ ...sourceCost, id: "density-future-cost", workOrderId: "wo-density-224", serviceDate: "2026-08-26", amount: { amountMinor: 999999, currency: "USD" } });
  const db = new DatabaseSync(":memory:");
  const resultSizes: number[] = [];
  const sql: string[] = [];
  const driver: OpsSqlDriver = { dialect: "sqlite", async query<Row extends SqlRow>(statement: { sql: string; params: readonly unknown[] }) {
    // SQLite permits more variables than hosted D1; enforce the production limit here.
    if (statement.params.length > 100) throw new Error(`D1 query exceeds 100 bound parameters: ${statement.params.length}`);
    const rows = db.prepare(statement.sql).all(...statement.params.map(value => typeof value === "boolean" ? Number(value) : value ?? null) as SQLInputValue[]) as Row[];
    resultSizes.push(rows.length); sql.push(statement.sql); return { rows, affectedRows: 0 };
  }, async atomic() { throw new Error("Read-only test"); } };
  try {
    db.exec("PRAGMA foreign_keys=ON");
    for (const file of readdirSync("drizzle").filter(file => /^\d.*\.sql$/.test(file)).sort()) db.exec(readFileSync(`drizzle/${file}`, "utf8"));
    for (const statement of buildOpsSeedStatements(fixture)) db.prepare(statement.sql).run(...statement.params.map(value => typeof value === "boolean" ? Number(value) : value ?? null) as SQLInputValue[]);
    const repository = createOpsSqlRepository(driver, "d1");
    const scope = { organizationId: baseAsset.organizationId };
    const result = await repository.getDashboardLifecycle(scope, fixture.asOf);
    expect(result).toEqual(dashboardLifecycleFromFixture(fixture, scope, fixture.asOf));
    expect(result.spotlight?.assetId).toBe("z-density-224");
    expect(result.spotlight?.recordedCosts).toEqual([{ currency: "CAD", amountMinor: 12345 }, { currency: "USD", amountMinor: 12345 }]);
    expect(result.replacementEstimates.find(row => row.currency === "CAD")).toEqual({ currency: "CAD", amountMinor: 123456 });
    expect(result.repairComparisonCount).toBeGreaterThanOrEqual(225);
    expect(resultSizes.every(count => count <= 100)).toBe(true);
    expect(sql.filter(query => query.startsWith("SELECT a.* FROM ops_assets"))).toHaveLength(4);
    expect(sql).toHaveLength(30); // Six batched reads per page, then six single-candidate evidence reads.
    expect((await repository.getDashboardLifecycle({ organizationId: "foreign-tenant", storeIds: [baseAsset.storeId] }, fixture.asOf)).spotlight).toBeUndefined();
  } finally { db.close(); }
});

it("keeps currencies separate, rejects mixed-currency comparisons, and preserves pinned approval evidence", () => {
  const fixture = buildNorthlinePresentationFixture();
  const scope = { organizationId: fixture.organizations[0].id };
  const baseline = dashboardLifecycleFromFixture(fixture, scope, fixture.asOf);
  expect(baseline.spotlight?.replacement).toEqual({ amountMinor: 3_280_000, currency: "USD" });
  expect(baseline.spotlight?.replacementBasis).toBe("Approved replacement");
  expect(baseline.spotlight?.stateLabel).toBe("Replacement approved");
  const asset = fixture.assets.find(row => row.id === baseline.spotlight?.assetId)!;
  const price = fixture.estimateProposals.find(row => row.workOrderId === baseline.spotlight?.workId)!;
  fixture.estimateProposals.push({ ...price, id: "new-price-after-approval", revision: 999, amount: { amountMinor: 8_800_000, currency: "USD" }, submittedAt: fixture.asOf });
  expect(dashboardLifecycleFromFixture(fixture, scope, fixture.asOf).spotlight?.replacement).toEqual(baseline.spotlight?.replacement);
  fixture.assets.push({ ...asset, id: "cad-asset", assetTag: "CAD", replacementProfileId: undefined, replacementEstimate: { amountMinor: 123456, currency: "CAD" } });
  const mixed = dashboardLifecycleFromFixture(fixture, scope, fixture.asOf);
  expect(mixed.replacementEstimates.find(row => row.currency === "CAD")).toEqual({ currency: "CAD", amountMinor: 123456 });
  expect(mixed.replacementEstimates.find(row => row.currency === "USD")).toEqual(baseline.replacementEstimates.find(row => row.currency === "USD"));
  const screening = calculateRepairReplacementScreening({ ...asset, replacementEstimate: { amountMinor: 3_000_000, currency: "CAD" } }, { repairEstimateMinor: 2_000_000, repairEstimateCurrency: "USD", estimatedServiceExtensionMonths: 12 }, { asOf: fixture.asOf });
  expect(screening.state).toBe("incomplete"); expect(screening.dataGaps).toContain("currency_mismatch");
});
