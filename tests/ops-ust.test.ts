import { describe, expect, it } from "vitest";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildShowcaseFixture } from "@/lib/ops/showcase-fixture";
import { COMPLIANCE_TEMPLATES, complianceTemplate } from "@/lib/ops/compliance-templates";
import { createComplianceSchedulesForStores } from "@/lib/ops/compliance";
import { addUstOperator, operatorGaps, removeUstOperator, type UstOperator } from "@/lib/ops/ust";
import type { OpsRepository } from "@/lib/ops/repository";

const org = "org-northline-demo", now = "2026-10-13T15:00:00.000Z", today = now.slice(0, 10);
const manager = { organizationId: org, actorType: "user" as const, actorId: "membership-northline-facilities", actorName: "Jordan Lee" };

async function sqliteRepository() {
  const { DatabaseSync } = await import("node:sqlite"), { readdirSync, readFileSync } = await import("node:fs");
  const { createOpsSqlRepository } = await import("@/lib/ops/sql-repository");
  const { buildOpsSeedStatements } = await import("@/lib/ops/seed");
  const db = new DatabaseSync(":memory:");
  type Value = string | number | null;
  for (const f of readdirSync("drizzle").filter(f => /^\d.*\.sql$/.test(f)).sort()) db.exec(readFileSync(`drizzle/${f}`, "utf8"));
  for (const s of buildOpsSeedStatements(buildShowcaseFixture(now))) db.prepare(s.sql).run(...s.params.map(v => typeof v === "boolean" ? Number(v) : v ?? null) as Value[]);
  const repository = createOpsSqlRepository({ dialect: "sqlite", async query(s) { return { rows: db.prepare(s.sql).all(...s.params as Value[]) as never[], affectedRows: 0 }; }, async atomic(statements) { db.exec("BEGIN"); try { for (const s of statements) db.prepare(s.sql).run(...s.params as Value[]); db.exec("COMMIT"); } catch (error) { db.exec("ROLLBACK"); throw error; } } }, "d1");
  return { repository, close: () => db.close() };
}

describe("ready-made compliance schedules", () => {
  it("fit the schedule rules and save their program", async () => {
    for (const template of COMPLIANCE_TEMPLATES) {
      expect(template.name.length).toBeLessThanOrEqual(160);
      expect(template.instructions.length).toBeLessThanOrEqual(4000);
      expect(template.intervalCount).toBeLessThanOrEqual(365);
      expect(template.leadDays).toBeLessThanOrEqual(90);
    }
    const repository = createOpsFixtureRepository(buildShowcaseFixture(now));
    const template = complianceTemplate("ust-30-day-walkthrough")!;
    const [schedule] = await createComplianceSchedulesForStores({ repository, clock: { now: () => now } }, { organizationId: org, name: template.name, kind: template.kind, instructions: template.instructions, requirementSource: template.requirementSource, evidenceLabel: template.evidenceLabel, evidenceRequired: template.evidenceRequired, firstDueDate: "2026-11-12", intervalUnit: template.intervalUnit, intervalCount: template.intervalCount, leadDays: template.leadDays, escalationDays: 0, escalationTo: "Facilities coordinator", program: template.group }, ["store-northline-102"], { kind: "team" }, manager);
    expect((await repository.getComplianceSchedule(org, schedule.id))?.program).toBe("ust");
  });
});

