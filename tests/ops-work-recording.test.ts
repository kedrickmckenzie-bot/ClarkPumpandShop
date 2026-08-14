import { beforeAll, describe, expect, it, vi } from "vitest";
import type { OperatorRole, OperatorSession } from "@/components/ops/data-contract";
import type { OpsCommandServices } from "@/lib/ops/commands";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import {
  NORTHLINE_DEMO_HANDLES,
  NORTHLINE_ORGANIZATION_ID,
  buildNorthlinePresentationFixture,
} from "@/lib/ops/fixtures";
import type { OpsFixture } from "@/lib/ops/types";
import {
  recordWorkOrderCost,
  updateWorkOrderClassification,
} from "@/lib/ops/work-recording-commands";

vi.mock("server-only", () => ({}));

let buildDashboardModel: typeof import("@/app/app/_data/operator-presenter").buildDashboardModel;
let buildDetailModel: typeof import("@/app/app/_data/operator-presenter").buildDetailModel;
let buildWorkOrderRecordingModel: typeof import("@/app/app/_data/operator-presenter").buildWorkOrderRecordingModel;

beforeAll(async () => {
  ({ buildDashboardModel, buildDetailModel, buildWorkOrderRecordingModel } = await import("@/app/app/_data/operator-presenter"));
});

const facilitiesActor = {
  organizationId: NORTHLINE_ORGANIZATION_ID,
  actorType: "user" as const,
  actorId: "membership-northline-facilities",
  actorName: "Jordan Lee",
};

type FixtureRepository = ReturnType<typeof createOpsFixtureRepository>;

function commandHarness(options: {
  fixture?: OpsFixture;
  outboxIdCollision?: string;
  now?: string;
} = {}) {
  const repository = createOpsFixtureRepository(options.fixture ?? buildNorthlinePresentationFixture());
  let sequence = 0;
  let outboxIdCollision = options.outboxIdCollision;
  let now = options.now ?? "2026-08-10T18:30:00.000Z";
  const services: OpsCommandServices = {
    repository,
    clock: { now: () => now },
    ids: {
      next(prefix) {
        if (prefix === "outbox" && outboxIdCollision) {
          const collision = outboxIdCollision;
          outboxIdCollision = undefined;
          return collision;
        }
        sequence += 1;
        return `${prefix}-work-record-${String(sequence).padStart(4, "0")}`;
      },
    },
  };
  return {
    repository,
    services,
    setNow(value: string) {
      now = value;
    },
  };
}

function snapshot(repository: FixtureRepository) {
  return repository.snapshot();
}

function operatorSession(role: OperatorRole): OperatorSession {
  return {
    userId: `user-recording-${role}`,
    membershipId: `membership-recording-${role}`,
    displayName: `${role} recording user`,
    email: `${role}@northline-demo.example`,
    role,
    organizationId: NORTHLINE_ORGANIZATION_ID,
    organizationName: "Northline Fuel & Market",
    scopeLabel: role === "store_manager" ? "Store 104" : role === "regional" ? "North region" : "Northline companywide - 15 stores",
    regionIds: role === "regional" ? ["region-northline-north"] : undefined,
    storeIds: role === "store_manager" ? [NORTHLINE_DEMO_HANDLES.storyStoreId] : undefined,
  };
}

function usd(amountMinor: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amountMinor / 100);
}

