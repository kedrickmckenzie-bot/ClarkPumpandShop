import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { expect, it } from "vitest";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";
import { buildOpsSeedStatements } from "@/lib/ops/seed";
import { createOpsSqlRepository } from "@/lib/ops/sql-repository";
import type { OpsSqlDriver, SqlRow } from "@/lib/ops/sql-driver";
import { createMaintenanceProgramAndEnrollEquipment, overridePmPlanCadence } from "@/lib/ops/setup-commands";

it("persists store coverage and versioned company edits through the SQL adapter", async () => {
  const db = new DatabaseSync(":memory:"); const fixture = buildNorthlinePresentationFixture();
  const params = (values: readonly unknown[]) => values.map(v => typeof v === "boolean" ? Number(v) : v ?? null) as SQLInputValue[];
  const driver: OpsSqlDriver = { dialect: "sqlite", async query<Row extends SqlRow>(s: { sql: string; params: readonly unknown[] }) { return { rows: db.prepare(s.sql).all(...params(s.params)) as Row[], affectedRows: 0 }; }, async atomic(statements) { db.exec("BEGIN"); try { for (const s of statements) db.prepare(s.sql).run(...params(s.params)); db.exec("COMMIT"); } catch (e) { db.exec("ROLLBACK"); throw e; } } };
  try {
    db.exec("PRAGMA foreign_keys=ON"); for (const f of readdirSync("drizzle").filter(f => /^\d.*\.sql$/.test(f)).sort()) db.exec(readFileSync(`drizzle/${f}`, "utf8"));
    await driver.atomic(buildOpsSeedStatements(fixture));
    const repository = createOpsSqlRepository(driver, "d1"), organizationId = fixture.organizations[0].id;
    const svc = { repository, clock: { now: () => fixture.asOf } };
    const actor = { organizationId, actorType: "user" as const, actorName: "Jordan Lee" };
    const input = { organizationId, actor, name: "HVAC SQL schedule", categoryKey: "hvac", applicableEquipmentTemplateIds: [], storeIds: [fixture.stores[0].id, fixture.stores[1].id], cadenceDays: 90, completionWindowDays: 7, firstDueAt: "2026-10-01T00:00:00.000Z" };
    const first = await createMaintenanceProgramAndEnrollEquipment(svc, input);
    await overridePmPlanCadence(svc, { organizationId, actor, planId: first.plans[0].id, cadenceDays: 90, completionWindowDays: 7, instructions: "Roof key at counter", reason: "Access note", coverage: { includedAssetIds: [], excludedAssetIds: [] } });
    const second = await createMaintenanceProgramAndEnrollEquipment(svc, { ...input, replacesProgramId: first.program.id, cadenceDays: 60 });
    const plan = await repository.getPmPlan(organizationId, first.plans[0].id);
    expect(plan).toMatchObject({ programId: second.program.id, cadenceDays: 60, accessRequirements: "Roof key at counter" });
    expect(await repository.listAssetsForStore("foreign", fixture.stores[0].id)).toEqual([]);
    const coverage = await repository.listPmSetup({ organizationId }, { kind: "targets", program: second.program.id, asOf: fixture.asOf });
    expect(coverage.totalCount).toBe(2); expect(coverage.summary.covered).toBe(2);
    expect((await repository.getPmOccurrence(organizationId, first.occurrences[0].id))?.programId).toBe(first.program.id);
  } finally { db.close(); }
});
