import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ServiceRunResponsePage } from "@/components/ops-public/service-run-response-page";
import type { OpsCommandServices } from "@/lib/ops/commands";
import { checkInVisit } from "@/lib/ops/commands";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import { acceptServiceRunCounter, createStoreSweep, respondToServiceRun } from "@/lib/ops/service-run-commands";
import { buildServiceRunPublicView } from "@/lib/ops/service-run-presenter";

const CEDAR = "vendor-northline-cedar";
const CONTRACT = "contract-version-cedar-work-terms-v1";
const DOOR = "wo-held-104-restroom-door";
const SINK = "wo-held-104-prep-sink";
const TOKEN_HASH = "8e3f4f5b62d4cb496b4f3f8b7c7e2615b539470f6d520a964106db02bd0f8972";
const actor = { organizationId: NORTHLINE_ORGANIZATION_ID, actorType: "user" as const, actorId: "membership-northline-facilities", actorName: "Jordan Lee" };
const vendorActor = { organizationId: NORTHLINE_ORGANIZATION_ID, actorType: "vendor_link" as const, actorName: "ClearFlow secure store-visit link" };

function harness() {
  const repository = createOpsFixtureRepository(buildNorthlinePresentationFixture());
  let now = "2026-08-27T14:00:00.000Z";
  let sequence = 0;
  const services: OpsCommandServices = { repository, clock: { now: () => now }, ids: { next: (prefix) => `${prefix}-sweep-test-${++sequence}` } };
  return { repository, services, setNow(value: string) { now = value; } };
}

function createInput() {
  return {
    organizationId: NORTHLINE_ORGANIZATION_ID,
    storeId: "store-northline-104",
    vendorId: CEDAR,
    contractVersionId: CONTRACT,
    responseDueAt: "2026-09-02T21:00:00.000Z",
    accessRequirements: "Check in at the front counter.",
    work: [
      { workOrderId: DOOR },
      { workOrderId: SINK },
    ],
    publicToken: { tokenHash: TOKEN_HASH, expiresAt: "2026-09-02T21:00:00.000Z" },
    actor,
  };
}

