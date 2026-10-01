import { expect } from "vitest";
import { addHeldWorkToActiveVisit, checkInVisit, checkOutVisit, createWorkOrder } from "@/lib/ops/commands";
import type { OpsRepository } from "@/lib/ops/repository";

export async function multipleHeldWorkRegression(repository: OpsRepository) {
  const organizationId = "org-northline-demo";
  const now = "2026-09-01T12:00:00.000Z";
  const actor = { organizationId, actorType: "user" as const, actorId: "membership-northline-facilities", actorName: "Facilities" };
  const services = { repository, clock: { now: () => now } };
  const work: Array<Awaited<ReturnType<typeof createWorkOrder>>> = [];
  for (let i = 0; i < 3; i++) work.push(await createWorkOrder(services, {
    organizationId, storeId: "store-northline-104", categoryKey: "electrical",
    problem: `Inspect lighting circuit ${i}`, accountableParty: "Facilities", nextAction: "Wait for vendor",
    holdForVisit: { posture: i === 0 ? "complete_using_professional_judgment" : "look_and_report", deadlineAt: "2026-09-12T17:00:00.000Z" }, actor,
  }));
  const technician = { organizationId, actorType: "technician" as const, actorName: "Multiple jobs test" };
  const visit = await checkInVisit(services, {
    organizationId, storeId: "store-northline-104", vendorId: "vendor-northline-brightpath",
    heldWorkOrderIds: [work[0].id], technicianName: technician.actorName,
    unmatchedReason: "Approved inspection", purpose: "Inspect lighting", channel: "qr",
    location: { result: "permission_denied", capturedAt: now }, actor: technician,
  });
  await addHeldWorkToActiveVisit(services, { organizationId, visitId: visit.id, heldWorkOrderIds: work.slice(1).map(w => w.id), actor: technician });
  expect(await repository.listSiteVisitWorkOrders(organizationId, visit.id)).toHaveLength(3);
  await checkOutVisit(services, {
    organizationId, visitId: visit.id, channel: "secure_link", actor: technician,
    location: { result: "permission_denied", capturedAt: now },
    perWorkOrderOutcomes: work.map((w, i) => ({ workOrderId: w.id, outcome: i === 0 ? "completed" : "no_issue_found", outcomeNotes: "Lighting working during inspection" })),
  });
  expect(await repository.getVisit(organizationId, visit.id)).toMatchObject({ status: "checked_out" });
  const outcomes = await repository.listSiteVisitWorkOrders(organizationId, visit.id);
  expect(outcomes.find(w => w.workOrderId === work[0].id)).toMatchObject({ outcome: "completed" });
  for (const added of work.slice(1)) {
    const outcome = outcomes.find(w => w.workOrderId === added.id)!;
    expect(outcome).toMatchObject({ outcome: "no_issue_found" });
    expect(outcome.followUpId).toBeTruthy();
    expect(await repository.getFollowUp(organizationId, outcome.followUpId!)).toMatchObject({ status: "open", workOrderId: added.id });
    expect(await repository.getWorkOrderVisitHold(organizationId, added.id)).toMatchObject({ status: "review_required" });
  }
}
