import { describe, expect, it } from "vitest";
import { createWorkOrder, routeAndIssueWorkOrder, type OpsCommandServices } from "@/lib/ops/commands";
import { resolveRoleCapabilities } from "@/lib/ops/capability-policy";
import { createNorthlineFixtureRepository } from "@/lib/ops/fixture-repository";
import { NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import { configureMaintenanceResponsibilities } from "@/lib/ops/maintenance-policy-commands";
import type { ServiceAuthorizationSnapshot } from "@/lib/ops/view-models";

const NOW = "2026-09-08T15:00:00.000Z";
const adminActor = {
  organizationId: NORTHLINE_ORGANIZATION_ID,
  actorType: "user" as const,
  actorId: "membership-northline-facilities",
  actorName: "Jordan Lee",
};
const storeManagerActor = {
  organizationId: NORTHLINE_ORGANIZATION_ID,
  actorType: "user" as const,
  actorId: "membership-northline-store-104",
  actorName: "Casey Morgan",
};

function harness() {
  const repository = createNorthlineFixtureRepository();
  let sequence = 0;
  const services: OpsCommandServices = {
    repository,
    clock: { now: () => NOW },
    ids: { next: (prefix) => `${prefix}-responsibility-${++sequence}` },
  };
  return { repository, services };
}

describe("client maintenance responsibility policy", () => {
  it("defaults store managers to reporting and observable confirmation, not creation or dispatch", async () => {
    const { repository } = harness();
    const effective = resolveRoleCapabilities("store_manager", await repository.listRoleCapabilityOverrides(NORTHLINE_ORGANIZATION_ID));

    expect(effective.capabilities).toContain("confirm_observable_result");
    expect(effective.capabilities).not.toContain("create_work_order");
    expect(effective.capabilities).not.toContain("issue_work_order");
  });

  it("persists and audits an administrator's bounded role override and versioned closure policy", async () => {
    const { repository } = harness();

    const result = await configureMaintenanceResponsibilities({
      repository,
      organizationId: NORTHLINE_ORGANIZATION_ID,
      role: "store_manager",
      enabledCapabilities: ["create_work_order", "issue_work_order", "confirm_observable_result"],
      autoCloseRoutineAfterVerification: true,
      appliesToActiveWork: false,
      actor: adminActor,
      occurredAt: NOW,
    });

    expect(result.version).toBe(2);
    const overrides = await repository.listRoleCapabilityOverrides(NORTHLINE_ORGANIZATION_ID);
    expect(resolveRoleCapabilities("store_manager", overrides).capabilities).toEqual(expect.arrayContaining([
      "create_work_order",
      "issue_work_order",
      "confirm_observable_result",
    ]));
    expect(await repository.getActiveWorkflowPolicy(NORTHLINE_ORGANIZATION_ID)).toMatchObject({
      id: result.policyId,
      version: 2,
      autoCloseRoutineAfterVerification: true,
      appliesToActiveWork: false,
    });
    const snapshot = repository.snapshot();
    expect(snapshot.workflowPolicies?.find((policy) => policy.id === "workflow-policy-northline-v1"))
      .toMatchObject({ status: "superseded" });
    expect(snapshot.auditEvents).toContainEqual(expect.objectContaining({
      aggregateId: NORTHLINE_ORGANIZATION_ID,
      eventType: "organization.maintenance_responsibilities_changed",
    }));
  });

  it("enforces dispatch dependencies and lets an enabled store manager create and issue only routine in-scope work", async () => {
    const { repository, services } = harness();
    await expect(configureMaintenanceResponsibilities({
      repository,
      organizationId: NORTHLINE_ORGANIZATION_ID,
      role: "store_manager",
      enabledCapabilities: ["issue_work_order", "confirm_observable_result"],
      autoCloseRoutineAfterVerification: false,
      appliesToActiveWork: false,
      actor: adminActor,
      occurredAt: NOW,
    })).rejects.toMatchObject({ code: "VALIDATION", message: expect.stringContaining("Dispatch requires") });

    await configureMaintenanceResponsibilities({
      repository,
      organizationId: NORTHLINE_ORGANIZATION_ID,
      role: "store_manager",
      enabledCapabilities: ["create_work_order", "issue_work_order", "confirm_observable_result"],
      autoCloseRoutineAfterVerification: false,
      appliesToActiveWork: false,
      actor: adminActor,
      occurredAt: NOW,
    });
    const vendorId = "vendor-northline-summit";
    const created = await createWorkOrder(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: "store-northline-104",
      problem: "The stockroom door closer no longer catches reliably.",
      authorizedScope: "Inspect and adjust or replace the door closer within routine maintenance limits.",
      categoryKey: "exterior",
      priority: "routine",
      accountableParty: "Facilities coordination team",
      nextAction: "Issue service authorization",
      initialAssignment: { kind: "outside_vendor", vendorId },
      actor: storeManagerActor,
    });
    expect(created.status).toBe("approved");
    const [store, vendor] = await Promise.all([
      repository.getStore(NORTHLINE_ORGANIZATION_ID, created.storeId),
      repository.getVendor(NORTHLINE_ORGANIZATION_ID, vendorId),
    ]);
    const authorizationSnapshot: ServiceAuthorizationSnapshot = {
      organizationName: "Clark Pump and Shop",
      workOrderNumber: created.number,
      store: {
        id: store!.id,
        storeNumber: store!.storeNumber,
        name: store!.name,
        formattedAddress: [store!.address1, store!.address2, `${store!.city}, ${store!.state} ${store!.postalCode}`].filter(Boolean).join(", "),
      },
      vendor: { id: vendor!.id, name: vendor!.name },
      problem: created.problem,
      priority: created.priority,
      authorizedScope: created.authorizedScope,
      categoryKey: created.categoryKey,
      requestedTiming: created.dueAt,
      billingInstruction: `Reference operator work order ${created.number} on all service tickets and invoices.`,
    };

    const issued = await routeAndIssueWorkOrder(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: created.id,
      vendorId,
      expectedRevision: 0,
      channel: "email",
      authorizationSnapshot,
      publicToken: { tokenHash: "a".repeat(64), expiresAt: "2026-09-15T15:00:00.000Z" },
      actor: storeManagerActor,
    });

    expect(issued.issuance).toMatchObject({ workOrderId: created.id, revision: 1 });
    expect(await repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, created.id)).toMatchObject({ status: "issued" });
    await expect(createWorkOrder(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: "store-northline-103",
      problem: "Out-of-scope attempt",
      priority: "routine",
      accountableParty: "Facilities coordination team",
      nextAction: "Review",
      actor: storeManagerActor,
    })).rejects.toMatchObject({ code: "FORBIDDEN", message: expect.stringContaining("outside") });
  });
});
