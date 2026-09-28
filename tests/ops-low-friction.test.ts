import { configureMaintenanceResponsibilities } from "@/lib/ops/maintenance-policy-commands";
import { applyImport } from "@/lib/ops/import-apply";
import { importTemplate } from "@/lib/ops/import-preview";
import { recordManualAppointment, recordManualServiceDelay } from "@/lib/ops/manual-service-appointment";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import { buildOpsSeedStatements } from "@/lib/ops/seed";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { createOpsSqlRepository } from "@/lib/ops/sql-repository";
import { createWorkOrder, createFollowUp, updateWorkOrderControl, recordWorkOrderNote, type OpsCommandServices } from "@/lib/ops/commands";
import { persistedWorkOrderVersion } from "@/lib/ops/concurrency";
import { selectPrimaryWorkflowTask } from "@/lib/ops/workflow-task-commands";
import type { OpsSqlDriver, SqlRow } from "@/lib/ops/sql-driver";
import type { OpsRepository } from "@/lib/ops/repository";
import { workListNavigation } from "@/lib/ops/work-list-navigation";

vi.mock("server-only", () => ({}));
const actor = { organizationId: NORTHLINE_ORGANIZATION_ID, actorType: "user" as const, actorId: "membership-northline-facilities", actorName: "Jordan Lee" };
const fixture = buildNorthlinePresentationFixture();
const memory = createOpsFixtureRepository(fixture);
const db = new DatabaseSync(":memory:");
const params = (values: readonly unknown[]) => values.map(value => typeof value === "boolean" ? Number(value) : value ?? null) as SQLInputValue[];
const driver: OpsSqlDriver = {
  dialect: "sqlite",
  async query<Row extends SqlRow>(statement: { sql: string; params: readonly unknown[] }) { return { rows: db.prepare(statement.sql).all(...params(statement.params)) as Row[], affectedRows: 0 }; },
  async atomic(statements) { db.exec("BEGIN"); try { for (const statement of statements) db.prepare(statement.sql).run(...params(statement.params)); db.exec("COMMIT"); } catch (error) { db.exec("ROLLBACK"); throw error; } },
};
const sql = createOpsSqlRepository(driver, "d1");
beforeAll(() => {
  db.exec("PRAGMA foreign_keys=ON");
  for (const file of readdirSync("drizzle").filter(file => /^\d.*\.sql$/.test(file)).sort()) db.exec(readFileSync(`drizzle/${file}`, "utf8"));
  for (const statement of buildOpsSeedStatements(fixture)) db.prepare(statement.sql).run(...params(statement.params));
});
afterAll(() => db.close());
let sequence = 0;
function services(repository: OpsRepository): OpsCommandServices { return { repository, clock: { now: () => "2026-08-26T12:00:00.000Z" }, ids: { next: prefix => `${prefix}-simple-${++sequence}` } }; }
async function basic(repository: OpsRepository) {
  return createWorkOrder(services(repository), { organizationId: actor.organizationId, storeId: "store-northline-104", problem: "Back room door latch sticks", accountableParty: "Facilities coordinator", nextAction: "Call the store", actor });
}

