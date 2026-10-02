import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { OperatorSession } from "@/components/ops/data-contract";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import { buildOpsSeedStatements } from "@/lib/ops/seed";
import { createOpsSqlRepository } from "@/lib/ops/sql-repository";
import type { OpsSqlDriver, SqlRow } from "@/lib/ops/sql-driver";
import { providerDetail, providerKindLabel, providerName, providerTag } from "@/lib/product/provider-label";

vi.mock("server-only", () => ({}));

const fixture = buildNorthlinePresentationFixture();
const executive: OperatorSession = { role: "executive", userId: "user-northline-executive", membershipId: "membership-northline-executive", displayName: "Alex Morgan", email: "a@example.test", organizationId: NORTHLINE_ORGANIZATION_ID, organizationName: "Clark", scopeLabel: "All stores", permissions: ["ops:*"] };
const params = (href: string) => Object.fromEntries(new URL(href, "https://example.test").searchParams);
const latestAssignment = (workOrderId: string) => fixture.assignments.filter((row) => row.workOrderId === workOrderId).at(-1);
const personFor = (membershipId?: string) => fixture.users.find((user) => user.id === fixture.memberships.find((member) => member.id === membershipId)?.userId)!.displayName;

describe("internal vs outside-vendor work is always distinguishable", () => {
  it("labels providers with one vocabulary", () => {
    expect(providerName({ kind: "internal", internalName: "Mike Ruiz" })).toBe("Mike Ruiz");
    expect(providerName({ kind: "internal" })).toBe("Internal team");
    expect(providerName({ kind: "outside_vendor", vendorName: "ColdLine" })).toBe("ColdLine");
    expect(providerName({ kind: "choose_later" })).toBe("Choose later");
    expect([providerKindLabel("internal"), providerKindLabel("outside_vendor")]).toEqual(["Internal", "Outside vendor"]);
    expect(providerDetail("internal", "Assigned")).toBe("Internal · Assigned");
    expect(providerTag("choose_later")).toBeUndefined();
  });

  it("names the technician and tags internal vs outside vendor on the work list", async () => {
    const { buildQueryListModel } = await import("@/app/app/_data/operator-query-presenter");
    const repository = createOpsFixtureRepository(fixture);
    const rows: Array<{ id: string; cells: Array<{ key: string; value: string; secondary?: string; providerTag?: string }> }> = [];
    let next: Record<string, string> | undefined = { status: "all" };
    while (next) { const page = await buildQueryListModel(repository, executive, "work-orders", next); rows.push(...page.table.rows); next = page.pagination?.nextHref ? params(page.pagination.nextHref) : undefined; }
    let internal = 0, outside = 0;
    for (const row of rows) {
      const assignment = latestAssignment(row.id), cell = row.cells.find((item) => item.key === "assignment")!;
      if (assignment?.kind === "internal") {
        internal += 1;
        expect(cell).toMatchObject({ value: personFor(assignment.internalMembershipId), secondary: "Internal", providerTag: "internal" });
      } else if (assignment?.kind === "outside_vendor") {
        outside += 1;
        expect(cell).toMatchObject({ value: fixture.vendors.find((vendor) => vendor.id === assignment.vendorId)!.name, secondary: "Outside vendor", providerTag: "outside_vendor" });
      } else expect(cell.providerTag).toBeUndefined();
      expect(cell.value).not.toBe("Internal maintenance");
    }
    expect(internal).toBeGreaterThan(0);
    expect(outside).toBeGreaterThan(0);
  });

  it("finds work by the technician's name, and the database matches the demo data", async () => {
    const organizationId = fixture.organizations[0].id;
    const db = new DatabaseSync(":memory:");
    const driver: OpsSqlDriver = { dialect: "sqlite", async query<Row extends SqlRow>(s: { sql: string; params: readonly unknown[] }) { return { rows: db.prepare(s.sql).all(...s.params as SQLInputValue[]) as Row[], affectedRows: 0 }; }, async atomic() { throw new Error("Read cannot mutate"); } };
    try {
      for (const file of readdirSync("drizzle").filter(f => /^\d.*\.sql$/.test(f)).sort()) db.exec(readFileSync(`drizzle/${file}`, "utf8"));
      for (const s of buildOpsSeedStatements(fixture)) db.prepare(s.sql).run(...s.params.map(v => typeof v === "boolean" ? Number(v) : v ?? null) as SQLInputValue[]);
      const scope = { organizationId }, query = { limit: 300 };
      const shape = (rows: Array<{ id: string; internalAssigneeName?: string }>) => rows.map((row) => [row.id, row.internalAssigneeName ?? null]);
      const demo = (await createOpsFixtureRepository(fixture).listWorkOrders(scope, query)).items;
      expect(shape((await createOpsSqlRepository(driver, "d1").listWorkOrders(scope, query)).items)).toEqual(shape(demo));
      const name = personFor("membership-northline-tech-1");
      const byName = (await createOpsFixtureRepository(fixture).listWorkOrders(scope, { search: name, limit: 300 })).items;
      expect(byName.length).toBeGreaterThan(0);
      expect(byName.every((row) => row.internalAssigneeName === name || `${row.problem} ${row.vendorName ?? ""} ${row.storeName}`.toLowerCase().includes(name.toLowerCase()))).toBe(true);
      expect(ids((await createOpsSqlRepository(driver, "d1").listWorkOrders(scope, { search: name, limit: 300 })).items)).toEqual(ids(byName));
      for (const membershipId of ["membership-northline-tech-1", "membership-northline-tech-2"]) {
        const demoMine = (await createOpsFixtureRepository(fixture).listWorkOrders(scope, { internalMembershipId: membershipId, limit: 300 })).items;
        expect(demoMine.length).toBeGreaterThan(0);
        expect(ids((await createOpsSqlRepository(driver, "d1").listWorkOrders(scope, { internalMembershipId: membershipId, limit: 300 })).items)).toEqual(ids(demoMine));
      }
    } finally { db.close(); }
    function ids(rows: Array<{ id: string }>) { return rows.map((row) => row.id); }
  });

  it("gives the internal team its own row in Trends by vendor instead of 'Vendor not attributed'", async () => {
    const { buildTrendsModel } = await import("@/app/app/_data/trends-presenter");
    const model = buildTrendsModel(fixture, executive, { metric: "recorded_cost", period: "12", compare: "previous_period", breakdown: "vendor" });
    const internal = model.drivers.rows.find((row) => row.label === "Internal team");
    expect(internal).toBeDefined();
    expect(internal!.currentSourceCount + internal!.comparisonSourceCount).toBeGreaterThan(0);
    expect(internal!.focusLink).toBeUndefined();
    expect(params(internal!.recordsLink.href)).toMatchObject({ driverBreakdown: "vendor", driverValue: "__internal__" });
    const drilled = buildTrendsModel(fixture, executive, params(internal!.recordsLink.href));
    expect(drilled.investigation.evidence).toBeDefined();
  });
});
