import { expect, it } from "vitest";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildShowcaseFixture } from "@/lib/ops/showcase-fixture";
import { saveAiConversation } from "@/lib/ops/ai-conversations";
import { notesForAi, openEquipmentNotes, saveEquipmentNote, writeEquipmentNote, type EquipmentNoteBody } from "@/lib/ops/equipment-notes";
import type { AiClient } from "@/lib/ops/ai";
import type { OpsRepository } from "@/lib/ops/repository";

const org = "org-northline-demo", now = "2026-10-05T12:00:00.000Z";
const tech = { organizationId: org, actorType: "user" as const, actorId: "membership-northline-tech-1", actorName: "Maria" };
const note: EquipmentNoteBody = { symptoms: "Box at 48F", readings: ["48F on arrival", "38F after 40 min"], tried: [{ action: "Control board replaced (earlier visit, reported)", result: "no_change", detail: "still warm" }, { action: "Cleaned condenser coil", result: "fixed", detail: "coil packed with dust" }], fixedBy: "Cleaning the coil", parts: [], stillOpen: "", other: "" };

async function seedNote(repository: OpsRepository, workOrderId: string, n: number) {
  let id = 0;
  const services = { repository, clock: { now: () => now }, ids: { next: (p: string) => `${p}-${n}-${++id}` } };
  const chat = await saveAiConversation(services, { organizationId: org, actor: tech, workOrderId, kind: "checkout", messages: [{ from: "tech", text: "Cleaned the coil" }] });
  return saveEquipmentNote(services, { organizationId: org, actor: tech, workOrderId, conversationId: chat.id, note, provider: "test", model: "m" });
}

it("writes a note about the equipment from the chat and trims what the AI returns", async () => {
  const calls: { system: string; prompt: string }[] = [];
  const ai: AiClient = { provider: "test", model: "m", async json(request) { calls.push(request); return request.schema.parse({ ...note, symptoms: `  ${"x".repeat(900)}  `, parts: [" ", "Gasket 30x76"], tried: [...note.tried, { action: "", result: "unknown", detail: "" }] }); } };
  const written = await writeEquipmentNote(ai, { problem: "Beer cave warm", store: "104 Elm", equipment: "Beer cave · Copeland", messages: [{ from: "tech", text: "cleaned the coil, 38 when I left" }] });
  expect(written.symptoms).toHaveLength(600);
  expect(written.parts).toEqual(["Gasket 30x76"]);
  expect(written.tried).toHaveLength(2);
  expect(calls[0].prompt).toContain("Technician: cleaned the coil, 38 when I left");
  for (const rule of ["never about people", "No names", "Never invent"]) expect(calls[0].system).toContain(rule);
});

it("lists notes by equipment through the job, the same in the fixture and SQL", async () => {
  const fixture = buildShowcaseFixture(now);
  const [first] = fixture.workOrders.filter(w => w.organizationId === org && w.assetId);
  const other = fixture.workOrders.find(w => w.organizationId === org && w.assetId && w.assetId !== first.assetId)!;
  const { DatabaseSync } = await import("node:sqlite"), { readdirSync, readFileSync } = await import("node:fs");
  const { createOpsSqlRepository } = await import("@/lib/ops/sql-repository");
  const { buildOpsSeedStatements } = await import("@/lib/ops/seed");
  const db = new DatabaseSync(":memory:");
  type Value = string | number | null;
  try {
    for (const f of readdirSync("drizzle").filter(f => /^\d.*\.sql$/.test(f)).sort()) db.exec(readFileSync(`drizzle/${f}`, "utf8"));
    for (const s of buildOpsSeedStatements(buildShowcaseFixture(now))) db.prepare(s.sql).run(...s.params.map(v => typeof v === "boolean" ? Number(v) : v ?? null) as Value[]);
    const sql = createOpsSqlRepository({ dialect: "sqlite", async query(s) { return { rows: db.prepare(s.sql).all(...s.params as Value[]) as never[], affectedRows: 0 }; }, async atomic(statements) { for (const s of statements) db.prepare(s.sql).run(...s.params as Value[]); } }, "d1");
    const repositories = [createOpsFixtureRepository(fixture), sql];
    for (const repository of repositories) { await seedNote(repository, first.id, 1); await seedNote(repository, other.id, 2); }
    const [fromFixture, fromSql] = await Promise.all(repositories.map(r => r.listEquipmentNotes(org, first.assetId!, 50)));
    expect(fromSql).toEqual(fromFixture);
    expect(fromFixture.map(n => n.workOrderId)).toContain(first.id);
    expect(fromFixture.map(n => n.workOrderId)).not.toContain(other.id);
    expect(fromFixture[0]).toMatchObject({ symptoms: "Box at 48F", tried: note.tried, provider: "test" });
    expect(await sql.listEquipmentNotes("another-org", first.assetId!, 50)).toEqual([]);
  } finally { db.close(); }
}, 60_000);

