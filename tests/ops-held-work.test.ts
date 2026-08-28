import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it } from "vitest";
import { PUBLIC_DEMO_LINKS, getPublicOperationsGateway } from "@/components/ops-public/server-gateway";
import { placeWorkOrderOnVisitHold, updateWorkOrderControl } from "@/lib/ops/commands";
import { getNorthlineFixtureRepository, resetNorthlineFixtureRepository } from "@/lib/ops/fixture-repository";
import { NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";

const CEDAR_VENDOR_ID = "vendor-northline-cedar";
const BRIGHTLINE_VENDOR_ID = "vendor-northline-brightpath";
const DOOR_WORK_ID = "wo-held-104-restroom-door";
const LIGHT_WORK_ID = "wo-held-104-canopy-light";

describe("manager-approved held work", () => {
  beforeEach(() => resetNorthlineFixtureRepository());

  it("offers only service-matched work and never exposes the internal review threshold", async () => {
    const gateway = getPublicOperationsGateway();
    const cedar = await gateway.lookupVendorVisitContext(PUBLIC_DEMO_LINKS.storeToken, CEDAR_VENDOR_ID);
    const brightline = await gateway.lookupVendorVisitContext(PUBLIC_DEMO_LINKS.storeToken, BRIGHTLINE_VENDOR_ID);

    expect(cedar.heldWork.map((row) => row.id)).toContain(DOOR_WORK_ID);
    expect(cedar.heldWork.map((row) => row.id)).not.toContain(LIGHT_WORK_ID);
    expect(brightline.heldWork.map((row) => row.id)).toContain(LIGHT_WORK_ID);
    expect(brightline.heldWork.map((row) => row.id)).not.toContain(DOOR_WORK_ID);
    expect(JSON.stringify(cedar.heldWork)).not.toContain("internalReviewThreshold");
    expect(JSON.stringify(cedar.heldWork)).not.toContain("25000");
  });

  it("lets a manager edit an active later-work approval without recreating the work order", async () => {
    const repository = getNorthlineFixtureRepository();
    const before = await repository.getWorkOrderVisitHold(NORTHLINE_ORGANIZATION_ID, LIGHT_WORK_ID);
    const result = await placeWorkOrderOnVisitHold(
      { repository, clock: { now: () => "2026-08-27T16:00:00.000Z" } },
      {
        organizationId: NORTHLINE_ORGANIZATION_ID,
        workOrderId: LIGHT_WORK_ID,
        posture: "complete_using_professional_judgment",
        deadlineAt: "2026-09-20T17:00:00.000Z",
        internalReviewThresholdAmountMinor: 35_000,
        currency: "USD",
        actor: {
          actorType: "user",
          actorId: "membership-northline-facilities",
          actorName: "Jamie Rivera",
          organizationId: NORTHLINE_ORGANIZATION_ID,
        },
      },
    );

    expect(result.id).toBe(before?.id);
    expect(await repository.getWorkOrderVisitHold(NORTHLINE_ORGANIZATION_ID, LIGHT_WORK_ID)).toMatchObject({
      id: before?.id,
      status: "active",
      posture: "complete_using_professional_judgment",
      deadlineAt: "2026-09-20T17:00:00.000Z",
      internalReviewThreshold: { amountMinor: 35_000, currency: "USD" },
      version: (before?.version ?? 0) + 1,
    });
  });

  it("atomically claims held work, records temporary-repair advice, and returns it to its original deadline", async () => {
    const gateway = getPublicOperationsGateway();
    const repository = getNorthlineFixtureRepository();
    const originalHold = await repository.getWorkOrderVisitHold(NORTHLINE_ORGANIZATION_ID, DOOR_WORK_ID);
    expect(originalHold?.status).toBe("active");

    const checkIn = await gateway.checkIn(PUBLIC_DEMO_LINKS.storeToken, {
      submissionKey: "held-work-check-in-0001",
      vendorId: CEDAR_VENDOR_ID,
      heldWorkOrderIds: [DOOR_WORK_ID],
      noWorkOrderReason: "Scheduled plumbing inspection; reviewing approved items while onsite.",
      technicianName: "Dana Ruiz",
      crewCount: 1,
      location: { captureResult: "permission_denied" },
    });
    expect(checkIn.workOrders).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: DOOR_WORK_ID, selectionSource: "held_work", heldWorkPosture: "complete_using_professional_judgment" }),
    ]));
    expect((await repository.getWorkOrderVisitHold(NORTHLINE_ORGANIZATION_ID, DOOR_WORK_ID))?.status).toBe("claimed");

    await expect(gateway.checkIn(PUBLIC_DEMO_LINKS.storeToken, {
      submissionKey: "held-work-second-claim-0001",
      vendorId: CEDAR_VENDOR_ID,
      heldWorkOrderIds: [DOOR_WORK_ID],
      noWorkOrderReason: "Another visit attempted to select the same held item.",
      technicianName: "Second Technician",
      location: { captureResult: "permission_denied" },
    })).rejects.toMatchObject({ code: "held_work_not_available", status: 409 });

    const checkoutToken = checkIn.checkoutUrl.split("/public/store/")[1]!.split("/")[0]!;
    await gateway.checkOut(checkoutToken, {
      submissionKey: "held-work-checkout-0001",
      visitId: checkIn.visitId,
      perWorkOrderOutcomes: [{
        workOrderId: DOOR_WORK_ID,
        outcome: "temporary_repair",
        outcomeNotes: "Adjusted the closer. The arm is worn and should be replaced during the next planned visit.",
        vendorFollowUpTiming: "within_90_days",
      }],
      location: { captureResult: "permission_denied" },
      evidence: [],
    });

    const snapshot = repository.snapshot();
    const hold = snapshot.workOrderVisitHolds?.find((row) => row.workOrderId === DOOR_WORK_ID);
    expect(hold).toMatchObject({ status: "active", deadlineAt: originalHold?.deadlineAt });
    const link = snapshot.siteVisitWorkOrders.find((row) => row.visitId === checkIn.visitId && row.workOrderId === DOOR_WORK_ID);
    expect(link).toMatchObject({ outcome: "temporary_repair", vendorFollowUpTiming: "within_90_days" });
    const followUp = snapshot.followUps.find((row) => row.id === link?.followUpId);
    expect(followUp).toMatchObject({ accountableParty: "Facilities coordinator", status: "open" });
    const notice = snapshot.outboxMessages.find((row) => row.topic === "ops.held_work.outcomes_recorded" && row.aggregateId === checkIn.visitId);
    expect(notice).toBeTruthy();
    expect(JSON.parse(notice!.payloadJson)).toMatchObject({
      workOrderIds: [DOOR_WORK_ID],
      itemCount: 1,
      temporaryRepair: 1,
      unplannedOnsitePickup: 1,
      verifiedAvoidedTripCount: 0,
      verifiedAvoidedTripMeaning: "requires_separate_manager_verification",
      amountMeaning: "no_price_or_authorization_recorded",
    });
    expect(notice!.payloadJson).not.toMatch(/amountMinor|authorizedAmount|internalReviewThreshold/);
  }, 30_000);

  it("moves look-and-report findings to manager review instead of pretending the repair was completed", async () => {
    const gateway = getPublicOperationsGateway();
    const repository = getNorthlineFixtureRepository();
    const checkIn = await gateway.checkIn(PUBLIC_DEMO_LINKS.storeToken, {
      submissionKey: "held-inspection-check-in-0001",
      vendorId: BRIGHTLINE_VENDOR_ID,
      heldWorkOrderIds: [LIGHT_WORK_ID],
      noWorkOrderReason: "Lighting vendor arrived for another onsite inspection.",
      technicianName: "Avery Brooks",
      location: { captureResult: "permission_denied" },
    });
    const checkoutToken = checkIn.checkoutUrl.split("/public/store/")[1]!.split("/")[0]!;
    await gateway.checkOut(checkoutToken, {
      submissionKey: "held-inspection-checkout-0001",
      visitId: checkIn.visitId,
      perWorkOrderOutcomes: [{ workOrderId: LIGHT_WORK_ID, outcome: "diagnosis_only", outcomeNotes: "Driver has failed; fixture replacement should be quoted." }],
      location: { captureResult: "permission_denied" },
      evidence: [],
    });

    const hold = await repository.getWorkOrderVisitHold(NORTHLINE_ORGANIZATION_ID, LIGHT_WORK_ID);
    const workOrder = await repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, LIGHT_WORK_ID);
    expect(hold?.status).toBe("review_required");
    expect(workOrder).toMatchObject({ status: "approved", accountableParty: "Facilities coordinator", nextAction: "Review the onsite findings and choose the next step" });
  });

  it("cancels an active later-work approval atomically when the work order is cancelled", async () => {
    const repository = getNorthlineFixtureRepository();
    const workOrder = await repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, LIGHT_WORK_ID);
    expect(workOrder).toMatchObject({ status: "approved" });

    await updateWorkOrderControl(
      { repository, clock: { now: () => "2026-08-27T16:00:00.000Z" } },
      {
        organizationId: NORTHLINE_ORGANIZATION_ID,
        workOrderId: LIGHT_WORK_ID,
        expectedStatus: "approved",
        status: "cancelled",
        priority: workOrder!.priority,
        note: "Lighting issue was corrected by store staff before vendor service was needed.",
        actor: {
          actorType: "user",
          actorId: "membership-northline-facilities",
          actorName: "Jamie Rivera",
          organizationId: NORTHLINE_ORGANIZATION_ID,
        },
      },
    );

    expect(await repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, LIGHT_WORK_ID)).toMatchObject({ status: "cancelled" });
    expect(await repository.getWorkOrderVisitHold(NORTHLINE_ORGANIZATION_ID, LIGHT_WORK_ID)).toMatchObject({ status: "cancelled" });
    expect(repository.snapshot().auditEvents.some((event) => event.aggregateId === LIGHT_WORK_ID && event.eventType === "work_order.visit_hold_cancelled_with_work_order")).toBe(true);
  });

  it("lets an active vendor visit add approved work without another check-in", async () => {
    const gateway = getPublicOperationsGateway();
    const repository = getNorthlineFixtureRepository();
    const checkIn = await gateway.checkIn(PUBLIC_DEMO_LINKS.storeToken, {
      submissionKey: "mid-visit-start-0001",
      vendorId: CEDAR_VENDOR_ID,
      noWorkOrderReason: "The vendor arrived for an unrelated service call.",
      technicianName: "Dana Ruiz",
      crewCount: 1,
      location: { captureResult: "permission_denied" },
    });
    expect(checkIn.workOrders).toHaveLength(0);

    const activeVisitToken = checkIn.checkoutUrl.split("/public/store/")[1]!.split("/")[0]!;
    const updated = await gateway.addHeldWorkToVisit(activeVisitToken, {
      submissionKey: "mid-visit-add-work-0001",
      visitId: checkIn.visitId,
      heldWorkOrderIds: [DOOR_WORK_ID],
    });
    expect(updated.activeVisits.find((visit) => visit.id === checkIn.visitId)?.workOrders).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: DOOR_WORK_ID, selectionSource: "held_work", heldWorkPosture: "complete_using_professional_judgment" }),
    ]));
    expect((await repository.getWorkOrderVisitHold(NORTHLINE_ORGANIZATION_ID, DOOR_WORK_ID))?.status).toBe("claimed");

    const replay = await gateway.addHeldWorkToVisit(activeVisitToken, {
      submissionKey: "mid-visit-add-work-0001",
      visitId: checkIn.visitId,
      heldWorkOrderIds: [DOOR_WORK_ID],
    });
    expect(replay.activeVisits.find((visit) => visit.id === checkIn.visitId)?.workOrders.filter((row) => row.id === DOOR_WORK_ID)).toHaveLength(1);
    await expect(gateway.addHeldWorkToVisit(activeVisitToken, {
      submissionKey: "mid-visit-add-work-second-attempt",
      visitId: checkIn.visitId,
      heldWorkOrderIds: [DOOR_WORK_ID],
    })).rejects.toMatchObject({ code: "held_work_not_available", status: 409 });
  }, 30_000);

  it("keeps the technician and manager language direct and price-free", async () => {
    const [technicianSource, managerSource] = await Promise.all([
      readFile("components/ops-public/technician-visit-flow.tsx", "utf8"),
      readFile("components/workspace/held-work-actions.tsx", "utf8"),
    ]);
    expect(technicianSource).toContain("Select anything you can handle today");
    expect(technicianSource).toContain("Your company decides what it can handle today");
    expect(technicianSource).toContain("A photo is strongly recommended for a temporary repair");
    expect(managerSource).toContain("Never shown to the technician; not a price or authorization");
    expect(managerSource).toContain("No estimate or manager reply is required during the visit");
    expect(technicianSource).not.toContain("internalReviewThreshold");
  });
});
