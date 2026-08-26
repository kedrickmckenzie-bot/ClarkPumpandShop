import { describe, expect, it } from "vitest";
import type { OpsCommandServices } from "@/lib/ops/commands";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import { applyStoreEquipmentTemplates, nameStoreEquipment } from "@/lib/ops/setup-commands";
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
    expect(assets[0]).toMatchObject({ storeId: "store-northline-101", equipmentTemplateId: "equipment-template-beer-cave", taxonomyNodeId: "taxonomy-northline-beer_caves", name: "Standard beer cave / walk-in cooler", expectedLifeYears: 12 });
    expect(components).toHaveLength(7);
    expect(components.find((row) => row.name === "Compressor")?.parentComponentId).toBe(components.find((row) => row.name === "Condensing unit")?.id);
    expect(snapshot.auditEvents).toContainEqual(expect.objectContaining({ aggregateId: "store-northline-101", eventType: "store.equipment_templates_applied" }));
    expect(snapshot.pmPlans).toContainEqual(expect.objectContaining({
      assetId: assets[0].id,
      programId: "maintenance-program-quarterly-refrigeration-v1",
      storeId: "store-northline-101",
    }));
    expect(snapshot.pmOccurrences).toContainEqual(expect.objectContaining({
      assetId: assets[0].id,
      status: "scheduled",
    }));
  });

  it("finishes commissioning by naming repeated equipment in one audited atomic update", async () => {
    const { repository, services } = harness();
    const assets = await applyStoreEquipmentTemplates(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: "store-northline-101",
      selections: [{ templateId: "equipment-template-beer-cave", quantity: 2 }],
      actor,
    });

    const named = await nameStoreEquipment(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: "store-northline-101",
      equipment: [
        { assetId: assets[0].id, name: "Checkout wall" },
        { assetId: assets[1].id, name: "Deli grab-and-go" },
      ],
      actor,
    });
    const snapshot = repository.snapshot();

    expect(named.map((asset) => asset.name)).toEqual(["Checkout wall", "Deli grab-and-go"]);
    expect(snapshot.assets.find((asset) => asset.id === assets[0].id)?.assetTag).toBe(assets[0].assetTag);
    expect(snapshot.assets.find((asset) => asset.id === assets[0].id)?.name).toBe("Checkout wall");
    expect(snapshot.auditEvents.filter((event) => event.eventType === "asset.commissioning_name_set" && assets.some((asset) => asset.id === event.aggregateId))).toHaveLength(2);
  });

  it("rejects duplicate or cross-store names during commissioning", async () => {
    const { services } = harness();
    const assets = await applyStoreEquipmentTemplates(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: "store-northline-101",
      selections: [{ templateId: "equipment-template-beer-cave", quantity: 2 }],
      actor,
    });

    await expect(nameStoreEquipment(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: "store-northline-101",
      equipment: [
        { assetId: assets[0].id, name: "Front counter" },
        { assetId: assets[1].id, name: "front counter" },
      ],
      actor,
    })).rejects.toThrow("already used at this store");

    await expect(nameStoreEquipment(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: "store-northline-102",
      equipment: [{ assetId: assets[0].id, name: "Beer cave" }],
      actor,
    })).rejects.toThrow("outside this store or organization");
  });
});
