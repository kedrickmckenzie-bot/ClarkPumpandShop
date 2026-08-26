import { describe, expect, it } from "vitest";
import type { OpsCommandServices } from "@/lib/ops/commands";
import {
  addAssetComponent,
  createAsset,
  createMaintenanceProgramAndEnrollEquipment,
  createPmPlanWithFirstOccurrence,
  overridePmPlanCadence,
} from "@/lib/ops/setup-commands";
import { createNorthlineFixtureRepository } from "@/lib/ops/fixture-repository";
import { NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";

const actor = {
  organizationId: NORTHLINE_ORGANIZATION_ID,
  actorType: "user" as const,
  actorId: "membership-northline-facilities",
  actorName: "Jordan Lee",
};

function commandServices(): OpsCommandServices {
  let sequence = 0;
  return {
    repository: createNorthlineFixtureRepository(),
    clock: { now: () => "2026-08-10T19:00:00.000Z" },
    ids: { next: (prefix) => `${prefix}-setup-${String(++sequence).padStart(3, "0")}` },
  };
}

describe("equipment setup commands", () => {
  it("creates a fully identified asset with lifecycle inputs, audit, and outbox in one write", async () => {
    const svc = commandServices();
    const asset = await createAsset(svc, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: "store-northline-101",
      categoryKey: "refrigeration",
      groupPath: ["Walk-in refrigeration", "Coolers", "Beer caves"],
      assetTag: "BEER-CAVE-NEW",
      name: "Replacement beer cave system",
      manufacturer: "Heatcraft",
      model: "BVC-420",
      serialNumber: "HC-2026-101",
      supplier: "Great Lakes Equipment",
      installedAt: "2026-07-01T00:00:00.000Z",
      expectedLifeYears: 15,
      warrantyEndsAt: "2031-07-01T00:00:00.000Z",
      replacementEstimateMinor: 4_250_000,
      currency: "USD",
      status: "operational",
      actor,
    });

    expect(await svc.repository.getAsset(NORTHLINE_ORGANIZATION_ID, asset.id)).toMatchObject({
      storeId: "store-northline-101",
      groupPath: ["Walk-in refrigeration", "Coolers", "Beer caves"],
      replacementEstimate: { amountMinor: 4_250_000, currency: "USD" },
    });
    const snapshot = (svc.repository as ReturnType<typeof createNorthlineFixtureRepository>).snapshot();
    expect(snapshot.auditEvents).toContainEqual(expect.objectContaining({ aggregateId: asset.id, eventType: "asset.created" }));
    expect(snapshot.outboxMessages).toContainEqual(expect.objectContaining({ aggregateId: asset.id, topic: "ops.asset.created" }));
    expect((await svc.repository.getStoreDetail({ organizationId: NORTHLINE_ORGANIZATION_ID }, asset.storeId))?.assets)
      .toContainEqual(expect.objectContaining({ id: asset.id, assetTag: "BEER-CAVE-NEW" }));

    await expect(createAsset(svc, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: asset.storeId,
      categoryKey: "refrigeration",
      assetTag: "beer-cave-new",
      name: "Duplicate tag",
      actor,
    })).rejects.toMatchObject({ code: "CONFLICT" });

    await expect(createAsset(svc, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: asset.storeId,
      categoryKey: "refrigeration",
      groupPath: ["Ad hoc store wording"],
      assetTag: "UNCONTROLLED-PATH",
      name: "Uncontrolled classification",
      actor,
    })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("adds nested components and rejects a parent from another asset", async () => {
    const svc = commandServices();
    const root = await addAssetComponent(svc, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      assetId: "asset-101-beer-cave",
      name: "Evaporator assembly",
      partNumber: "EVAP-101",
      installedAt: "2024-03-10T00:00:00.000Z",
      actor,
    });
    const child = await addAssetComponent(svc, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      assetId: "asset-101-beer-cave",
      parentComponentId: root.id,
      name: "Evaporator fan motor",
      partNumber: "FAN-22",
      serialNumber: "FAN-101-22",
      warrantyEndsAt: "2028-03-10T00:00:00.000Z",
      actor,
    });

    expect(await svc.repository.getComponent(NORTHLINE_ORGANIZATION_ID, child.id)).toMatchObject({
      assetId: "asset-101-beer-cave",
      parentComponentId: root.id,
      name: "Evaporator fan motor",
    });
    const snapshot = (svc.repository as ReturnType<typeof createNorthlineFixtureRepository>).snapshot();
    expect(snapshot.auditEvents).toContainEqual(expect.objectContaining({ aggregateId: child.id, eventType: "asset.component_added" }));

    await expect(addAssetComponent(svc, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      assetId: "asset-101-beer-cave",
      parentComponentId: "component-104-compressor",
      name: "Wrong parent child",
      actor,
    })).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("preventive-maintenance setup command", () => {
  it("creates one company schedule and enrolls every matching equipment record", async () => {
    const svc = commandServices();
    const created = await createMaintenanceProgramAndEnrollEquipment(svc, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      name: "Company beer cave monthly service",
      applicableEquipmentTemplateIds: ["equipment-template-beer-cave"],
      cadenceDays: 30,
      completionWindowDays: 4,
      firstDueAt: "2026-09-01T00:00:00.000Z",
      actor,
    });

    expect(created.program).toMatchObject({
      frequencyDays: 30,
      dueWindowDays: 4,
      scheduleAnchorAt: "2026-09-01T00:00:00.000Z",
      applicableAssetTypes: ["equipment-template-beer-cave"],
    });
    expect(created.plans).toHaveLength(15);
    expect(created.occurrences).toHaveLength(15);
    expect(created.plans.every((plan) => plan.programId === created.program.id && plan.assetId)).toBe(true);
    expect(created.occurrences.every((occurrence) => occurrence.status === "scheduled")).toBe(true);

    const snapshot = (svc.repository as ReturnType<typeof createNorthlineFixtureRepository>).snapshot();
    expect(snapshot.auditEvents).toContainEqual(expect.objectContaining({
      aggregateId: created.program.id,
      eventType: "pm.master_schedule_created",
    }));
  });

  it("records a store-specific cadence exception without rewriting the active occurrence", async () => {
    const svc = commandServices();
    const repository = svc.repository as ReturnType<typeof createNorthlineFixtureRepository>;
    const before = repository.snapshot();
    const plan = before.pmPlans.find((row) => row.storeId === "store-northline-101" && row.programId === "maintenance-program-quarterly-refrigeration-v1");
    expect(plan).toBeDefined();
    const occurrenceBefore = before.pmOccurrences.find((row) => row.planId === plan?.id);

    const updated = await overridePmPlanCadence(svc, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      planId: plan!.id,
      cadenceDays: 45,
      completionWindowDays: 5,
      reason: "Higher customer volume requires more frequent coil cleaning.",
      actor,
    });

    expect(updated).toMatchObject({
      cadenceDays: 45,
      completionWindowDays: 5,
      cadenceOverrideReason: "Higher customer volume requires more frequent coil cleaning.",
      cadenceOverriddenByMembershipId: actor.actorId,
    });
    const after = repository.snapshot();
    expect(after.pmOccurrences.find((row) => row.id === occurrenceBefore?.id)).toEqual(occurrenceBefore);
    expect(after.auditEvents).toContainEqual(expect.objectContaining({
      aggregateId: plan!.id,
      eventType: "pm.store_schedule_overridden",
    }));
  });

  it("creates the plan and its first occurrence with a transparent completion window", async () => {
    const svc = commandServices();
    const created = await createPmPlanWithFirstOccurrence(svc, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      name: "Monthly beer cave temperature and coil inspection",
      storeId: "store-northline-101",
      assetId: "asset-101-beer-cave",
      categoryKey: "refrigeration",
      cadenceDays: 30,
      completionWindowDays: 3,
      firstDueAt: "2026-08-12T00:00:00.000Z",
      actor,
    });

    expect(created.plan).toMatchObject({ active: true, cadenceDays: 30, completionWindowDays: 3 });
    expect(created.firstOccurrence).toMatchObject({
      planId: created.plan.id,
      storeId: "store-northline-101",
      assetId: "asset-101-beer-cave",
      status: "due",
      windowStartsAt: "2026-08-09T00:00:00.000Z",
      windowEndsAt: "2026-08-15T00:00:00.000Z",
    });
    const snapshot = (svc.repository as ReturnType<typeof createNorthlineFixtureRepository>).snapshot();
    expect(snapshot.pmPlans).toContainEqual(expect.objectContaining({ id: created.plan.id, active: true }));
    expect(snapshot.pmOccurrences).toContainEqual(expect.objectContaining({ id: created.firstOccurrence.id }));
    expect(snapshot.auditEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ aggregateId: created.plan.id, eventType: "pm.plan_created" }),
      expect.objectContaining({ aggregateId: created.firstOccurrence.id, eventType: "pm.occurrence_created" }),
    ]));
  });

  it("rejects equipment from another store and windows that overlap the full cadence", async () => {
    const svc = commandServices();
    await expect(createPmPlanWithFirstOccurrence(svc, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      name: "Invalid cross-store plan",
      storeId: "store-northline-101",
      assetId: "asset-104-beer-cave",
      cadenceDays: 90,
      completionWindowDays: 7,
      firstDueAt: "2026-09-01T00:00:00.000Z",
      actor,
    })).rejects.toMatchObject({ code: "VALIDATION" });

    await expect(createPmPlanWithFirstOccurrence(svc, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      name: "Invalid window",
      storeId: "store-northline-101",
      cadenceDays: 30,
      completionWindowDays: 30,
      firstDueAt: "2026-09-01T00:00:00.000Z",
      actor,
    })).rejects.toMatchObject({ code: "VALIDATION" });
  });
});
