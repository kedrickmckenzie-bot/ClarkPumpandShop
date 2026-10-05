import { expect, it } from "vitest";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildShowcaseFixture } from "@/lib/ops/showcase-fixture";
import { addEquipmentDocument, documentAppliesTo, equipmentKey, removeEquipmentDocument } from "@/lib/ops/equipment-documents";
import type { ActorContext, StoredFile } from "@/lib/ops/types";

const org = "org-northline-demo";
const actor = (membership: string, name = "Tester"): ActorContext => ({ organizationId: org, actorType: "user", actorId: membership, actorName: name });
const file = (id: string): StoredFile => ({ id, organizationId: org, storageKey: `test/${id}.pdf`, sha256: "f".repeat(64), originalName: `${id}.pdf`, contentType: "application/pdf", byteLength: 1200, status: "available", createdAt: "2026-10-05T12:00:00.000Z" });
const setup = () => {
  const fixture = buildShowcaseFixture("2026-10-05T12:00:00.000Z");
  let n = 0;
  return { fixture, repository: createOpsFixtureRepository(fixture), services: (r: ReturnType<typeof createOpsFixtureRepository>) => ({ repository: r, clock: { now: () => "2026-10-05T12:00:00.000Z" }, ids: { next: (p: string) => `${p}-${++n}` } }) };
};

it("matches model numbers loosely and keeps unit-only documents to their unit", () => {
  expect(equipmentKey(" M4FH-A050 ")).toBe("m4fha050");
  expect(equipmentKey("—")).toBeUndefined();
  const modelDoc = { id: "d", organizationId: org, fileId: "f", title: "Guide", docType: "manual" as const, manufacturerKey: "copeland", modelKey: "m4fha050", uploadedByName: "A", createdAt: "x" };
  expect(documentAppliesTo(modelDoc, { id: "a1", manufacturer: "Copeland", model: "M4FH A050" })).toBe(true);
  expect(documentAppliesTo(modelDoc, { id: "a2", manufacturer: "Other maker", model: "M4FH-A050" })).toBe(false);
  expect(documentAppliesTo({ ...modelDoc, removedAt: "y" }, { id: "a1", manufacturer: "Copeland", model: "M4FH-A050" })).toBe(false);
  const unitDoc = { ...modelDoc, manufacturerKey: undefined, modelKey: undefined, assetId: "a1" };
  expect(documentAppliesTo(unitDoc, { id: "a1" })).toBe(true);
  expect(documentAppliesTo(unitDoc, { id: "a2", manufacturer: "Copeland", model: "M4FH-A050" })).toBe(false);
});

it("shows the demo guides on every unit of a model and the install note on one unit", async () => {
  const { fixture, repository } = setup();
  const caves = fixture.assets.filter(a => a.model === "M4FH-A050");
  expect(caves.length).toBeGreaterThan(5);
  for (const cave of caves) expect((await repository.listEquipmentDocuments(org, cave)).map(d => d.title)).toContain("Beer cave troubleshooting guide (demo)");
  const store104 = fixture.assets.find(a => a.id === "asset-104-beer-cave")!;
  expect((await repository.listEquipmentDocuments(org, store104)).map(d => d.title)).toEqual(["Store 104 beer cave install notes (demo)"]);
  expect(await repository.listEquipmentDocuments("another-org", caves[0])).toEqual([]);
});