for (const [name, repository] of [["fixture", memory], ["SQLite", sql]] as const) describe(`${name}: optional adoption`, () => {
  it("saves completion photos atomically and rejects foreign evidence", async () => {
    const work = await basic(repository);
    const file = { id: `photo-${++sequence}`, organizationId: actor.organizationId, storageKey: "completion-photo", sha256: "a".repeat(64), originalName: "fixed-latch.png", contentType: "image/png", byteLength: 20, status: "available" as const, createdAt: services(repository).clock!.now() };
    const input = { organizationId: actor.organizationId, workOrderId: work.id, expectedStatus: work.status, expectedVersion: persistedWorkOrderVersion(work), status: "closed" as const, manualCompletion: { source: "phone" as const, confirmedBy: "Casey", files: [{ ...file, organizationId: "other" }] }, note: "Store confirmed latch works", actor };
    await expect(updateWorkOrderControl(services(repository), input)).rejects.toMatchObject({ code: "VALIDATION" });
    expect((await repository.getWorkOrder(actor.organizationId, work.id))?.status).toBe(work.status);
    await updateWorkOrderControl(services(repository), { ...input, manualCompletion: { ...input.manualCompletion, files: [file] } });
    expect(await repository.listFilesForEntity(actor.organizationId, "work_order", work.id)).toEqual([file]);
    expect(await repository.listFilesForEntity("other", "work_order", work.id)).toEqual([]);
    expect((await repository.getWorkOrderDetail({ organizationId: actor.organizationId }, work.id))?.visits).toEqual([]);
  });
  it("creates, updates and closes basic work without equipment, vendor, visit or invoice", async () => {
    const work = await basic(repository);
    await updateWorkOrderControl(services(repository), { organizationId: actor.organizationId, workOrderId: work.id, expectedStatus: work.status, expectedVersion: persistedWorkOrderVersion(work), status: work.status, nextAction: "Call Casey after lunch", dueAt: "2026-08-27T17:00:00.000Z", note: "Phone update: Casey will check the latch", actor });
    const current = (await repository.getWorkOrder(actor.organizationId, work.id))!;
    expect(selectPrimaryWorkflowTask(await repository.listWorkflowTasksForWorkOrder(actor.organizationId, work.id))).toMatchObject({ title: current.nextAction, dueAt: current.dueAt });
    await expect(updateWorkOrderControl(services(repository), { organizationId: actor.organizationId, workOrderId: work.id, expectedStatus: work.status, expectedVersion: persistedWorkOrderVersion(work), status: work.status, note: "Stale duplicate", actor })).rejects.toMatchObject({ code: "CONFLICT" });
    const closed = await updateWorkOrderControl(services(repository), { organizationId: actor.organizationId, workOrderId: work.id, expectedStatus: current.status, expectedVersion: persistedWorkOrderVersion(current), status: "closed", manualCompletion: { source: "phone", confirmedBy: "Casey, store manager" }, note: "Casey confirmed the latch now works", actor });
    expect(closed.status).toBe("closed");
    const detail = await repository.getWorkOrderDetail({ organizationId: actor.organizationId }, work.id);
    expect(detail?.visits).toEqual([]);
    expect(await repository.listWorkOrderVerifications(actor.organizationId, work.id)).toEqual([]);
    expect((await repository.listWorkflowTasksForWorkOrder(actor.organizationId, work.id)).every(task => !["open", "in_progress"].includes(task.status))).toBe(true);
  });
  it("records parts and unresolved updates with one accountable follow-up", async () => {
    const work = await basic(repository);
    const update = async (kind: "parts" | "unresolved", dueAt: string) => { const current = (await repository.getWorkOrder(actor.organizationId, work.id))!; await recordManualServiceDelay(services(repository), { organizationId: actor.organizationId, workOrderId: work.id, expectedVersion: persistedWorkOrderVersion(current), kind, dueAt, note: "Store called with a progress update", actor }); };
    await update("parts", "2026-08-28T12:00:00.000Z");
    expect((await repository.getWorkOrder(actor.organizationId, work.id))?.status).toBe("waiting_on_parts");
    await update("unresolved", "2026-08-29T12:00:00.000Z");
    const detail = await repository.getWorkOrderDetail({ organizationId: actor.organizationId }, work.id);
    expect(detail?.followUps.filter(f => f.status === "open")).toHaveLength(1);
    expect(detail?.followUps[0].dueAt).toBe("2026-08-29T12:00:00.000Z");
    expect(detail?.nextAction).toBe("Arrange return work for the unresolved problem");
  });
  it("imports canonical open work atomically and retries without duplicate work", async () => {
    const text = importTemplate("work") + "104,Inspect rear door,routine,Call store,,OLD-42\r\n";
    const input = { organizationId: actor.organizationId, entity: "work" as const, text, actor };
    const before = await repository.listWorkOrders({ organizationId: actor.organizationId }, { search: "Inspect rear door", limit: 100 });
    expect(await applyImport(services(repository), input)).toMatchObject({ imported: 1, replayed: false });
    expect(await applyImport(services(repository), input)).toMatchObject({ imported: 1, replayed: true });
    const after = await repository.listWorkOrders({ organizationId: actor.organizationId }, { search: "Inspect rear door", limit: 100 });
    expect(after.items.length).toBe(before.items.length + 1);
    const invalid = importTemplate("stores") + "901,Import test,1 Demo Rd,,Test,KY,40000,,\r\n902,,2 Demo Rd,,Test,KY,40000,,\r\n";
    await expect(applyImport(services(repository), { ...input, entity: "stores", text: invalid })).rejects.toMatchObject({ code: "VALIDATION" });
    expect((await repository.readImportReferences(actor.organizationId, ["901"], [], [])).stores).toHaveLength(0);
  });
  it("imports stores, vendors and equipment with components through the same commands", async () => {
    const base = { organizationId: actor.organizationId, actor };
    await applyImport(services(repository), { ...base, entity: "stores", text: importTemplate("stores") + "903,Imported store,3 Demo Rd,,Test,KY,40000,,\r\n" });
    await applyImport(services(repository), { ...base, entity: "vendors", text: importTemplate("vendors") + "new-service,Imported service,service@example.com,,plumbing,all\r\n" });
    const refs = await repository.readImportReferences(actor.organizationId, ["903"], ["new-service"], []);
    expect(refs.stores).toHaveLength(1); expect(refs.vendors).toHaveLength(1);
    const template = fixture.equipmentTemplates.find(t => t.active)!;
    await applyImport(services(repository), { ...base, entity: "equipment", text: importTemplate("equipment") + `903,${template.id},1,Back room unit,Rear wall\r\n` });
    const equipment = await repository.searchAssets({ organizationId: actor.organizationId, storeIds: [refs.stores[0].id] }, "");
    expect(equipment.items).toHaveLength(1); expect(equipment.items[0].name).toBe("Back room unit · Rear wall");
  });
  it("records and replaces manual appointments without inventing visit evidence", async () => {
    const work = await createWorkOrder(services(repository), { organizationId: actor.organizationId, storeId: "store-northline-104", problem: "Schedule a cooler inspection", initialAssignment: { kind: "outside_vendor", vendorId: fixture.vendors[0].id }, accountableParty: "Facilities coordinator", nextAction: "Confirm appointment", actor });
    const assigned = await repository.getActiveAssignment(actor.organizationId, work.id);
    expect(assigned).toBeTruthy();
    const save = async (startsAt: string) => { const current = (await repository.getWorkOrder(actor.organizationId, work.id))!; return recordManualAppointment(services(repository), { organizationId: actor.organizationId, workOrderId: work.id, expectedVersion: persistedWorkOrderVersion(current), startsAt, confirmedBy: "Dispatch", source: "phone", note: "Dispatch confirmed access with the store", actor }); };
    await save("2026-08-28T15:00:00.000Z");
    await save("2026-08-29T15:00:00.000Z");
    const current = (await repository.getWorkOrder(actor.organizationId, work.id))!;
    expect(current).toMatchObject({ status: "scheduled", dueAt: "2026-08-29T15:00:00.000Z" });
    const scheduled = (await repository.getWorkOrder(actor.organizationId, work.id))!;
    await recordManualServiceDelay(services(repository), { organizationId: actor.organizationId, workOrderId: work.id, expectedVersion: persistedWorkOrderVersion(scheduled), kind: "parts", dueAt: "2026-08-29T12:00:00.000Z", note: "Parts ordered; arrange return", actor });
    const waiting = (await repository.getWorkOrder(actor.organizationId, work.id))!;
    await recordManualAppointment(services(repository), { organizationId: actor.organizationId, workOrderId: work.id, expectedVersion: persistedWorkOrderVersion(waiting), startsAt: "2026-08-30T12:00:00.000Z", source: "phone", confirmedBy: "Vendor dispatcher", note: "Parts arrived; return booked", actor });
    expect(((await repository.getWorkOrderDetail({ organizationId: actor.organizationId }, work.id))!.followUps).filter(row => row.status === "open")).toHaveLength(0);
    const appointments = await repository.listServiceAppointmentsForWorkOrder(actor.organizationId, work.id);
    expect(appointments.filter(row => row.status === "confirmed")).toHaveLength(1);
    expect(appointments.filter(row => row.status === "cancelled")).toHaveLength(2);
    expect((await repository.getWorkOrderDetail({ organizationId: actor.organizationId }, work.id))?.visits).toEqual([]);
    expect((await repository.listWorkOrders({ organizationId: actor.organizationId }, { search: work.number })).items[0].updatedAt).toBe("2026-08-26T12:00:00.000Z");
  });
  it("records notes without altering accountability and rejects stale notes", async () => {
    const work = await basic(repository);
    const input = { organizationId: actor.organizationId, workOrderId: work.id, expectedVersion: persistedWorkOrderVersion(work), note: "Email update: store says latch still sticks", actor };
    await recordWorkOrderNote(services(repository), input);
    const current = (await repository.getWorkOrder(actor.organizationId, work.id))!;
    expect(current).toMatchObject({ status: work.status, accountableParty: work.accountableParty, nextAction: work.nextAction, dueAt: work.dueAt });
    expect(persistedWorkOrderVersion(current)).toBe(persistedWorkOrderVersion(work) + 1);
    await expect(recordWorkOrderNote(services(repository), input)).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("reconciles missing-cost filters against the same full scoped cohort", async () => {
    const scope = { organizationId: actor.organizationId, storeIds: ["store-northline-104"] };
    const query = { currency: "USD" as const, limit: 100 };
    const all = await repository.listWorkOrders(scope, query);
    const withCost = await repository.listWorkOrders(scope, { ...query, hasCost: true });
    const withoutCost = await repository.listWorkOrders(scope, { ...query, hasCost: false });
    expect(withCost.items.length + withoutCost.items.length).toBe(all.items.length);
    expect(withCost.items.every(row => row.recordedCostLineCount! > 0)).toBe(true);
    expect(withoutCost.items.every(row => row.recordedCostLineCount === 0)).toBe(true);
    expect(withoutCost.items.length).toBeGreaterThan(0);
  });
  it("keeps unresolved follow-ups and observed visit verification gates", async () => {
    const work = await basic(repository);
    await createFollowUp(services(repository), { organizationId: actor.organizationId, workOrderId: work.id, accountableParty: "Facilities coordinator", nextAction: "Confirm parts delivery", dueAt: "2026-08-28T17:00:00.000Z", escalationTo: "Facilities director", actor });
    for (const id of [work.id, "wo-northline-112"]) {
      const current = (await repository.getWorkOrder(actor.organizationId, id))!;
      await expect(updateWorkOrderControl(services(repository), { organizationId: actor.organizationId, workOrderId: id, expectedStatus: current.status, expectedVersion: persistedWorkOrderVersion(current), status: "closed", manualCompletion: { source: "phone", confirmedBy: "Casey" }, note: "Attempt premature closure", actor })).rejects.toMatchObject({ code: "CONFLICT" });
      expect((await repository.getWorkOrder(actor.organizationId, id))?.status).toBe(current.status);
    }
  });
  it("rejects manual closure by a store user and across organizations", async () => {
    const work = await basic(repository);
    const input = { organizationId: actor.organizationId, workOrderId: work.id, expectedStatus: work.status, expectedVersion: persistedWorkOrderVersion(work), status: "closed" as const, manualCompletion: { source: "email" as const, confirmedBy: "Casey" }, note: "Confirmed result", actor };
    await expect(updateWorkOrderControl(services(repository), { ...input, actor: { ...actor, actorId: "membership-northline-store-104" } })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(updateWorkOrderControl(services(repository), { ...input, organizationId: "other" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("allows explicit manager completion under company policy while retaining observed evidence", async () => {
    await configureMaintenanceResponsibilities({ repository, organizationId: actor.organizationId, role: "facilities_admin", enabledCapabilities: ["create_work_order", "issue_work_order", "confirm_observable_result"], allowManagerCompletion: true, autoCloseRoutineAfterVerification: false, appliesToActiveWork: true, actor, occurredAt: "2026-08-26T11:00:00.000Z" });
    expect((await repository.getActiveWorkflowPolicy(actor.organizationId))?.allowManagerCompletion).toBe(true);
    const work = (await repository.getWorkOrder(actor.organizationId, "wo-recent-aug-101-refrigeration"))!;
    const before = await repository.getWorkOrderDetail({ organizationId: actor.organizationId }, work.id);
    await updateWorkOrderControl(services(repository), { organizationId: actor.organizationId, workOrderId: work.id, expectedStatus: work.status, expectedVersion: persistedWorkOrderVersion(work), status: "closed", manualCompletion: { source: "phone", confirmedBy: "Casey, store manager", performedDate: "2026-08-25" }, note: "Casey confirmed cooling was restored", actor });
    const after = await repository.getWorkOrderDetail({ organizationId: actor.organizationId }, work.id);
    expect(after?.status).toBe("closed"); expect(after?.visits).toEqual(before?.visits);
    expect((await repository.listWorkOrderVerifications(actor.organizationId, work.id))).toHaveLength(0);
  });
  it("scopes due-work reads and distinguishes missing from zero cost", async () => {
    const scope = { organizationId: actor.organizationId, storeIds: ["store-northline-104"] };
    const rows = await repository.listWorkOrders(scope, { dueBefore: fixture.asOf, statuses: ["approved", "issued", "waiting_on_parts"], limit: 100, currency: "USD" });
    expect(rows.items.length).toBeGreaterThan(0);
    expect(rows.items.every(row => row.storeId === scope.storeIds[0] && row.dueAt! <= fixture.asOf)).toBe(true);
    expect(rows.items.some(row => row.recordedCostLineCount === 0)).toBe(true);
    expect((await repository.listWorkOrders({ organizationId: "other" }, { dueBefore: fixture.asOf })).items).toEqual([]);
  });
});

it("keeps store, period and search when switching everyday queues", () => {
  for (const view of workListNavigation({ store: "104", costFrom: "2026-01-01", q: "cooler", stage: "not-sent", page: "3" })) {
    const query = new URL(view.href, "https://example.test").searchParams;
    expect(query.get("store")).toBe("104"); expect(query.get("costFrom")).toBe("2026-01-01"); expect(query.get("q")).toBe("cooler"); expect(query.has("page")).toBe(false); expect(query.has("stage")).toBe(false);
  }
});