describe("work-order progressive classification", () => {
  it("moves deferred work through category, equipment, and component depth, then supports category-only and clear classification", async () => {
    const fixture = buildNorthlinePresentationFixture();
    const work = fixture.workOrders.find((candidate) => candidate.id === NORTHLINE_DEMO_HANDLES.publicServiceWorkOrderId)!;
    work.categoryKey = undefined;
    work.taxonomyNodeId = undefined;
    work.assetId = undefined;
    work.componentId = undefined;
    const harness = commandHarness({ fixture });

    const deep = await updateWorkOrderClassification(harness.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: work.id,
      categoryKey: " refrigeration ",
      assetId: "asset-104-beer-cave",
      componentId: "component-104-evaporator-fan",
      note: "Diagnosis identified the beer-cave evaporator fan motor.",
      actor: facilitiesActor,
    });
    expect(deep).toMatchObject({
      categoryKey: "refrigeration",
      assetId: "asset-104-beer-cave",
      componentId: "component-104-evaporator-fan",
    });
    expect(await harness.repository.getWorkOrderDetail(
      { organizationId: NORTHLINE_ORGANIZATION_ID },
      work.id,
    )).toMatchObject({
      categoryKey: "refrigeration",
      asset: { id: "asset-104-beer-cave" },
      component: { id: "component-104-evaporator-fan" },
    });

    const categoryOnly = await updateWorkOrderClassification(harness.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: work.id,
      categoryKey: "plumbing",
      note: "Diagnosis moved the work to the plumbing service area; no equipment record is needed.",
      actor: facilitiesActor,
    });
    expect(categoryOnly.categoryKey).toBe("plumbing");
    expect(categoryOnly.assetId).toBeUndefined();
    expect(categoryOnly.componentId).toBeUndefined();
    const categoryOnlyDetail = await harness.repository.getWorkOrderDetail(
      { organizationId: NORTHLINE_ORGANIZATION_ID },
      work.id,
    );
    expect(categoryOnlyDetail?.categoryKey).toBe("plumbing");
    expect(categoryOnlyDetail?.asset).toBeUndefined();
    expect(categoryOnlyDetail?.component).toBeUndefined();

    const cleared = await updateWorkOrderClassification(harness.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: work.id,
      note: "Return this work to deferred classification pending a confirmed diagnosis.",
      actor: facilitiesActor,
    });
    expect(cleared.categoryKey).toBeUndefined();
    expect(cleared.assetId).toBeUndefined();
    expect(cleared.componentId).toBeUndefined();
    const persistedClear = await harness.repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, work.id);
    expect(persistedClear?.categoryKey ?? undefined).toBeUndefined();
    expect(persistedClear?.assetId ?? undefined).toBeUndefined();
    expect(persistedClear?.componentId ?? undefined).toBeUndefined();

    const classificationAudit = snapshot(harness.repository).auditEvents.filter(
      (event) => event.aggregateId === work.id && event.eventType === "work_order.classification_updated",
    );
    expect(classificationAudit).toHaveLength(3);
    expect(classificationAudit.map((event) => JSON.parse(event.payloadJson))).toEqual([
      expect.objectContaining({ current: expect.objectContaining({ categoryKey: "refrigeration", assetId: "asset-104-beer-cave", componentId: "component-104-evaporator-fan" }) }),
      expect.objectContaining({ current: expect.objectContaining({ categoryKey: "plumbing" }) }),
      expect.objectContaining({ current: expect.objectContaining({}) }),
    ]);
  });

  it("rejects cross-store equipment, cross-store components, and components without equipment without changing any source record", async () => {
    const fixture = buildNorthlinePresentationFixture();
    fixture.components.push({
      id: "component-contract-store-105-controller",
      organizationId: NORTHLINE_ORGANIZATION_ID,
      assetId: "asset-105-beer-cave",
      name: "Store 105 temperature controller",
      partNumber: "CTRL-105",
      createdAt: "2026-08-01T12:00:00.000Z",
    });
    const harness = commandHarness({ fixture });
    const workOrderId = NORTHLINE_DEMO_HANDLES.publicServiceWorkOrderId;

    for (const input of [
      {
        categoryKey: "refrigeration",
        assetId: "asset-105-beer-cave",
        componentId: undefined,
        note: "Attempt to attach Store 105 equipment.",
      },
      {
        categoryKey: "refrigeration",
        assetId: "asset-104-beer-cave",
        componentId: "component-contract-store-105-controller",
        note: "Attempt to attach a component from Store 105.",
      },
      {
        categoryKey: "refrigeration",
        assetId: undefined,
        componentId: "component-104-evaporator-fan",
        note: "Attempt to attach a component without its equipment record.",
      },
    ]) {
      const before = snapshot(harness.repository);
      await expect(updateWorkOrderClassification(harness.services, {
        organizationId: NORTHLINE_ORGANIZATION_ID,
        workOrderId,
        ...input,
        actor: facilitiesActor,
      })).rejects.toMatchObject({ code: "VALIDATION" });
      expect(snapshot(harness.repository)).toEqual(before);
    }
  });
});