describe("fuel tank operators and checks", () => {
  it("finds missing classes and expired or expiring training", () => {
    const base = { organizationId: org, recordedByName: "x", createdAt: now };
    const operators: UstOperator[] = [
      { ...base, id: "1", storeId: "s1", operatorClass: "A", name: "A", expiresOn: "2027-01-01" },
      { ...base, id: "2", storeId: "s1", operatorClass: "B", name: "B", expiresOn: "2026-10-01" },
      { ...base, id: "3", storeId: "s1", operatorClass: "C", name: "C", expiresOn: "2026-11-20" },
    ];
    const gaps = operatorGaps(operators, today);
    expect(gaps.missing("s1")).toEqual(["B"]);
    expect(gaps.missing("s2")).toEqual(["A", "B", "C"]);
    expect(gaps.expired.map(o => o.id)).toEqual(["2"]);
    expect(gaps.expiringSoon.map(o => o.id)).toEqual(["3"]);
  });

  it("adds and removes operators and filters tank checks the same way in the fixture and SQL", async () => {
    const sql = await sqliteRepository();
    try {
      const results = [];
      for (const repository of [createOpsFixtureRepository(buildShowcaseFixture(now)), sql.repository] as OpsRepository[]) {
        const svc = { repository, clock: { now: () => now } };
        const before = await repository.listUstOperators({ organizationId: org, storeIds: ["store-northline-109"] });
        expect(before.map(o => o.operatorClass)).toEqual(["A", "B"]);
        await addUstOperator(svc, { organizationId: org, storeId: "store-northline-109", operatorClass: "C", name: "Pat Rivera", trainedOn: "2026-10-01", actor: manager, key: "test-operator-0001" });
        await addUstOperator(svc, { organizationId: org, storeId: "store-northline-109", operatorClass: "C", name: "Pat Rivera", trainedOn: "2026-10-01", actor: manager, key: "test-operator-0001" });
        await expect(addUstOperator(svc, { organizationId: org, storeId: "store-northline-109", operatorClass: "D", name: "X", actor: manager, key: "test-operator-0002" })).rejects.toThrow(/Class A, B or C/);
        await removeUstOperator(svc, { organizationId: org, operatorId: "ust-demo-operator-109-b", actor: manager });
        const after = await repository.listUstOperators({ organizationId: org, storeIds: ["store-northline-109"] });
        const tanks = await repository.queryInspections({ organizationId: org }, { today, program: "ust", limit: 100 });
        const all = await repository.queryInspections({ organizationId: org }, { today, limit: 100 });
        expect(tanks.totalCount).toBeGreaterThan(0);
        expect(tanks.totalCount).toBeLessThan(all.totalCount);
        expect(tanks.items.every(i => i.id.startsWith("ust-demo-"))).toBe(true);
        results.push({ after: after.map(o => ({ id: o.id, operatorClass: o.operatorClass, name: o.name, trainedOn: o.trainedOn })), tanks: tanks.totalCount, summary: tanks.summary });
      }
      expect(results[1]).toEqual(results[0]);
      expect(results[0].after.map(o => `${o.operatorClass} ${o.name}`)).toEqual(["A Jordan Lee", "C Pat Rivera"]);
    } finally { sql.close(); }
  }, 60_000);
});

describe("quick yes/no checks", () => {
  it("needs every answer, puts them in the note and treats any No as issues found", async () => {
    const { checklistAnswers, parseChecklist, checklistJson } = await import("@/lib/ops/compliance-checklist");
    const items = parseChecklist(checklistJson(complianceTemplate("ust-30-day-walkthrough")!.checklist));
    expect(items).toHaveLength(3);
    const form = new FormData();
    form.set("check-0", "yes"); form.set("check-1", "yes");
    expect(() => checklistAnswers(items, form, "")).toThrow(/every check/);
    form.set("check-2", "no");
    const result = checklistAnswers(items, form, "Monitor shows a sump alarm");
    expect(result.anyNo).toBe(true);
    expect(result.note.split("\n")).toEqual([`Yes · ${items[0]}`, `Yes · ${items[1]}`, `No · ${items[2]}`, "Monitor shows a sump alarm"]);
    expect(checklistAnswers([], new FormData(), "plain note")).toEqual({ note: "plain note", anyNo: false });
    expect(complianceTemplate("ust-monthly-leak-detection")).toMatchObject({ evidenceRequired: 1, evidenceLabel: expect.stringMatching(/photo/i) });
  });
});