it("only a top admin can open the notes, and opening is recorded", async () => {
  const fixture = buildShowcaseFixture(now);
  const work = fixture.workOrders.find(w => w.organizationId === org && w.assetId)!;
  const repository = createOpsFixtureRepository(fixture);
  await seedNote(repository, work.id, 1);
  const services = { repository, clock: { now: () => now }, ids: { next: (p: string) => `${p}-open` } };
  for (const actorId of ["membership-northline-tech-1", "membership-northline-field-manager"])
    await expect(openEquipmentNotes(services, { organizationId: org, actor: { ...tech, actorId }, assetId: work.assetId! })).rejects.toThrow(/top admin/);
  expect(repository.snapshot().auditEvents.some(e => e.eventType === "equipment_notes.opened")).toBe(false);
  const opened = await openEquipmentNotes(services, { organizationId: org, actor: { ...tech, actorId: "membership-northline-facilities", actorName: "Admin" }, assetId: work.assetId! });
  expect(opened.notes).toHaveLength(1);
  expect(repository.snapshot().auditEvents.find(e => e.eventType === "equipment_notes.opened")).toMatchObject({ aggregateId: work.assetId, actorId: "membership-northline-facilities" });
});

it("gives the AI dated notes without names", () => {
  const text = notesForAi([{ ...note, id: "n", organizationId: org, workOrderId: "w", conversationId: "c", createdByName: "Maria", createdAt: now }]);
  expect(text).toContain("2026-10-05:");
  expect(text).toContain("Tried: Control board replaced (earlier visit, reported) → no change (still warm)");
  expect(text).toContain("Fixed by: Cleaning the coil");
  expect(text).not.toContain("Maria");
});

it("gives the troubleshooting AI this unit's history, notes and documents, with history as a clue not a rule", async () => {
  const { diagnoseTurn } = await import("@/lib/ops/ai-diagnose");
  const { AiUnavailableError } = await import("@/lib/ops/ai");
  const calls: { system: string; prompt: string }[] = [];
  const ai: AiClient = { provider: "test", model: "m", async json(request) { calls.push(request); return request.schema.parse({ reply: " Check the coil first. ", sources: [{ kind: "note", label: "2026-08-18" }, { kind: "note", label: "2026-08-18" }, { kind: "general", label: " " }] }); } };
  const context = { problem: "Box warm", store: "104 Elm", equipment: "Beer cave · Copeland · M4FH-A050", history: "2026-08-18: Box warm at 48°F · closed · in-house", notes: notesForAi([{ ...note, id: "n", organizationId: org, workOrderId: "w", conversationId: "c", createdByName: "Maria", createdAt: "2026-08-18T10:00:00.000Z" }]), documents: ["Beer cave troubleshooting guide (demo)"] };
  await expect(diagnoseTurn(ai, context, [{ from: "ai", text: "What's it doing?" }])).rejects.toBeInstanceOf(AiUnavailableError);
  expect(calls).toHaveLength(0);
  const turn = await diagnoseTurn(ai, context, [{ from: "tech", text: "47F and short cycling" }]);
  expect(turn).toEqual({ reply: "Check the coil first.", sources: [{ kind: "note", label: "2026-08-18" }] });
  for (const text of ["2026-08-18: Box warm at 48°F", "Fixed by: Cleaning the coil", "Beer cave troubleshooting guide (demo)", "Technician: 47F and short cycling"]) expect(calls[0].prompt).toContain(text);
  expect(calls[0].prompt).not.toContain("Maria");
  for (const rule of ["History is a clue, never a rule", "Never say something is \"ruled out\"", "Never mention or guess who did past work", "lockout/tagout", "cannot read inside the documents"]) expect(calls[0].system).toContain(rule);
});

it("lets the checkout chat see the earlier troubleshooting chat", async () => {
  const { checkoutChatTurn } = await import("@/lib/ops/ai-checkout");
  const calls: { prompt: string }[] = [];
  const ai: AiClient = { provider: "test", model: "m", async json(request) { calls.push(request); return request.schema.parse({ reply: "Is that right?", ready: true, outcome: "completed", notes: "Replaced fan motor.", workingWhenLeft: "yes" }); } };
  await checkoutChatTurn(ai, { mode: "job", problem: "Fan grinding", store: "104", messages: [{ from: "tech", text: "done" }], earlier: [{ from: "tech", text: "bearings shot on the evap fan" }] });
  expect(calls[0].prompt).toContain("Earlier troubleshooting chat");
  expect(calls[0].prompt).toContain("bearings shot on the evap fan");
});