it("lets managers add and remove library documents but not technicians", async () => {
  const { fixture, repository, services } = setup();
  const rtu = fixture.assets.find(a => a.id === "asset-101-rtu-1")!;
  const others = fixture.assets.filter(a => a.model === rtu.model && a.id !== rtu.id);
  await expect(addEquipmentDocument({ organizationId: org, actor: actor("membership-northline-tech-1"), assetId: rtu.id, appliesTo: "model", title: "Tech upload", docType: "manual", file: file("tech") }, services(repository))).rejects.toThrow(/Only managers/);
  await expect(addEquipmentDocument({ organizationId: org, actor: actor("membership-northline-facilities"), assetId: rtu.id, appliesTo: "model", title: "  ", docType: "manual", file: file("blank") }, services(repository))).rejects.toThrow(/name/);
  await expect(addEquipmentDocument({ organizationId: org, actor: actor("membership-northline-facilities"), assetId: rtu.id, appliesTo: "model", title: "Bad", docType: "poster", file: file("bad") }, services(repository))).rejects.toThrow(/kind/);
  await expect(addEquipmentDocument({ organizationId: org, actor: actor("membership-northline-facilities"), assetId: rtu.id, appliesTo: "model", title: "Bad", docType: "manual", file: { ...file("exe"), contentType: "application/x-msdownload" } }, services(repository))).rejects.toThrow(/PDF/);
  const added = await addEquipmentDocument({ organizationId: org, actor: actor("membership-northline-field-manager", "Chris"), assetId: rtu.id, appliesTo: "model", title: "Economizer setup", docType: "spec_sheet", file: file("econ") }, services(repository));
  expect(added).toMatchObject({ modelKey: "precedentysc", manufacturerKey: "trane", uploadedByName: "Chris" });
  expect((await repository.listEquipmentDocuments(org, others[0])).map(d => d.title)).toContain("Economizer setup");
  expect(repository.snapshot().auditEvents.some(e => e.aggregateId === added.id && e.eventType === "equipment_document.added")).toBe(true);
  await expect(removeEquipmentDocument({ organizationId: org, actor: actor("membership-northline-tech-1"), assetId: rtu.id, documentId: added.id }, services(repository))).rejects.toThrow(/Only managers/);
  await removeEquipmentDocument({ organizationId: org, actor: actor("membership-northline-facilities"), assetId: rtu.id, documentId: added.id }, services(repository));
  expect((await repository.listEquipmentDocuments(org, others[0])).map(d => d.title)).not.toContain("Economizer setup");
  expect(await repository.getEquipmentDocument(org, added.id)).toMatchObject({ removedByName: "Tester" });
  const unit = await addEquipmentDocument({ organizationId: org, actor: actor("membership-northline-facilities"), assetId: rtu.id, appliesTo: "unit", title: "Panel photo", docType: "wiring_diagram", file: { ...file("photo"), contentType: "image/jpeg" } }, services(repository));
  expect((await repository.listEquipmentDocuments(org, rtu)).map(d => d.id)).toContain(unit.id);
  expect((await repository.listEquipmentDocuments(org, others[0])).map(d => d.id)).not.toContain(unit.id);
});

it("reads the same library through the SQL repository", async () => {
  const { DatabaseSync } = await import("node:sqlite"), { readdirSync, readFileSync } = await import("node:fs");
  const { createOpsSqlRepository } = await import("@/lib/ops/sql-repository");
  const { buildOpsSeedStatements } = await import("@/lib/ops/seed");
  const { fixture } = setup();
  const db = new DatabaseSync(":memory:");
  for (const f of readdirSync("drizzle").filter(f => /^\d.*\.sql$/.test(f)).sort()) db.exec(readFileSync(`drizzle/${f}`, "utf8"));
  type Value = string | number | null;
  for (const s of buildOpsSeedStatements(fixture)) db.prepare(s.sql).run(...s.params.map(v => typeof v === "boolean" ? Number(v) : v ?? null) as Value[]);
  const repository = createOpsSqlRepository({ dialect: "sqlite", async query(s) { return { rows: db.prepare(s.sql).all(...s.params as Value[]) as never[], affectedRows: 0 }; }, async atomic(statements) { for (const s of statements) db.prepare(s.sql).run(...s.params as Value[]); } }, "d1");
  const fixtureRepository = createOpsFixtureRepository(fixture);
  for (const asset of fixture.assets.filter(a => ["M4FH-A050", "Precedent YSC", "IYT0750A"].includes(a.model ?? "") || a.id === "asset-104-beer-cave").slice(0, 12))
    expect((await repository.listEquipmentDocuments(org, asset)).map(d => d.id)).toEqual((await fixtureRepository.listEquipmentDocuments(org, asset)).map(d => d.id));
  db.close();
}, 60_000);
