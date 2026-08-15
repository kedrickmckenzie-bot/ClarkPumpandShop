import { describe, expect, it } from "vitest";
import type { OpsCommandServices } from "@/lib/ops/commands";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import { applyStoreEquipmentTemplates } from "@/lib/ops/setup-commands";
import { createEquipmentTemplate } from "@/lib/ops/taxonomy-commands";

const actor = { organizationId: NORTHLINE_ORGANIZATION_ID, actorType: "user" as const, actorId: "membership-northline-facilities", actorName: "Jordan Lee" };

function harness() { const repository = createOpsFixtureRepository(buildNorthlinePresentationFixture()); let sequence = 0; const services: OpsCommandServices = { repository, clock: { now: () => "2026-08-15T12:00:00.000Z" }, ids: { next: (prefix) => `${prefix}-template-test-${++sequence}` } }; return { repository, services }; }

describe("company equipment templates", () => {
  it("creates an equipment type and its reusable nested component blueprint in one audited command", async () => {
    const { repository, services } = harness();
    const result = await createEquipmentTemplate(services, { organizationId: NORTHLINE_ORGANIZATION_ID, taxonomyNodeId: "taxonomy-northline-reach_in_refrigeration", name: "Three-door reach-in cooler", defaultExpectedLifeYears: 10, components: ["Condensing unit", "Condensing unit > Compressor", "Condensing unit > Fan motor", "Evaporator", "Controller", "Shelving"], actor });
    const snapshot = repository.snapshot();

    expect(result.components).toHaveLength(6);
    expect(result.components.find((row) => row.name === "Compressor")?.parentComponentTemplateId).toBe(result.components.find((row) => row.name === "Condensing unit")?.id);
    expect(snapshot.equipmentTemplates).toContainEqual(expect.objectContaining({ id: result.template.id, name: "Three-door reach-in cooler" }));
    expect(snapshot.auditEvents).toContainEqual(expect.objectContaining({ aggregateId: result.template.id, eventType: "equipment_template.created" }));
  });

  it("lets store setup select one equipment type and automatically creates its component tree", async () => {
    const { repository, services } = harness();
    const assets = await applyStoreEquipmentTemplates(services, { organizationId: NORTHLINE_ORGANIZATION_ID, storeId: "store-northline-101", selections: [{ templateId: "equipment-template-beer-cave", quantity: 1 }], actor });
    const snapshot = repository.snapshot();
    const components = snapshot.components.filter((row) => row.assetId === assets[0].id);

    expect(assets).toHaveLength(1);
    expect(assets[0]).toMatchObject({ storeId: "store-northline-101", taxonomyNodeId: "taxonomy-northline-beer_caves", name: "Standard beer cave / walk-in cooler", expectedLifeYears: 12 });
    expect(components).toHaveLength(7);
    expect(components.find((row) => row.name === "Compressor")?.parentComponentId).toBe(components.find((row) => row.name === "Condensing unit")?.id);
    expect(snapshot.auditEvents).toContainEqual(expect.objectContaining({ aggregateId: "store-northline-101", eventType: "store.equipment_templates_applied" }));
  });
});
