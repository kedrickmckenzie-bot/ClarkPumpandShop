import { describe, expect, it } from "vitest";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildShowcaseFixture } from "@/lib/ops/showcase-fixture";
import { leakClocks, leakRateBps, poundsToOz, refrigerantCoverage, yearlyLossBps, formatCharge, type RefrigerantEvent } from "@/lib/ops/refrigerant";
import { recordRefrigerantEvent, setAssetRefrigerant } from "@/lib/ops/refrigerant-commands";
import type { OpsRepository } from "@/lib/ops/repository";

const org = "org-northline-demo", now = "2026-10-13T15:00:00.000Z";
const manager = { organizationId: org, actorType: "user" as const, actorId: "membership-northline-facilities", actorName: "Jordan Lee" };

describe("refrigerant rules", () => {
  it("decides coverage from refrigerant, charge and use", () => {
    const walkIn = { refrigerant: "R-448A", fullChargeOz: 22 * 16, systemUse: "commercial_refrigeration" as const };
    expect(refrigerantCoverage(walkIn, "2026-03-01")).toMatchObject({ covered: true, rule: "aim", thresholdBps: 2000 });
    expect(refrigerantCoverage(walkIn, "2025-12-31").covered).toBe(false);
    expect(refrigerantCoverage({ ...walkIn, fullChargeOz: 14 * 16 }, "2026-03-01").covered).toBe(false);
    expect(refrigerantCoverage({ ...walkIn, refrigerant: "R-290" }, "2026-03-01").covered).toBe(false);
    expect(refrigerantCoverage({ ...walkIn, fullChargeOz: undefined }, "2026-03-01")).toEqual(expect.objectContaining({ missing: "charge" }));
    expect(refrigerantCoverage({ ...walkIn, fullChargeOz: undefined }, "2026-03-01").covered).toBeUndefined();
    expect(refrigerantCoverage({ refrigerant: "R-410A", fullChargeOz: 20 * 16, systemUse: "comfort_cooling" }, "2026-03-01")).toMatchObject({ covered: true, thresholdBps: 1000 });
    expect(refrigerantCoverage({ refrigerant: "R-410A", fullChargeOz: 20 * 16, systemUse: "light_commercial_ac" }, "2026-03-01").covered).toBe(false);
    expect(refrigerantCoverage({ refrigerant: "R-22", fullChargeOz: 40 * 16, systemUse: "comfort_cooling" }, "2026-03-01").covered).toBe(false);
    expect(refrigerantCoverage({ refrigerant: "R-22", fullChargeOz: 60 * 16, systemUse: "commercial_refrigeration" }, "2026-03-01")).toMatchObject({ covered: true, rule: "section608" });
  });

  it("annualizes the leak rate the EPA way", () => {
    expect(leakRateBps(5 * 16, 20 * 16)).toBe(2500); // 5 of 20 lb, no earlier add: 25%
    expect(leakRateBps(2 * 16, 20 * 16, 73)).toBe(5000); // 10% in 73 days is 50% a year
    expect(leakRateBps(2 * 16, 20 * 16, 900)).toBe(1000); // never more than a year back
    expect(poundsToOz("1.5")).toBe(24);
    expect(poundsToOz("")).toBeUndefined();
    expect(formatCharge(24)).toBe("1.5 lb");
    expect(formatCharge(12)).toBe("12 oz");
  });

  it("runs a 30-day repair clock and closes it after a passed follow-up check", () => {
    const base = { organizationId: org, assetId: "a", storeId: "s", refrigerant: "R-448A", technicianName: "T", source: "vendor" as const, recordedByName: "T", createdAt: now };
    const events: RefrigerantEvent[] = [
      { ...base, id: "1", kind: "service", occurredAt: "2026-09-01", addedOz: 96, leakStatus: "found_not_repaired", leakRateBps: 2727, thresholdBps: 2000 },
    ];
    expect(leakClocks(events, "2026-09-20")[0]).toMatchObject({ status: "repair_due", repairDueOn: "2026-10-01" });
    expect(leakClocks(events, "2026-10-02")[0].status).toBe("repair_overdue");
    events.push({ ...base, id: "2", kind: "service", occurredAt: "2026-09-25", addedOz: 0, leakStatus: "found_repaired" });
    expect(leakClocks(events, "2026-09-26")[0]).toMatchObject({ status: "check_due", checkDueOn: "2026-10-05" });
    events.push({ ...base, id: "3", kind: "verification", occurredAt: "2026-10-03", addedOz: 0, verificationStage: "follow_up", verificationResult: "passed" });
    expect(leakClocks(events, "2026-10-20")[0]).toMatchObject({ status: "closed", closedOn: "2026-10-03" });
    expect(yearlyLossBps(events, 2026, 22 * 16)).toBe(2727);
  });
});

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

