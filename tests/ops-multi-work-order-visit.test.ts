import { describe, expect, it } from "vitest";
import { checkInVisit, checkOutVisit, type OpsCommandServices } from "@/lib/ops/commands";
import { createNorthlineFixtureRepository, createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { NORTHLINE_ORGANIZATION_ID, buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";

const STORE_104 = "store-northline-104";
const SUMMIT = "vendor-northline-summit";
const PUBLIC_WORK = "wo-northline-104-issued";
const SECOND_SUMMIT_WORK = "wo-history-104-4";
const CEDAR_WORK = "wo-history-104-1";
const OTHER_STORE_SUMMIT_WORK = "wo-northline-101";
const CHECK_IN_AT = "2026-08-20T14:00:00.000Z";
const CHECK_OUT_AT = "2026-08-20T16:15:00.000Z";

const technician = {
  organizationId: NORTHLINE_ORGANIZATION_ID,
  actorType: "technician" as const,
  actorId: "technician-multi-wo",
  actorName: "Morgan Ellis",
};

function harness() {
  const repository = createNorthlineFixtureRepository();
  let now = CHECK_IN_AT;
  let sequence = 0;
  const services: OpsCommandServices = {
    repository,
    clock: { now: () => now },
    ids: { next: (prefix) => `${prefix}-multi-${String(++sequence).padStart(4, "0")}` },
  };
  return { repository, services, setNow(value: string) { now = value; } };
}

async function reopenIssuedWork(test: ReturnType<typeof harness>, workOrderId: string) {
  const assignment = test.repository.snapshot().assignments
    .filter((candidate) => candidate.organizationId === NORTHLINE_ORGANIZATION_ID && candidate.workOrderId === workOrderId)
    .at(-1);
  if (!assignment) throw new Error(`Missing fixture assignment for ${workOrderId}`);
  await test.repository.atomicWrite([
    {
      sql: "UPDATE ops_work_orders SET status = ?, closed_at = ?, accountable_party = ?, next_action = ?, due_at = ?, escalation_to = ? WHERE organization_id = ? AND id = ?",
      params: ["issued", null, "Outside vendor", "Perform authorized service", "2026-08-21T14:00:00.000Z", "Clark Pump and Shop Facilities", NORTHLINE_ORGANIZATION_ID, workOrderId],
    },
    {
      sql: "UPDATE ops_work_order_assignments SET status = ? WHERE organization_id = ? AND id = ?",
      params: ["issued", NORTHLINE_ORGANIZATION_ID, assignment.id],
    },
  ]);
}

async function startTwoWorkVisit(test: ReturnType<typeof harness>) {
  await reopenIssuedWork(test, SECOND_SUMMIT_WORK);
  return checkInVisit(test.services, {
    organizationId: NORTHLINE_ORGANIZATION_ID,
    storeId: STORE_104,
    workOrderIds: [PUBLIC_WORK, SECOND_SUMMIT_WORK],
    technicianName: technician.actorName,
    technicianPhoneOrPin: "TECH-4182",
    crewCount: 2,
    additionalTechnicianNames: ["Riley Chen"],
    vehicleIdentifier: "SUMMIT-TRUCK-22",
    arrivalNote: "Crew arrived with shared refrigeration tools for both selected work orders.",
    purpose: "Address both refrigeration service authorizations during one store visit.",
    channel: "secure_link",
    location: { result: "verified", accuracyM: 12, distanceM: 18, capturedAt: CHECK_IN_AT },
    actor: technician,
  });
}

describe("one site visit spanning several operator work orders", () => {
  it("infers the assigned vendor and stores one ordered work link per selection", async () => {
    const test = harness();
    const visit = await startTwoWorkVisit(test);

    expect(visit).toMatchObject({ providerKind: "outside_vendor", vendorId: SUMMIT, workOrderId: undefined, status: "active", technicianPhoneOrPin: "TECH-4182", crewCount: 2, additionalTechnicianNames: ["Riley Chen"], vehicleIdentifier: "SUMMIT-TRUCK-22" });
    const links = await test.repository.listSiteVisitWorkOrders(NORTHLINE_ORGANIZATION_ID, visit.id);
    expect(links.map((link) => ({ workOrderId: link.workOrderId, ordinal: link.ordinal }))).toEqual([
      { workOrderId: PUBLIC_WORK, ordinal: 1 },
      { workOrderId: SECOND_SUMMIT_WORK, ordinal: 2 },
    ]);
    expect(links.every((link) => link.linkedByActorName === technician.actorName && !link.outcome)).toBe(true);

    const snapshot = test.repository.snapshot();
    expect(snapshot.visits.filter((candidate) => candidate.id === visit.id)).toHaveLength(1);
    expect(snapshot.visitEvidence.filter((evidence) => evidence.visitId === visit.id && evidence.kind === "check_in")).toHaveLength(1);
  });

  it("rejects mixed providers, mixed stores, and a supplied vendor that contradicts inference", async () => {
    const mixedVendor = harness();
    await reopenIssuedWork(mixedVendor, CEDAR_WORK);
    await expect(checkInVisit(mixedVendor.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: STORE_104,
      workOrderIds: [PUBLIC_WORK, CEDAR_WORK],
      technicianName: "Mixed Provider Probe",
      purpose: "Attempt an invalid shared visit.",
      channel: "qr",
      location: { result: "verified", capturedAt: CHECK_IN_AT },
      actor: technician,
    })).rejects.toMatchObject({ code: "FORBIDDEN" });

    const mixedStore = harness();
    await reopenIssuedWork(mixedStore, OTHER_STORE_SUMMIT_WORK);
    await expect(checkInVisit(mixedStore.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: STORE_104,
      workOrderIds: [PUBLIC_WORK, OTHER_STORE_SUMMIT_WORK],
      technicianName: "Mixed Store Probe",
      purpose: "Attempt an invalid cross-store visit.",
      channel: "qr",
      location: { result: "verified", capturedAt: CHECK_IN_AT },
      actor: technician,
    })).rejects.toMatchObject({ code: "NOT_FOUND" });

    const contradicted = harness();
    await expect(checkInVisit(contradicted.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: STORE_104,
      vendorId: "vendor-northline-cedar",
      workOrderIds: [PUBLIC_WORK],
      technicianName: "Provider Override Probe",
      purpose: "Attempt to override the assigned provider.",
      channel: "qr",
      location: { result: "verified", capturedAt: CHECK_IN_AT },
      actor: technician,
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("does not resolve a hostile work-order id owned by another tenant", async () => {
    const fixture = buildNorthlinePresentationFixture();
    const sourceWork = fixture.workOrders.find((work) => work.id === SECOND_SUMMIT_WORK)!;
    fixture.organizations.push({
      ...fixture.organizations[0]!,
      id: "organization-hostile",
      name: "Hostile Tenant",
      slug: "hostile-tenant",
    });
    fixture.workOrders.push({ ...sourceWork, id: "wo-hostile-tenant", organizationId: "organization-hostile" });
    const repository = createOpsFixtureRepository(fixture);
    const services: OpsCommandServices = {
      repository,
      clock: { now: () => CHECK_IN_AT },
      ids: { next: (prefix) => `${prefix}-tenant-probe` },
    };

    await expect(checkInVisit(services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: STORE_104,
      workOrderIds: [PUBLIC_WORK, "wo-hostile-tenant"],
      technicianName: "Tenant Boundary Probe",
      purpose: "Attempt to select another tenant's work by id.",
      channel: "qr",
      location: { result: "verified", capturedAt: CHECK_IN_AT },
      actor: technician,
    })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(repository.snapshot().visits.some((visit) => visit.technicianName === "Tenant Boundary Probe")).toBe(false);
  });

  it("requires exactly one outcome per linked work order before writing anything", async () => {
    const test = harness();
    const visit = await startTwoWorkVisit(test);
    test.setNow(CHECK_OUT_AT);
    const before = test.repository.snapshot();

    await expect(checkOutVisit(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      visitId: visit.id,
      channel: "qr",
      perWorkOrderOutcomes: [{ workOrderId: PUBLIC_WORK, outcome: "completed" }],
      location: { result: "verified", capturedAt: CHECK_OUT_AT },
      actor: technician,
    })).rejects.toMatchObject({ code: "VALIDATION" });
    expect(test.repository.snapshot()).toEqual(before);

    await expect(checkOutVisit(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      visitId: visit.id,
      channel: "qr",
      perWorkOrderOutcomes: [
        { workOrderId: PUBLIC_WORK, outcome: "completed" },
        { workOrderId: PUBLIC_WORK, outcome: "no_issue_found" },
      ],
      location: { result: "verified", capturedAt: CHECK_OUT_AT },
      actor: technician,
    })).rejects.toMatchObject({ code: "VALIDATION" });
    expect(test.repository.snapshot()).toEqual(before);
  });

  it("records per-work outcomes and an owned follow-up while sharing one presence boundary", async () => {
    const test = harness();
    const visit = await startTwoWorkVisit(test);
    test.setNow(CHECK_OUT_AT);

    const receipt = await checkOutVisit(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      visitId: visit.id,
      channel: "qr",
      perWorkOrderOutcomes: [
        { workOrderId: PUBLIC_WORK, outcome: "completed", outcomeNotes: "Evaporator fan replaced and operating normally." },
        {
          workOrderId: SECOND_SUMMIT_WORK,
          outcome: "parts_required",
          outcomeNotes: "Compressor contactor requires a compatible replacement.",
          followUp: {
            accountableParty: "ColdLine Refrigeration & HVAC",
            nextAction: "Return with the compatible compressor contactor.",
            dueAt: "2026-08-22T18:00:00.000Z",
            escalationTo: "Clark Pump and Shop Facilities",
          },
        },
      ],
      location: { result: "verified", accuracyM: 10, distanceM: 16, capturedAt: CHECK_OUT_AT },
      actor: technician,
    });

    expect(receipt).toMatchObject({ status: "checked_out", workOrderId: undefined, outcome: undefined });
    const links = await test.repository.listSiteVisitWorkOrders(NORTHLINE_ORGANIZATION_ID, visit.id);
    expect(links[0]).toMatchObject({ workOrderId: PUBLIC_WORK, outcome: "completed" });
    expect(links[0].followUpId).toBeUndefined();
    expect(links[1]).toMatchObject({ workOrderId: SECOND_SUMMIT_WORK, outcome: "parts_required", followUpId: expect.any(String) });
    const snapshot = test.repository.snapshot();
    expect(snapshot.followUps.filter((followUp) => followUp.sourceVisitId === visit.id)).toEqual([
      expect.objectContaining({ id: links[1]!.followUpId, workOrderId: SECOND_SUMMIT_WORK, status: "open" }),
    ]);
    expect(snapshot.visitEvidence.filter((evidence) => evidence.visitId === visit.id)).toHaveLength(2);
    expect(snapshot.visitEvidence.filter((evidence) => evidence.visitId === visit.id).map((evidence) => evidence.kind).sort()).toEqual(["check_in", "check_out"]);
    expect(snapshot.workOrders.find((work) => work.id === PUBLIC_WORK)).toMatchObject({ status: "completed_pending_review" });
    expect(snapshot.workOrders.find((work) => work.id === SECOND_SUMMIT_WORK)).toMatchObject({ status: "waiting_on_parts" });
    expect(snapshot.auditEvents.filter((event) => event.eventType === "work_order.visit_outcome_recorded" && [PUBLIC_WORK, SECOND_SUMMIT_WORK].includes(event.aggregateId))).toHaveLength(2);
    const checkInAudit = snapshot.auditEvents.find((event) => event.aggregateId === visit.id && event.eventType === "visit.checked_in");
    const checkOutAudit = snapshot.auditEvents.find((event) => event.aggregateId === visit.id && event.eventType === "visit.checked_out");
    expect(JSON.parse(checkInAudit!.payloadJson)).toMatchObject({ workOrderIds: [PUBLIC_WORK, SECOND_SUMMIT_WORK], vendorId: SUMMIT });
    expect(JSON.parse(checkOutAudit!.payloadJson)).toMatchObject({ workOrderIds: [PUBLIC_WORK, SECOND_SUMMIT_WORK] });
  });

  it("requires a separate accountable obligation for every unresolved outcome", async () => {
    const test = harness();
    const visit = await startTwoWorkVisit(test);
    test.setNow(CHECK_OUT_AT);

    await expect(checkOutVisit(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      visitId: visit.id,
      channel: "store_device",
      perWorkOrderOutcomes: [
        { workOrderId: PUBLIC_WORK, outcome: "parts_required" },
        { workOrderId: SECOND_SUMMIT_WORK, outcome: "return_visit_required" },
      ],
      location: { result: "trusted_store_device", capturedAt: CHECK_OUT_AT },
      actor: { ...technician, actorType: "store_device" },
    })).rejects.toMatchObject({ code: "VALIDATION" });

    expect((await test.repository.getVisit(NORTHLINE_ORGANIZATION_ID, visit.id))?.status).toBe("active");
    expect((await test.repository.listSiteVisitWorkOrders(NORTHLINE_ORGANIZATION_ID, visit.id)).every((link) => !link.outcome)).toBe(true);
  });

  it("fences every linked work order so concurrent checkout has one winner", async () => {
    const test = harness();
    const visit = await startTwoWorkVisit(test);
    test.setNow(CHECK_OUT_AT);
    const input = {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      visitId: visit.id,
      channel: "qr" as const,
      perWorkOrderOutcomes: [
        { workOrderId: PUBLIC_WORK, outcome: "completed" as const },
        { workOrderId: SECOND_SUMMIT_WORK, outcome: "no_issue_found" as const },
      ],
      location: { result: "verified" as const, capturedAt: CHECK_OUT_AT },
      actor: technician,
    };

    const results = await Promise.allSettled([
      checkOutVisit(test.services, input),
      checkOutVisit(test.services, input),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejection = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    expect(rejection?.reason).toMatchObject({ code: "CONFLICT" });
    expect(test.repository.snapshot().visitEvidence.filter((evidence) => evidence.visitId === visit.id && evidence.kind === "check_out")).toHaveLength(1);
  });
});