describe("recorded work-cost facts", () => {
  it("appends cost lines and derives work-order, executive, dashboard, and detail totals from those persisted source records", async () => {
    const harness = commandHarness();
    const workOrderId = NORTHLINE_DEMO_HANDLES.publicServiceWorkOrderId;
    const scope = { organizationId: NORTHLINE_ORGANIZATION_ID };
    const period = { startsAt: "2026-08-01T00:00:00.000Z", endsAt: "2026-08-31T23:59:59.999Z" };
    const before = snapshot(harness.repository);
    const existingWorkCost = before.costLines
      .filter((line) => line.organizationId === NORTHLINE_ORGANIZATION_ID && line.workOrderId === workOrderId)
      .reduce((total, line) => total + line.amount.amountMinor, 0);
    const beforeExecutive = await harness.repository.getExecutiveSnapshot(scope, period);

    const labor = await recordWorkOrderCost(harness.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId,
      kind: "labor",
      description: "Diagnostic and fan-motor replacement labor",
      amountMinor: 17_500,
      currency: " usd ",
      serviceDate: "2026-08-10",
      actor: facilitiesActor,
    });
    const parts = await recordWorkOrderCost(harness.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId,
      kind: "parts",
      description: "Evaporator fan motor",
      amountMinor: 23_999,
      serviceDate: "2026-08-10",
      actor: facilitiesActor,
    });

    expect(labor.amount).toEqual({ amountMinor: 17_500, currency: "USD" });
    expect(parts.amount).toEqual({ amountMinor: 23_999, currency: "USD" });
    const after = snapshot(harness.repository);
    expect(after.costLines).toHaveLength(before.costLines.length + 2);
    expect(after.costLines.slice(0, before.costLines.length)).toEqual(before.costLines);
    expect(after.costLines.slice(-2).map((line) => line.id)).toEqual([labor.id, parts.id]);

    const workList = await harness.repository.listWorkOrders(scope, { limit: 100 });
    expect(workList.items.find((work) => work.id === workOrderId)?.recordedCostMinor).toBe(
      existingWorkCost + 17_500 + 23_999,
    );
    const workDetail = await harness.repository.getWorkOrderDetail(scope, workOrderId);
    expect(workDetail?.costs.slice(-2)).toEqual([
      expect.objectContaining({ id: labor.id, amountMinor: 17_500, currency: "USD" }),
      expect.objectContaining({ id: parts.id, amountMinor: 23_999, currency: "USD" }),
    ]);
    const afterExecutive = await harness.repository.getExecutiveSnapshot(scope, period);
    expect(afterExecutive.recordedCost.amountMinor).toBe(beforeExecutive.recordedCost.amountMinor + 17_500 + 23_999);
    expect(afterExecutive.sourceCounts.costLines).toBe(beforeExecutive.sourceCounts.costLines + 2);

    const rollingStart = "2025-08-10";
    const expectedRollingCost = after.costLines
      .filter((line) => line.organizationId === NORTHLINE_ORGANIZATION_ID && line.serviceDate >= rollingStart)
      .filter((line) => after.workOrders.some((work) => work.organizationId === NORTHLINE_ORGANIZATION_ID && work.id === line.workOrderId))
      .reduce((total, line) => total + line.amount.amountMinor, 0);
    const dashboard = buildDashboardModel(after, operatorSession("executive"));
    expect(dashboard.metrics.find((metric) => metric.id === "recorded-cost")?.value).toBe(usd(expectedRollingCost));
    const presenterDetail = buildDetailModel(after, operatorSession("facilities"), "work-order", workOrderId);
    const costRows = presenterDetail.sections.find((section) => section.id === "cost")?.table?.rows ?? [];
    expect(costRows.map((row) => row.id)).toEqual(expect.arrayContaining([labor.id, parts.id]));
    expect(presenterDetail.facts.find((fact) => fact.label === "Recorded work cost")?.value).toBe(
      usd(existingWorkCost + 17_500 + 23_999),
    );
  });

  it("rejects zero, negative, fractional, unsafe, malformed-date, and blank-description cost input without writing", async () => {
    const harness = commandHarness();
    const workOrderId = NORTHLINE_DEMO_HANDLES.publicServiceWorkOrderId;
    const cases = [
      { amountMinor: 0, serviceDate: "2026-08-10", description: "Zero cost" },
      { amountMinor: -1, serviceDate: "2026-08-10", description: "Negative cost" },
      { amountMinor: 10.5, serviceDate: "2026-08-10", description: "Fractional minor units" },
      { amountMinor: Number.MAX_SAFE_INTEGER + 1, serviceDate: "2026-08-10", description: "Unsafe integer" },
      { amountMinor: 100, serviceDate: "08/10/2026", description: "Malformed date" },
      { amountMinor: 100, serviceDate: "2026-08-10", description: "   " },
    ];

    for (const invalid of cases) {
      const before = snapshot(harness.repository);
      await expect(recordWorkOrderCost(harness.services, {
        organizationId: NORTHLINE_ORGANIZATION_ID,
        workOrderId,
        kind: "other",
        ...invalid,
        actor: facilitiesActor,
      })).rejects.toMatchObject({ code: "VALIDATION" });
      expect(snapshot(harness.repository)).toEqual(before);
    }
  });
});