async function story(repository: OpsRepository, assetId: string) {
  const svc = { repository, clock: { now: () => now } };
  const facts = await repository.getAssetRefrigerant(org, assetId);
  await setAssetRefrigerant(svc, { organizationId: org, assetId, refrigerant: "r-448a", fullChargeOz: 22 * 16, systemUse: "commercial_refrigeration", chargeSource: "installer", expectedVersion: facts?.version ?? 0, actor: manager });
  const first = { organizationId: org, assetId, kind: "service" as const, occurredOn: "2026-10-10", addedOz: 6 * 16, leakStatus: "found_not_repaired" as const, technicianName: "Sam Ortiz", technicianCert: "608-UNIV-1234", source: "office" as const, actor: manager };
  const saved = await recordRefrigerantEvent(svc, { ...first, eventId: "refrigerant-test-0001" });
  // The same submission again is not counted twice.
  await recordRefrigerantEvent(svc, { ...first, eventId: "refrigerant-test-0001" });
  return saved;
}

describe("refrigerant records", () => {
  it("saves facts as versions, records an over-limit leak once, and matches in the fixture and SQL", async () => {
    const sql = await sqliteRepository();
    try {
      const fixture = createOpsFixtureRepository(buildShowcaseFixture(now));
      const assetId = "asset-110-beer-cave";
      const results = [];
      for (const repository of [fixture, sql.repository]) {
        const event = await story(repository, assetId);
        expect(event).toMatchObject({ refrigerant: "R-448A", fullChargeOz: 352, rule: "aim", thresholdBps: 2000, leakRateBps: 2727 });
        const events = await repository.listRefrigerantEvents(org, [assetId]);
        expect(events.filter(e => e.id === "refrigerant-test-0001")).toHaveLength(1);
        await expect(setAssetRefrigerant({ repository }, { organizationId: org, assetId, refrigerant: "R-404A", systemUse: "commercial_refrigeration", expectedVersion: 0, actor: manager })).rejects.toThrow(/Refresh/);
        await expect(recordRefrigerantEvent({ repository, clock: { now: () => now } }, { organizationId: "another-org", assetId, eventId: "refrigerant-test-0002", kind: "service", occurredOn: "2026-10-10", addedOz: 0, leakStatus: "none_found", technicianName: "X", source: "office", actor: manager })).rejects.toThrow();
        const equipment = await repository.listRefrigerantEquipment({ organizationId: org, storeIds: ["store-northline-110"] });
        results.push({ events: events.filter(e => e.id.startsWith("refrigerant-test")), facts: await repository.getAssetRefrigerant(org, assetId), equipment });
      }
      expect(results[1]).toEqual(results[0]);
      expect(results[0].equipment.every(row => row.storeId === "store-northline-110")).toBe(true);
      expect(results[0].equipment.find(row => row.assetId === assetId)?.refrigerant?.refrigerant).toBe("R-448A");
      expect(leakClocks(results[0].events, "2026-10-13")[0]).toMatchObject({ status: "repair_due", repairDueOn: "2026-11-09" });
    } finally { sql.close(); }
  }, 60_000);
});

describe("refrigerant at vendor checkout", () => {
  it("saves the vendor's refrigerant answer with the checkout, with the leak math, and nothing when checkout fails", async () => {
    const { checkInVisit, checkOutVisit } = await import("@/lib/ops/commands");
    const { createNorthlineFixtureRepository } = await import("@/lib/ops/fixture-repository");
    const repository = createNorthlineFixtureRepository();
    let clock = "2026-08-20T14:00:00.000Z", sequence = 0;
    const services = { repository, clock: { now: () => clock }, ids: { next: (prefix: string) => `${prefix}-ref-${++sequence}` } };
    const tech = { organizationId: org, actorType: "technician" as const, actorId: "technician-ref", actorName: "Morgan Ellis" };
    const visit = await checkInVisit(services, { organizationId: org, storeId: "store-northline-104", workOrderIds: ["wo-northline-104-issued"], technicianName: "Morgan Ellis", technicianPhoneOrPin: "TECH-1", purpose: "Beer cave service", channel: "secure_link", location: { result: "verified", accuracyM: 10, distanceM: 12, capturedAt: clock }, actor: tech });
    clock = "2026-08-20T16:00:00.000Z";
    const checkout = (refrigerantRecord: { addedOz: number; leakStatus: "found_repaired" }) => checkOutVisit(services, { organizationId: org, visitId: visit.id, channel: "secure_link", perWorkOrderOutcomes: [{ workOrderId: "wo-northline-104-issued", outcome: "completed", refrigerantRecord }], location: { result: "verified", capturedAt: clock }, actor: tech });
    const before = repository.snapshot();
    await expect(checkout({ addedOz: -5, leakStatus: "found_repaired" })).rejects.toThrow();
    expect(repository.snapshot()).toEqual(before);
    await checkout({ addedOz: 32, leakStatus: "found_repaired" });
    const saved = (await repository.listRefrigerantEvents(org, ["asset-104-beer-cave"])).find((event) => event.visitId === visit.id);
    expect(saved).toMatchObject({ source: "vendor", technicianName: "Morgan Ellis", workOrderId: "wo-northline-104-issued", addedOz: 32, leakStatus: "found_repaired", occurredAt: "2026-08-20", thresholdBps: 2000 });
    // 2 lb of a 22 lb charge, 7 days after the last addition, is far over the 20% limit once annualized.
    expect(saved!.leakRateBps).toBeGreaterThan(2000);
    expect(repository.snapshot().auditEvents.some((event) => event.eventType === "asset.refrigerant_service_recorded" && event.aggregateId === "asset-104-beer-cave")).toBe(true);
  });
});
