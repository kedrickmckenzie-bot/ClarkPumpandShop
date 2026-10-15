import { describe, expect, it } from "vitest";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildShowcaseFixture } from "@/lib/ops/showcase-fixture";
import { createWorkOrder } from "@/lib/ops/commands";
import { answerCallback, callbackCandidate, repairSummary, resolveCallback } from "@/lib/ops/work-callbacks";
import type { OpsRepository } from "@/lib/ops/repository";

const org = "org-northline-demo", now = "2026-10-13T15:00:00.000Z";
const manager = { organizationId: org, actorType: "user" as const, actorId: "membership-northline-facilities", actorName: "Jordan Lee" };

async function sqliteRepository() {
  const { DatabaseSync } = await import("node:sqlite"), { readdirSync, readFileSync } = await import("node:fs");
  const { createOpsSqlRepository } = await import("@/lib/ops/sql-repository");
  const { buildOpsSeedStatements } = await import("@/lib/ops/seed");
  const db = new DatabaseSync(":memory:");
  type Value = string | number | null;
  for (const f of readdirSync("drizzle").filter(f => /^\d.*\.sql$/.test(f)).sort()) db.exec(readFileSync(`drizzle/${f}`, "utf8"));
  for (const s of buildOpsSeedStatements(buildShowcaseFixture(now))) db.prepare(s.sql).run(...s.params.map(v => typeof v === "boolean" ? Number(v) : v ?? null) as Value[]);
  const repository = createOpsSqlRepository({ dialect: "sqlite", async query(s) { return { rows: db.prepare(s.sql).all(...s.params.map(v => typeof v === "boolean" ? Number(v) : v ?? null) as Value[]) as never[], affectedRows: 0 }; }, async atomic(statements) { db.exec("BEGIN"); try { for (const s of statements) db.prepare(s.sql).run(...s.params.map(v => typeof v === "boolean" ? Number(v) : v ?? null) as Value[]); db.exec("COMMIT"); } catch (error) { db.exec("ROLLBACK"); throw error; } } }, "d1");
  return { repository, close: () => db.close() };
}

describe("callbacks", () => {
  it("sends, links, closes out and lists callbacks the same way in every storage", async () => {
    const fixture = buildShowcaseFixture(now);
    const finished = fixture.workOrders.find(w => w.organizationId === org && w.assetId && w.closedAt && w.status === "closed" && !(fixture.workCallbacks ?? []).some(c => c.workOrderId === w.id || c.originalWorkOrderId === w.id))!;
    const open = fixture.workOrders.find(w => w.organizationId === org && w.storeId === finished.storeId && !w.closedAt && !w.resolvedAt && w.status !== "cancelled")!;
    const sql = await sqliteRepository();
    try {
      const results = [];
      for (const repository of [createOpsFixtureRepository(buildShowcaseFixture(now)), sql.repository] as OpsRepository[]) {
        const svc = { repository, clock: { now: () => now } };
        // "Call vendor back": a new job linked to the finished one, in the same save.
        const callback = await createWorkOrder(svc, { organizationId: org, storeId: finished.storeId, assetId: finished.assetId, problem: `Callback for ${finished.number}`, accountableParty: "Facilities", nextAction: "Send to vendor", actor: manager, callbackOfWorkOrderId: finished.id });
        await expect(createWorkOrder(svc, { organizationId: org, storeId: finished.storeId, problem: "Bad link", accountableParty: "Facilities", nextAction: "x", actor: manager, callbackOfWorkOrderId: open.id })).rejects.toThrow(/isn't finished/);
        const other = fixture.stores.find(s => s.organizationId === org && s.id !== finished.storeId)!;
        await expect(createWorkOrder(svc, { organizationId: org, storeId: other.id, problem: "Wrong store", accountableParty: "Facilities", nextAction: "x", actor: manager, callbackOfWorkOrderId: finished.id })).rejects.toThrow(/same store/);
        // Close out: new billable work needs a reason; then it drops out of "Callbacks only".
        await expect(resolveCallback(svc, { organizationId: org, workOrderId: callback.id, decision: "new_work", actor: manager })).rejects.toThrow(/why this is new/);
        const before = await repository.listWorkOrders({ organizationId: org }, { callbacksOnly: true, limit: 100 });
        await resolveCallback(svc, { organizationId: org, workOrderId: callback.id, decision: "new_work", reason: "Different part failed", actor: manager });
        const after = await repository.listWorkOrders({ organizationId: org }, { callbacksOnly: true, limit: 100 });
        await resolveCallback(svc, { organizationId: org, workOrderId: callback.id, decision: "no_charge", actor: manager });
        // "Is this a callback?" on a job someone created themselves: answered once, never asked again.
        const plain = await createWorkOrder(svc, { organizationId: org, storeId: finished.storeId, assetId: finished.assetId, problem: "Same unit acting up", accountableParty: "Facilities", nextAction: "Review", actor: manager });
        await answerCallback(svc, { organizationId: org, workOrderId: plain.id, originalWorkOrderId: finished.id, isCallback: false, actor: manager });
        await expect(answerCallback(svc, { organizationId: org, workOrderId: plain.id, originalWorkOrderId: finished.id, isCallback: true, actor: manager })).rejects.toThrow(/already been answered/);
        const links = await repository.listWorkCallbacks(org, [finished.id]);
        const summary = await repairSummary(repository, org, finished.id);
        results.push({
          ids: [before.items.some(w => w.id === callback.id), after.items.some(w => w.id === callback.id)],
          links: links.map(l => ({ status: l.status, source: l.source, reason: l.reason, resolvedByName: l.resolvedByName, own: l.workOrderId === callback.id })).sort((a, b) => Number(b.own) - Number(a.own)),
          summary: summary && { number: summary.number, completedAt: summary.completedAt, doneBy: summary.doneBy },
        });
      }
      expect(results[1]).toEqual(results[0]);
      expect(results[0].ids).toEqual([true, false]);
      expect(results[0].links).toEqual([{ status: "no_charge", source: "sent", reason: undefined, resolvedByName: "Jordan Lee", own: true }, expect.objectContaining({ status: "not_callback", source: "suggested", own: false })]);
    } finally { sql.close(); }
  }, 60_000);

  it("offers a recent repair on the same equipment as a possible callback, and the demo shows each close-out", async () => {
    const fixture = buildShowcaseFixture(now);
    const repository = createOpsFixtureRepository(fixture);
    expect((fixture.workCallbacks ?? []).map(c => c.status).sort()).toEqual(["no_charge", "open"]);
    const demo = fixture.workCallbacks!.find(c => c.status === "open")!;
    const work = (await repository.getWorkOrder(org, demo.workOrderId))!;
    // Already linked, so no prompt; a fresh job on that equipment would be offered the latest repair instead.
    expect(await callbackCandidate(repository, org, work, fixture.workCallbacks!)).toBeUndefined();
    expect(await callbackCandidate(repository, org, { ...work, id: "probe" }, [])).toMatchObject({ id: expect.any(String) });
  });
});