describe("work-record transaction evidence", () => {
  it("writes mutation, audit, and outbox evidence together with matching payloads", async () => {
    const harness = commandHarness();
    const workOrderId = NORTHLINE_DEMO_HANDLES.publicServiceWorkOrderId;
    const before = snapshot(harness.repository);

    const cost = await recordWorkOrderCost(harness.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId,
      kind: "materials",
      description: "Electrical connectors and mounting hardware",
      amountMinor: 8_750,
      serviceDate: "2026-08-10",
      actor: facilitiesActor,
    });
    await updateWorkOrderClassification(harness.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId,
      categoryKey: "refrigeration",
      assetId: "asset-104-beer-cave",
      componentId: "component-104-evaporator-fan",
      note: "Confirmed the failed evaporator fan motor.",
      actor: facilitiesActor,
    });

    const after = snapshot(harness.repository);
    for (const eventType of ["work_order.cost_recorded", "work_order.classification_updated"]) {
      const audit = after.auditEvents.filter((event) => event.aggregateId === workOrderId && event.eventType === eventType);
      const outbox = after.outboxMessages.filter((message) => message.aggregateId === workOrderId && message.topic === `ops.${eventType}`);
      expect(audit).toHaveLength(1);
      expect(outbox).toHaveLength(1);
      expect(outbox[0]).toMatchObject({ status: "pending", availableAt: "2026-08-10T18:30:00.000Z" });
      expect(outbox[0]?.payloadJson).toBe(audit[0]?.payloadJson);
    }
    expect(JSON.parse(after.auditEvents.find(
      (event) => event.aggregateId === workOrderId && event.eventType === "work_order.cost_recorded",
    )!.payloadJson)).toMatchObject({ costLineId: cost.id, costBasis: "recorded_work_cost" });
    expect(after.costLines).toHaveLength(before.costLines.length + 1);
  });

  it("rolls classification and cost mutations back when their audit/outbox transaction cannot complete", async () => {
    for (const operation of ["classification", "cost"] as const) {
      const fixture = buildNorthlinePresentationFixture();
      const collision = fixture.outboxMessages[0]!.id;
      const harness = commandHarness({ fixture, outboxIdCollision: collision });
      const before = snapshot(harness.repository);
      const workOrderId = NORTHLINE_DEMO_HANDLES.publicServiceWorkOrderId;

      const mutation = operation === "classification"
        ? updateWorkOrderClassification(harness.services, {
            organizationId: NORTHLINE_ORGANIZATION_ID,
            workOrderId,
            categoryKey: "hvac",
            note: "This transaction should fail with its outbox collision.",
            actor: facilitiesActor,
          })
        : recordWorkOrderCost(harness.services, {
            organizationId: NORTHLINE_ORGANIZATION_ID,
            workOrderId,
            kind: "labor",
            description: "This transaction should fail with its outbox collision",
            amountMinor: 12_500,
            serviceDate: "2026-08-10",
            actor: facilitiesActor,
          });

      await expect(mutation).rejects.toThrow(`Duplicate fixture id ${collision}`);
      expect(snapshot(harness.repository)).toEqual(before);
    }
  });
});

