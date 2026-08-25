import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it } from "vitest";
import { PUBLIC_DEMO_LINKS, getPublicOperationsGateway } from "@/components/ops-public/server-gateway";
import { createOpsFixtureRepository, getNorthlineFixtureRepository, resetNorthlineFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildNorthlinePresentationFixture, NORTHLINE_DEMO_HANDLES, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";

const PUBLIC_WORK = NORTHLINE_DEMO_HANDLES.publicServiceWorkOrderId;
const SECOND_SUMMIT_WORK = "wo-history-104-4";

async function reopenSecondSummitWork() {
  const repository = getNorthlineFixtureRepository();
  const assignment = repository.snapshot().assignments.find((row) => row.organizationId === NORTHLINE_ORGANIZATION_ID && row.workOrderId === SECOND_SUMMIT_WORK)!;
  await repository.atomicWrite([
    {
      sql: "UPDATE ops_work_orders SET status = ?, accountable_party = ?, next_action = ?, due_at = ?, escalation_to = ? WHERE organization_id = ? AND id = ?",
      params: ["issued", "Summit Refrigeration", "Perform authorized service", "2026-08-22T18:00:00.000Z", "Northline Facilities", NORTHLINE_ORGANIZATION_ID, SECOND_SUMMIT_WORK],
    },
    {
      sql: "UPDATE ops_work_order_assignments SET status = ? WHERE organization_id = ? AND id = ?",
      params: ["issued", NORTHLINE_ORGANIZATION_ID, assignment.id],
    },
  ]);
}

async function startMultiWorkVisit(submissionKey: string) {
  await reopenSecondSummitWork();
  return getPublicOperationsGateway().checkIn(PUBLIC_DEMO_LINKS.storeToken, {
    submissionKey,
    workOrderIds: [PUBLIC_WORK, SECOND_SUMMIT_WORK],
    technicianName: "Morgan Ellis",
    technicianPhoneOrPin: "TECH-4182",
    crewCount: 2,
    additionalTechnicianNames: ["Riley Chen"],
    vehicleIdentifier: "SUMMIT-TRUCK-22",
    arrivalNote: "Crew arrived with shared refrigeration tools for both selected work orders.",
    location: { captureResult: "permission_denied" },
  });
}

describe("public work-order-first multi-work-order visit", () => {
  beforeEach(() => {
    resetNorthlineFixtureRepository();
  });

  it("lists eligible work before Vendor selection and infers one read-only assigned Vendor", async () => {
    await reopenSecondSummitWork();
    const gateway = getPublicOperationsGateway();
    const context = await gateway.lookupVendorVisitContext(PUBLIC_DEMO_LINKS.storeToken);
    const selected = context.eligibleWorkOrders.filter((workOrder) => [PUBLIC_WORK, SECOND_SUMMIT_WORK].includes(workOrder.id));

    expect(selected).toHaveLength(2);
    expect(selected.every((workOrder) => workOrder.assignedVendor.id === "vendor-northline-summit")).toBe(true);
    expect(selected.every((workOrder) => workOrder.problem && workOrder.category && workOrder.dueOrScheduledAt)).toBe(true);

    await expect(gateway.checkIn(PUBLIC_DEMO_LINKS.storeToken, {
      submissionKey: "public-provider-override-probe-0001",
      vendorId: "vendor-northline-cedar",
      workOrderIds: [PUBLIC_WORK, SECOND_SUMMIT_WORK],
      technicianName: "Provider Override Probe",
      location: { captureResult: "permission_denied" },
    })).rejects.toMatchObject({ code: "vendor_override_not_allowed", status: 403 });
  });

  it("persists the full selection and crew metadata and hashes every selected work order", async () => {
    const gateway = getPublicOperationsGateway();
    const repository = getNorthlineFixtureRepository();
    const commandKey = "public-multi-check-in-idempotency-0001";
    const first = await startMultiWorkVisit(commandKey);
    const retry = await gateway.checkIn(PUBLIC_DEMO_LINKS.storeToken, {
      submissionKey: commandKey,
      workOrderIds: [PUBLIC_WORK, SECOND_SUMMIT_WORK],
      technicianName: "Morgan Ellis",
      technicianPhoneOrPin: "TECH-4182",
      crewCount: 2,
      additionalTechnicianNames: ["Riley Chen"],
      vehicleIdentifier: "SUMMIT-TRUCK-22",
      arrivalNote: "Crew arrived with shared refrigeration tools for both selected work orders.",
      location: { captureResult: "permission_denied" },
    });

    expect(first).toMatchObject({ vendorName: "Summit Refrigeration", crewCount: 2, additionalTechnicianNames: ["Riley Chen"] });
    expect(first.workOrders.map((workOrder) => workOrder.id)).toEqual([PUBLIC_WORK, SECOND_SUMMIT_WORK]);
    expect(retry).toMatchObject({ replayed: true, visitId: first.visitId });
    expect((await repository.listSiteVisitWorkOrders(NORTHLINE_ORGANIZATION_ID, first.visitId)).map((link) => link.workOrderId)).toEqual([PUBLIC_WORK, SECOND_SUMMIT_WORK]);

    await expect(gateway.checkIn(PUBLIC_DEMO_LINKS.storeToken, {
      submissionKey: commandKey,
      workOrderIds: [PUBLIC_WORK],
      technicianName: "Morgan Ellis",
      technicianPhoneOrPin: "TECH-4182",
      crewCount: 2,
      additionalTechnicianNames: ["Riley Chen"],
      vehicleIdentifier: "SUMMIT-TRUCK-22",
      arrivalNote: "Crew arrived with shared refrigeration tools for both selected work orders.",
      location: { captureResult: "permission_denied" },
    })).rejects.toMatchObject({ code: "idempotency_conflict", status: 409 });
  });

  it("keeps service-authorization links bound to one work order", async () => {
    await reopenSecondSummitWork();
    await expect(getPublicOperationsGateway().checkIn(PUBLIC_DEMO_LINKS.serviceToken, {
      submissionKey: "public-service-token-multi-probe-0001",
      workOrderIds: [PUBLIC_WORK, SECOND_SUMMIT_WORK],
      technicianName: "Service Token Probe",
      location: { captureResult: "permission_denied" },
    })).rejects.toMatchObject({ code: "service_token_work_order_bound", status: 403 });
  });

  it("rejects partial checkout, then commits and replays one exact outcome per work order", async () => {
    const gateway = getPublicOperationsGateway();
    const repository = getNorthlineFixtureRepository();
    const checkIn = await startMultiWorkVisit("public-multi-checkout-prerequisite-0001");
    const checkoutToken = checkIn.checkoutUrl.split("/public/store/")[1]!.split("/")[0]!;

    await expect(gateway.checkOut(checkoutToken, {
      submissionKey: "public-multi-partial-checkout-0001",
      visitId: checkIn.visitId,
      perWorkOrderOutcomes: [{ workOrderId: PUBLIC_WORK, outcome: "completed" }],
      location: { captureResult: "permission_denied" },
      evidence: [],
    })).rejects.toMatchObject({ code: "incomplete_work_order_outcomes", status: 422 });
    expect((await repository.getVisit(NORTHLINE_ORGANIZATION_ID, checkIn.visitId))?.status).toBe("active");

    const command = {
      submissionKey: "public-multi-exact-checkout-0001",
      visitId: checkIn.visitId,
      perWorkOrderOutcomes: [
        { workOrderId: PUBLIC_WORK, outcome: "completed" as const, outcomeNotes: "Evaporator fan is operating normally." },
        {
          workOrderId: SECOND_SUMMIT_WORK,
          outcome: "parts_required" as const,
          outcomeNotes: "A compatible contactor is required.",
          followUp: {
            accountableParty: "Summit Refrigeration",
            nextAction: "Return with the compatible compressor contactor.",
            dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            escalationTo: "Northline Facilities",
          },
        },
      ],
      location: { captureResult: "permission_denied" as const },
      evidence: [],
    };
    const first = await gateway.checkOut(checkoutToken, command);
    const retry = await gateway.checkOut(checkoutToken, command);

    expect(first.workOrderOutcomes.map((outcome) => [outcome.id, outcome.outcome])).toEqual([
      [PUBLIC_WORK, "completed"],
      [SECOND_SUMMIT_WORK, "parts_required"],
    ]);
    expect(retry).toMatchObject({ replayed: true, visitId: first.visitId });
    expect(repository.snapshot().visitEvidence.filter((evidence) => evidence.visitId === checkIn.visitId && evidence.kind === "check_out")).toHaveLength(1);

    await expect(gateway.checkOut(checkoutToken, {
      ...command,
      perWorkOrderOutcomes: command.perWorkOrderOutcomes.map((outcome, index) => index ? { ...outcome, outcomeNotes: "Edited after submission" } : outcome),
    })).rejects.toMatchObject({ code: "idempotency_conflict", status: 409 });
  });

  it("does not resolve a hostile work-order id through a different tenant's store token", async () => {
    const fixture = buildNorthlinePresentationFixture();
    const sourceWork = fixture.workOrders.find((workOrder) => workOrder.id === SECOND_SUMMIT_WORK)!;
    const sourceStore = fixture.stores.find((store) => store.id === NORTHLINE_DEMO_HANDLES.storyStoreId)!;
    const sourceVendor = fixture.vendors.find((vendor) => vendor.id === "vendor-northline-summit")!;
    fixture.organizations.push({ ...fixture.organizations[0]!, id: "organization-hostile", name: "Hostile Tenant", slug: "hostile-tenant" });
    fixture.stores.push({ ...sourceStore, id: "store-hostile", organizationId: "organization-hostile", storeNumber: "H-1" });
    fixture.vendors.push({ ...sourceVendor, id: "vendor-hostile", organizationId: "organization-hostile", code: "HOSTILE" });
    fixture.vendorCoverage.push({ id: "coverage-hostile", organizationId: "organization-hostile", vendorId: "vendor-hostile", scopeKind: "organization", scopeId: "organization-hostile" });
    fixture.workOrders.push({ ...sourceWork, id: "wo-hostile-tenant", organizationId: "organization-hostile", storeId: "store-hostile", requestId: undefined, taxonomyNodeId: undefined, assetId: undefined, componentId: undefined, status: "issued" });
    fixture.assignments.push({ ...fixture.assignments.find((assignment) => assignment.workOrderId === SECOND_SUMMIT_WORK)!, id: "assignment-hostile-tenant", organizationId: "organization-hostile", workOrderId: "wo-hostile-tenant", vendorId: "vendor-hostile", status: "issued" });
    (globalThis as typeof globalThis & { __opsPresentationRuntimeRepository?: ReturnType<typeof createOpsFixtureRepository> }).__opsPresentationRuntimeRepository = createOpsFixtureRepository(fixture);

    await expect(getPublicOperationsGateway().checkIn(PUBLIC_DEMO_LINKS.storeToken, {
      submissionKey: "public-cross-tenant-selection-probe-0001",
      workOrderIds: [PUBLIC_WORK, "wo-hostile-tenant"],
      technicianName: "Cross Tenant Probe",
      location: { captureResult: "permission_denied" },
    })).rejects.toMatchObject({ code: "work_order_not_eligible", status: 403 });
    expect(getNorthlineFixtureRepository().snapshot().visits.some((visit) => visit.technicianName === "Cross Tenant Probe")).toBe(false);
  });

  it("keeps the WO-first, inferred-Vendor, crew, exact-outcome and shared-evidence controls in the public form", async () => {
    const source = await readFile("components/ops-public/technician-visit-flow.tsx", "utf8");
    expect(source).toContain("Choose store work orders");
    expect(source).toContain("Assigned Vendor (inferred)");
    expect(source).toContain("No work order provided / I don&apos;t see my work order");
    expect(source).toContain("workOrderIds: unmatched ? undefined : selectedWorkOrderIds");
    expect(source).toContain("technicianPhoneOrPin");
    expect(source).toContain("additionalTechnicianNames");
    expect(source).toContain("perWorkOrderOutcomes");
    expect(source).toContain("Accountable follow-up required");
    expect(source).toContain("Shared photos or service files");
  });
});