describe("plain-language store sweeps", () => {
  it("sends approved jobs together without scheduling the vendor or making a savings claim", async () => {
    const test = harness();
    const result = await createStoreSweep(createInput(), test.services);
    const snapshot = test.repository.snapshot();
    const earliestReviewAt = [DOOR, SINK]
      .map((workOrderId) => snapshot.workOrderVisitHolds?.find((row) => row.workOrderId === workOrderId)?.deadlineAt)
      .filter((value): value is string => Boolean(value))
      .sort()[0];
    expect(result.run).toMatchObject({ status: "proposed", schedulerVersion: "store-sweep-v1", schedulingMode: "vendor_planned", neededByAt: earliestReviewAt, estimatedServiceMinutes: 0, capacityUsedMinutes: 0, estimatedTripReduction: 0, estimatedOpportunity: { amountMinor: 0, currency: "USD" } });
    expect(result.work.every((row) => row.estimatedDurationMinutes === 0)).toBe(true);
    expect(result.work).toHaveLength(2);
    expect(new Set(result.work.map((row) => row.workOrderId))).toEqual(new Set([DOOR, SINK]));
    for (const workOrderId of [DOOR, SINK]) {
      expect(snapshot.workOrders.find((row) => row.id === workOrderId)).toMatchObject({ status: "issued", nextAction: "Respond to jobs sent together" });
    }
    expect(snapshot.assignments.filter((row) => [DOOR, SINK].includes(row.workOrderId) && row.vendorId === CEDAR)).toHaveLength(2);
    expect(snapshot.issuances.filter((row) => [DOOR, SINK].includes(row.workOrderId))).toHaveLength(2);
    expect(snapshot.workOrderVisitHolds?.filter((row) => [DOOR, SINK].includes(row.workOrderId)).every((row) => row.status === "active")).toBe(true);
    expect(result.run.recommendationExplanation).toContain("Each job keeps its own work-order number");
  });

  it("accepts the visit, then claims every included hold only when the technician actually checks in", async () => {
    const test = harness();
    const result = await createStoreSweep(createInput(), test.services);
    test.setNow("2026-08-28T14:00:00.000Z");
    await respondToServiceRun({ tokenHash: TOKEN_HASH, response: "accepted", responderName: "Morgan Ellis", requestedStartsAt: "2026-09-08T13:00:00.000Z", actor: vendorActor }, test.services);
    let snapshot = test.repository.snapshot();
    expect(snapshot.serviceRuns.find((row) => row.id === result.run.id)).toMatchObject({ status: "committed", committedStartsAt: "2026-09-08T13:00:00.000Z" });
    for (const workOrderId of [DOOR, SINK]) {
      expect(snapshot.workOrders.find((row) => row.id === workOrderId)).toMatchObject({ status: "scheduled" });
    }
    expect(snapshot.assignments.filter((row) => [DOOR, SINK].includes(row.workOrderId)).every((row) => row.status === "accepted")).toBe(true);
    expect(snapshot.workOrderVisitHolds?.filter((row) => [DOOR, SINK].includes(row.workOrderId)).every((row) => row.status === "active")).toBe(true);

    test.setNow("2026-09-08T13:05:00.000Z");
    const visit = await checkInVisit(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: "store-northline-104",
      serviceRunId: result.run.id,
      workOrderIds: [DOOR, SINK],
      technicianName: "Morgan Ellis",
      purpose: "Complete the approved jobs in the planned store visit",
      channel: "secure_link",
      location: { result: "permission_denied", capturedAt: "2026-09-08T13:05:00.000Z" },
      actor: { organizationId: NORTHLINE_ORGANIZATION_ID, actorType: "technician", actorName: "Morgan Ellis" },
    });
    snapshot = test.repository.snapshot();
    expect(snapshot.workOrderVisitHolds?.filter((row) => [DOOR, SINK].includes(row.workOrderId)).every((row) => row.status === "claimed" && row.claimedVisitId === visit.id)).toBe(true);
    expect(visit.siteVisitWorkOrders.every((row) => row.selectionSource === "service_run" && row.workOrderHoldId)).toBe(true);
  });

  it("requires the vendor to supply the planned date instead of inheriting a customer-authored schedule", async () => {
    const test = harness();
    const result = await createStoreSweep(createInput(), test.services);
    test.setNow("2026-08-28T14:00:00.000Z");
    await expect(respondToServiceRun({
      tokenHash: TOKEN_HASH,
      response: "accepted",
      responderName: "Morgan Ellis",
      actor: vendorActor,
    }, test.services)).rejects.toThrow("vendor’s planned visit date is required");
    expect(test.repository.snapshot().serviceRuns.find((row) => row.id === result.run.id)?.status).toBe("proposed");
  });

  it("shows approved work without customer-authored visit times or duration allowances", async () => {
    const test = harness();
    await createStoreSweep(createInput(), test.services);
    const view = await buildServiceRunPublicView({ repository: test.repository, tokenHash: TOKEN_HASH, now: "2026-08-28T14:00:00.000Z" });
    expect(view).not.toBeNull();
    const markup = renderToStaticMarkup(createElement(ServiceRunResponsePage, { token: "demo-token", view: view! }));
    expect(markup).toContain("Approved jobs sent together");
    expect(markup).toContain("Your company chooses the date, crew, route, and time onsite");
    expect(markup).toContain("When does your company plan to visit?");
    expect(markup).not.toContain("planning allowance");
    expect(markup).not.toContain("Time reserved");
    expect(view!.responseOptions.some((option) => option.value === "countered")).toBe(false);
  });

  it("returns every job to the future-visit list when the vendor cannot take the visit", async () => {
    const test = harness();
    const result = await createStoreSweep(createInput(), test.services);
    test.setNow("2026-08-28T14:00:00.000Z");
    await respondToServiceRun({
      tokenHash: TOKEN_HASH,
      response: "insufficient_capacity",
      responderName: "Morgan Ellis",
      reasonCode: "capacity_limit",
      reasonDetail: "The crew is committed through the proposed week.",
      actor: vendorActor,
    }, test.services);
    const snapshot = test.repository.snapshot();
    expect(snapshot.serviceRuns.find((row) => row.id === result.run.id)?.status).toBe("declined");
    for (const workOrderId of [DOOR, SINK]) {
      expect(snapshot.workOrders.find((row) => row.id === workOrderId)).toMatchObject({ status: "approved", nextAction: "Approved for a future vendor visit" });
    }
    expect(snapshot.workOrderVisitHolds?.filter((row) => [DOOR, SINK].includes(row.workOrderId)).every((row) => row.status === "active")).toBe(true);
  });

  it("returns a removed job to its original hold while committing the retained job", async () => {
    const test = harness();
    const originalDeadline = (await test.repository.getWorkOrderVisitHold(NORTHLINE_ORGANIZATION_ID, SINK))!.deadlineAt;
    const result = await createStoreSweep(createInput(), test.services);
    test.setNow("2026-08-28T14:00:00.000Z");
    const response = await respondToServiceRun({
      tokenHash: TOKEN_HASH,
      response: "work_order_change_requested",
      responderName: "Morgan Ellis",
      requestedStartsAt: "2026-09-08T13:00:00.000Z",
      removeWorkOrderIds: [SINK],
      reasonCode: "scope_question",
      reasonDetail: "The plumbing technician can address the door hardware but not the faucet on this visit.",
      actor: vendorActor,
    }, test.services);
    test.setNow("2026-08-29T14:00:00.000Z");
    await acceptServiceRunCounter({ organizationId: NORTHLINE_ORGANIZATION_ID, serviceRunId: result.run.id, responseId: response.id, actor }, test.services);
    const snapshot = test.repository.snapshot();
    expect(snapshot.workOrders.find((row) => row.id === DOOR)).toMatchObject({ status: "scheduled" });
    expect(snapshot.workOrders.find((row) => row.id === SINK)).toMatchObject({ status: "approved", dueAt: originalDeadline, nextAction: "Approved for a future vendor visit" });
    expect(snapshot.serviceRunWorkOrders.find((row) => row.serviceRunId === result.run.id && row.workOrderId === SINK)).toMatchObject({ planned: false });
    expect(snapshot.workOrderVisitHolds?.find((row) => row.workOrderId === SINK)).toMatchObject({ status: "active", deadlineAt: originalDeadline });
  });
});