describe("work-record submission idempotency", () => {
  it("replays identical classification and cost submissions without duplicating source facts, audit, or outbox", async () => {
    const classificationHarness = commandHarness();
    const workOrderId = NORTHLINE_DEMO_HANDLES.publicServiceWorkOrderId;
    const classificationIdempotency = {
      key: "classification-submit-0001",
      requestHash: "a".repeat(64),
      expiresAt: "2026-08-10T19:30:00.000Z",
    };
    const classificationInput = {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId,
      categoryKey: "hvac",
      note: "Diagnosis shows the reported issue belongs to the HVAC service area.",
      idempotency: classificationIdempotency,
      actor: facilitiesActor,
    };

    const firstClassification = await updateWorkOrderClassification(classificationHarness.services, classificationInput);
    const afterFirstClassification = snapshot(classificationHarness.repository);
    const replayedClassification = await updateWorkOrderClassification(classificationHarness.services, classificationInput);
    const afterClassificationReplay = snapshot(classificationHarness.repository);
    expect(firstClassification).toMatchObject({ categoryKey: "hvac" });
    expect(replayedClassification).toMatchObject({ id: workOrderId, categoryKey: "hvac", replayed: true });
    expect(afterClassificationReplay).toEqual(afterFirstClassification);
    expect(afterClassificationReplay.auditEvents.filter(
      (event) => event.aggregateId === workOrderId && event.eventType === "work_order.classification_updated",
    )).toHaveLength(1);
    expect(afterClassificationReplay.outboxMessages.filter(
      (message) => message.aggregateId === workOrderId && message.topic === "ops.work_order.classification_updated",
    )).toHaveLength(1);
    expect(await classificationHarness.repository.getIdempotencyKey(
      NORTHLINE_ORGANIZATION_ID,
      classificationIdempotency.key,
    )).toMatchObject({
      command: "work_order.update_classification.v1",
      resultId: workOrderId,
      requestHash: classificationIdempotency.requestHash,
    });

    const costHarness = commandHarness();
    const costIdempotency = {
      key: "record-cost-submit-0001",
      requestHash: "b".repeat(64),
      expiresAt: "2026-08-10T19:30:00.000Z",
    };
    const costInput = {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId,
      kind: "labor" as const,
      description: "Evaporator fan diagnostic labor",
      amountMinor: 18_500,
      serviceDate: "2026-08-10",
      idempotency: costIdempotency,
      actor: facilitiesActor,
    };

    const firstCost = await recordWorkOrderCost(costHarness.services, costInput);
    const afterFirstCost = snapshot(costHarness.repository);
    const replayedCost = await recordWorkOrderCost(costHarness.services, costInput);
    const afterCostReplay = snapshot(costHarness.repository);
    expect(replayedCost).toMatchObject({ id: firstCost.id, workOrderId, replayed: true });
    expect(afterCostReplay).toEqual(afterFirstCost);
    expect(afterCostReplay.costLines.filter((line) => line.id === firstCost.id)).toHaveLength(1);
    expect(afterCostReplay.auditEvents.filter(
      (event) => event.aggregateId === workOrderId && event.eventType === "work_order.cost_recorded" && JSON.parse(event.payloadJson).costLineId === firstCost.id,
    )).toHaveLength(1);
    expect(afterCostReplay.outboxMessages.filter(
      (message) => message.aggregateId === workOrderId && message.topic === "ops.work_order.cost_recorded" && JSON.parse(message.payloadJson).costLineId === firstCost.id,
    )).toHaveLength(1);
    expect(await costHarness.repository.getIdempotencyKey(
      NORTHLINE_ORGANIZATION_ID,
      costIdempotency.key,
    )).toMatchObject({
      command: "work_order.record_cost.v1",
      resultId: firstCost.id,
      requestHash: costIdempotency.requestHash,
    });
  });

  it("conflicts when the same submission key is reused with a different request hash", async () => {
    const workOrderId = NORTHLINE_DEMO_HANDLES.publicServiceWorkOrderId;
    const cases = [
      {
        harness: commandHarness(),
        execute(services: OpsCommandServices, requestHash: string) {
          return updateWorkOrderClassification(services, {
            organizationId: NORTHLINE_ORGANIZATION_ID,
            workOrderId,
            categoryKey: "hvac",
            note: "Classify the diagnosed issue as HVAC.",
            idempotency: { key: "classification-hash-0001", requestHash, expiresAt: "2026-08-10T19:30:00.000Z" },
            actor: facilitiesActor,
          });
        },
      },
      {
        harness: commandHarness(),
        execute(services: OpsCommandServices, requestHash: string) {
          return recordWorkOrderCost(services, {
            organizationId: NORTHLINE_ORGANIZATION_ID,
            workOrderId,
            kind: "parts",
            description: "Evaporator fan motor",
            amountMinor: 24_000,
            serviceDate: "2026-08-10",
            idempotency: { key: "record-cost-hash-0001", requestHash, expiresAt: "2026-08-10T19:30:00.000Z" },
            actor: facilitiesActor,
          });
        },
      },
    ];

    for (const contract of cases) {
      await contract.execute(contract.harness.services, "c".repeat(64));
      const afterFirst = snapshot(contract.harness.repository);
      await expect(contract.execute(contract.harness.services, "d".repeat(64))).rejects.toMatchObject({ code: "CONFLICT" });
      expect(snapshot(contract.harness.repository)).toEqual(afterFirst);
    }
  });

  it("recovers a forced same-key classification collision by returning the persisted classification without duplicate evidence", async () => {
    const harness = commandHarness();
    const repository = harness.repository;
    const originalAtomicWrite = repository.atomicWrite.bind(repository);
    let atomicAttempts = 0;
    repository.atomicWrite = async (statements) => {
      atomicAttempts += 1;
      return originalAtomicWrite(statements);
    };
    const workOrderId = NORTHLINE_DEMO_HANDLES.publicServiceWorkOrderId;
    const input = {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId,
      categoryKey: "hvac",
      note: "Concurrent classification of the diagnosed HVAC issue.",
      idempotency: {
        key: "classification-concurrent-0001",
        requestHash: "e".repeat(64),
        expiresAt: "2026-08-10T19:30:00.000Z",
      },
      actor: facilitiesActor,
    };

    const results = await Promise.all([
      updateWorkOrderClassification(harness.services, input),
      updateWorkOrderClassification(harness.services, input),
    ]);
    expect(atomicAttempts).toBe(2);
    expect(results.filter((result) => "replayed" in result && result.replayed === true)).toHaveLength(1);
    expect(results).toEqual([
      expect.objectContaining({ id: workOrderId, categoryKey: "hvac" }),
      expect.objectContaining({ id: workOrderId, categoryKey: "hvac" }),
    ]);
    expect(results.find((result) => "replayed" in result && result.replayed === true)).toMatchObject({
      categoryKey: "hvac",
      taxonomyNodeId: "taxonomy-northline-hvac",
      assetId: undefined,
      componentId: undefined,
      replayed: true,
    });
    expect(await repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, workOrderId)).toMatchObject({
      categoryKey: "hvac",
      taxonomyNodeId: "taxonomy-northline-hvac",
    });
    const after = snapshot(repository);
    expect(after.auditEvents.filter(
      (event) => event.aggregateId === workOrderId && event.eventType === "work_order.classification_updated",
    )).toHaveLength(1);
    expect(after.outboxMessages.filter(
      (message) => message.aggregateId === workOrderId && message.topic === "ops.work_order.classification_updated",
    )).toHaveLength(1);
  });

  it("recovers a forced same-key cost collision with the persisted cost-line id and no duplicate facts", async () => {
    const harness = commandHarness();
    const repository = harness.repository;
    const originalAtomicWrite = repository.atomicWrite.bind(repository);
    let atomicAttempts = 0;
    repository.atomicWrite = async (statements) => {
      atomicAttempts += 1;
      return originalAtomicWrite(statements);
    };
    const workOrderId = NORTHLINE_DEMO_HANDLES.publicServiceWorkOrderId;
    const input = {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId,
      kind: "materials" as const,
      description: "Concurrent recorded material cost",
      amountMinor: 9_250,
      serviceDate: "2026-08-10",
      idempotency: {
        key: "record-cost-concurrent-0001",
        requestHash: "f".repeat(64),
        expiresAt: "2026-08-10T19:30:00.000Z",
      },
      actor: facilitiesActor,
    };

    const results = await Promise.all([
      recordWorkOrderCost(harness.services, input),
      recordWorkOrderCost(harness.services, input),
    ]);
    expect(atomicAttempts).toBe(2);
    expect(results.filter((result) => result.replayed === true)).toHaveLength(1);
    expect(new Set(results.map((result) => result.id))).toEqual(new Set([results[0]!.id]));
    const persistedKey = await repository.getIdempotencyKey(NORTHLINE_ORGANIZATION_ID, input.idempotency.key);
    expect(results.every((result) => result.id === persistedKey?.resultId)).toBe(true);
    const after = snapshot(repository);
    expect(after.costLines.filter((line) => line.id === persistedKey?.resultId)).toHaveLength(1);
    expect(after.auditEvents.filter(
      (event) => event.aggregateId === workOrderId && event.eventType === "work_order.cost_recorded" && JSON.parse(event.payloadJson).costLineId === persistedKey?.resultId,
    )).toHaveLength(1);
    expect(after.outboxMessages.filter(
      (message) => message.aggregateId === workOrderId && message.topic === "ops.work_order.cost_recorded" && JSON.parse(message.payloadJson).costLineId === persistedKey?.resultId,
    )).toHaveLength(1);
  });

  it("rejects malformed and expired submission keys and refuses replay after the stored retry window expires", async () => {
    const workOrderId = NORTHLINE_DEMO_HANDLES.publicServiceWorkOrderId;
    const invalidCases = [
      { key: "too-short", requestHash: "1".repeat(64), expiresAt: "2026-08-10T19:30:00.000Z" },
      { key: "invalid key with spaces", requestHash: "1".repeat(64), expiresAt: "2026-08-10T19:30:00.000Z" },
      { key: "record-cost-invalid-hash-0001", requestHash: "not-a-sha256-hash", expiresAt: "2026-08-10T19:30:00.000Z" },
      { key: "record-cost-expired-0001", requestHash: "1".repeat(64), expiresAt: "2026-08-10T18:30:00.000Z" },
    ];

    for (const idempotency of invalidCases) {
      const harness = commandHarness();
      const before = snapshot(harness.repository);
      await expect(recordWorkOrderCost(harness.services, {
        organizationId: NORTHLINE_ORGANIZATION_ID,
        workOrderId,
        kind: "other",
        description: "Idempotency validation contract",
        amountMinor: 1_000,
        serviceDate: "2026-08-10",
        idempotency,
        actor: facilitiesActor,
      })).rejects.toMatchObject({ code: "VALIDATION" });
      expect(snapshot(harness.repository)).toEqual(before);
      expect(await harness.repository.getIdempotencyKey(NORTHLINE_ORGANIZATION_ID, idempotency.key)).toBeNull();
    }

    const expiredReplayHarness = commandHarness();
    const idempotency = {
      key: "record-cost-replay-expiry-0001",
      requestHash: "2".repeat(64),
      expiresAt: "2026-08-10T18:31:00.000Z",
    };
    const input = {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId,
      kind: "travel" as const,
      description: "Travel charge with a bounded retry window",
      amountMinor: 5_000,
      serviceDate: "2026-08-10",
      idempotency,
      actor: facilitiesActor,
    };
    await recordWorkOrderCost(expiredReplayHarness.services, input);
    const afterFirst = snapshot(expiredReplayHarness.repository);
    expiredReplayHarness.setNow("2026-08-10T18:32:00.000Z");
    await expect(recordWorkOrderCost(expiredReplayHarness.services, input)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(snapshot(expiredReplayHarness.repository)).toEqual(afterFirst);
  });
});

describe("work-recording presenter policy", () => {
  it("shows only store-valid classification choices and separates classification from cost authority by role", () => {
    const fixture = buildNorthlinePresentationFixture();
    const workOrderId = NORTHLINE_DEMO_HANDLES.publicServiceWorkOrderId;
    const work = fixture.workOrders.find((candidate) => candidate.id === workOrderId)!;
    const facilities = buildWorkOrderRecordingModel(fixture, operatorSession("facilities"), workOrderId);

    expect(facilities).toMatchObject({
      available: true,
      canClassify: true,
      canRecordCost: true,
      submitAction: `/api/ops/work-orders/${workOrderId}/records`,
      workOrderId,
      workOrderNumber: work.number,
      currentCategory: work.categoryKey,
      currentAssetId: work.assetId,
      currentComponentId: work.componentId,
      defaultServiceDate: fixture.asOf.slice(0, 10),
    });
    expect(facilities.categories.map((option) => option.value)).toEqual(expect.arrayContaining(["refrigeration", "hvac", "plumbing", "forecourt"]));
    expect(facilities.assets.length).toBeGreaterThan(0);
    expect(facilities.assets.every((option) => fixture.assets.some(
      (asset) => asset.id === option.value && asset.storeId === work.storeId && asset.categoryKey === option.categoryKey,
    ))).toBe(true);
    expect(facilities.components.every((option) => facilities.assets.some((asset) => asset.value === option.assetId))).toBe(true);
    expect(facilities.costKinds.map((option) => option.value)).toEqual(["labor", "parts", "travel", "materials", "other"]);
    const sourceCostLines = fixture.costLines.filter((line) => line.organizationId === NORTHLINE_ORGANIZATION_ID && line.workOrderId === workOrderId);
    expect(facilities.recordedCostLineCount).toBe(sourceCostLines.length);
    expect(facilities.recordedCostLabel).toBe(usd(sourceCostLines.reduce((total, line) => total + line.amount.amountMinor, 0)));

    expect(buildWorkOrderRecordingModel(fixture, operatorSession("regional"), workOrderId)).toMatchObject({
      available: true,
      canClassify: true,
      canRecordCost: true,
    });
    expect(buildWorkOrderRecordingModel(fixture, operatorSession("finance"), workOrderId)).toMatchObject({
      available: true,
      canClassify: false,
      canRecordCost: true,
    });
    expect(buildWorkOrderRecordingModel(fixture, operatorSession("store_manager"), workOrderId)).toMatchObject({
      available: true,
      canClassify: false,
      canRecordCost: false,
    });
    expect(buildWorkOrderRecordingModel(fixture, operatorSession("executive"), workOrderId)).toMatchObject({
      available: true,
      canClassify: false,
      canRecordCost: false,
    });

    const outsideStoreScope = buildWorkOrderRecordingModel(fixture, operatorSession("store_manager"), "wo-recent-aug-102-hvac");
    expect(outsideStoreScope).toMatchObject({
      available: false,
      canClassify: false,
      canRecordCost: false,
      submitAction: "",
    });
    expect(outsideStoreScope.categories).toEqual([]);
    expect(outsideStoreScope.assets).toEqual([]);
    expect(outsideStoreScope.components).toEqual([]);
    expect(outsideStoreScope.costKinds).toEqual([]);
  });
});
