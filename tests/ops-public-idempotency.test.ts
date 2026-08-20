import { beforeEach, describe, expect, it } from "vitest";
import {
  PUBLIC_DEMO_LINKS,
  getPublicOperationsGateway,
} from "@/components/ops-public/server-gateway";
import { readPublicIdempotencyKey } from "@/components/ops-public/server-http";
import {
  getNorthlineFixtureRepository,
  resetNorthlineFixtureRepository,
} from "@/lib/ops/fixture-repository";
import {
  NORTHLINE_DEMO_HANDLES,
  NORTHLINE_ORGANIZATION_ID,
} from "@/lib/ops/fixtures";

describe("public technician action idempotency", () => {
  beforeEach(() => {
    resetNorthlineFixtureRepository();
  });

  it("replays one committed check-in without creating another visit", async () => {
    const gateway = getPublicOperationsGateway();
    const repository = getNorthlineFixtureRepository();
    const submissionKey = "idem-check-in-network-retry-0001";
    const command = {
      submissionKey,
      vendorId: "vendor-northline-summit",
      noWorkOrderReason: "Emergency service call arrived without the operator work-order number",
      technicianName: "Idempotency Check-In Tech",
      location: { captureResult: "permission_denied" as const },
    };
    const visitCountBefore = repository.snapshot().visits.length;

    const first = await gateway.checkIn(PUBLIC_DEMO_LINKS.storeToken, command);
    const retry = await gateway.checkIn(PUBLIC_DEMO_LINKS.storeToken, command);
    const snapshot = repository.snapshot();

    expect(retry).toMatchObject({
      replayed: true,
      receiptId: first.receiptId,
      visitId: first.visitId,
      checkedInAt: first.checkedInAt,
      receivedAt: first.receivedAt,
    });
    expect(retry.checkoutUrl).toBe(first.checkoutUrl);
    expect(snapshot.visits).toHaveLength(visitCountBefore + 1);
    expect(snapshot.visitEvidence.filter((row) => row.visitId === first.visitId && row.kind === "check_in")).toHaveLength(1);
    expect(snapshot.auditEvents.filter((row) => row.aggregateId === first.visitId && row.eventType === "visit.checked_in")).toHaveLength(1);
    expect(snapshot.auditEvents.filter((row) => row.aggregateId === first.visitId && row.eventType === "visit.checkout_token_issued")).toHaveLength(1);

    const stored = await repository.getIdempotencyKey(NORTHLINE_ORGANIZATION_ID, submissionKey);
    expect(stored).toMatchObject({
      organizationId: NORTHLINE_ORGANIZATION_ID,
      command: "public_technician_check_in",
      resultId: first.visitId,
    });
    expect(stored?.requestHash).toMatch(/^[a-f0-9]{64}$/);
    expect(await repository.getIdempotencyKey("organization-outside-tenant", submissionKey)).toBeNull();
  });

  it("rejects reuse of a check-in key for edited visit details", async () => {
    const gateway = getPublicOperationsGateway();
    const submissionKey = "idem-check-in-conflicting-edit-0001";
    const base = {
      submissionKey,
      vendorId: "vendor-northline-summit",
      noWorkOrderReason: "Vendor did not receive an operator work-order number",
      technicianName: "Original Technician",
      location: { captureResult: "permission_denied" as const },
    };

    await gateway.checkIn(PUBLIC_DEMO_LINKS.storeToken, base);

    await expect(gateway.checkIn(PUBLIC_DEMO_LINKS.storeToken, {
      ...base,
      technicianName: "Edited Technician",
    })).rejects.toMatchObject({ status: 409, code: "idempotency_conflict" });
  });

  it("collapses concurrent identical check-ins onto one visit", async () => {
    const gateway = getPublicOperationsGateway();
    const repository = getNorthlineFixtureRepository();
    const command = {
      submissionKey: "idem-concurrent-check-in-race-0001",
      vendorId: "vendor-northline-summit",
      noWorkOrderReason: "Concurrent browser retry without an operator work-order number",
      technicianName: "Concurrent Retry Technician",
      location: { captureResult: "permission_denied" as const },
    };
    const visitCountBefore = repository.snapshot().visits.length;

    const [left, right] = await Promise.all([
      gateway.checkIn(PUBLIC_DEMO_LINKS.storeToken, command),
      gateway.checkIn(PUBLIC_DEMO_LINKS.storeToken, command),
    ]);
    const snapshot = repository.snapshot();

    expect(left.visitId).toBe(right.visitId);
    expect([left.replayed, right.replayed].filter(Boolean)).toHaveLength(1);
    expect(snapshot.visits).toHaveLength(visitCountBefore + 1);
    expect(snapshot.auditEvents.filter((row) => row.aggregateId === left.visitId && row.eventType === "visit.checked_in")).toHaveLength(1);
  });

  it("replays checkout through the now-closed visit link without duplicating evidence or follow-up", async () => {
    const gateway = getPublicOperationsGateway();
    const repository = getNorthlineFixtureRepository();
    const vendorId = "vendor-northline-summit";
    const checkInCommand = {
      submissionKey: "idem-checkout-prerequisite-check-in",
      vendorId,
      workOrderId: NORTHLINE_DEMO_HANDLES.publicServiceWorkOrderId,
      technicianName: "Idempotency Checkout Tech",
      location: { captureResult: "permission_denied" as const },
    };
    const checkIn = await gateway.checkIn(PUBLIC_DEMO_LINKS.serviceToken, checkInCommand);
    const checkoutToken = checkIn.checkoutUrl.split("/public/store/")[1]?.split("/")[0];
    expect(checkoutToken).toBeTruthy();

    const submissionKey = "idem-checkout-network-retry-0001";
    const command = {
      submissionKey,
      vendorId,
      visitId: checkIn.visitId,
      outcome: "return_required" as const,
      outcomeNotes: "A return visit is required after replacement parts arrive.",
      location: { captureResult: "permission_denied" as const },
      evidence: [],
    };

    const first = await gateway.checkOut(checkoutToken!, command);
    expect(await gateway.loadStorePortal(checkoutToken!)).toBeNull();
    const retry = await gateway.checkOut(checkoutToken!, command);
    const snapshot = repository.snapshot();

    expect(retry).toMatchObject({
      replayed: true,
      receiptId: first.receiptId,
      visitId: first.visitId,
      checkedOutAt: first.checkedOutAt,
      receivedAt: first.receivedAt,
      observedDurationMinutes: first.observedDurationMinutes,
    });
    expect(snapshot.visitEvidence.filter((row) => row.visitId === checkIn.visitId && row.kind === "check_out")).toHaveLength(1);
    expect(snapshot.followUps.filter((row) => row.sourceVisitId === checkIn.visitId)).toHaveLength(1);
    expect(snapshot.auditEvents.filter((row) => row.aggregateId === checkIn.visitId && row.eventType === "visit.checked_out")).toHaveLength(1);
    expect(await repository.getIdempotencyKey(NORTHLINE_ORGANIZATION_ID, submissionKey)).toMatchObject({
      command: "public_technician_check_out",
      resultId: checkIn.visitId,
    });

    const lateCheckInRetry = await gateway.checkIn(PUBLIC_DEMO_LINKS.serviceToken, checkInCommand);
    expect(lateCheckInRetry).toMatchObject({
      replayed: true,
      receiptId: checkIn.receiptId,
      visitId: checkIn.visitId,
      checkoutUrl: checkIn.checkoutUrl,
    });
    expect(repository.snapshot().auditEvents.filter((row) => row.aggregateId === checkIn.visitId && row.eventType === "visit.checkout_token_issued")).toHaveLength(1);

    await expect(gateway.checkOut(checkoutToken!, {
      ...command,
      outcome: "resolved",
    })).rejects.toMatchObject({ status: 409, code: "idempotency_conflict" });
  });
});

describe("public store issue idempotency", () => {
  beforeEach(() => {
    resetNorthlineFixtureRepository();
  });

  function issueCommand(submissionKey: string) {
    return {
      submissionKey,
      reporterName: "Network Retry Reporter",
      employeeId: "NFM-RETRY-1",
      problem: "The back-room cooler is warm and making a grinding sound.",
      urgency: "priority" as const,
      area: "Back-room cooler",
      impact: {
        storeOperatingState: "partially_operational" as const,
        safetyConcern: "none_reported" as const,
        productInventoryRisk: "at_risk" as const,
        customersAffected: "yes" as const,
      },
      evidence: [],
    };
  }

  it("replays a committed issue after the caller loses the first response", async () => {
    const gateway = getPublicOperationsGateway();
    const repository = getNorthlineFixtureRepository();
    const command = issueCommand("idem-store-issue-timeout-retry-0001");
    const before = repository.snapshot();

    const first = await gateway.reportStoreIssue(PUBLIC_DEMO_LINKS.storeToken, command);
    const retry = await gateway.reportStoreIssue(PUBLIC_DEMO_LINKS.storeToken, command);
    const snapshot = repository.snapshot();
    const created = snapshot.requests.filter((request) => request.reporterName === command.reporterName);

    expect(retry).toMatchObject({ replayed: true, receiptId: first.receiptId, requestNumber: first.requestNumber, receivedAt: first.receivedAt });
    expect(created).toHaveLength(1);
    expect(snapshot.requests).toHaveLength(before.requests.length + 1);
    expect(snapshot.requestImpactAssessments.filter((assessment) => assessment.requestId === created[0]!.id)).toHaveLength(1);
    expect(snapshot.workflowTasks.filter((task) => task.serviceRequestId === created[0]!.id)).toHaveLength(1);
    expect(snapshot.auditEvents.filter((event) => event.aggregateId === created[0]!.id && event.eventType === "request.submitted")).toHaveLength(1);
    expect(await repository.getIdempotencyKey(NORTHLINE_ORGANIZATION_ID, command.submissionKey)).toMatchObject({
      command: "public_store_issue_report",
      resultId: created[0]!.id,
    });
    expect(await repository.getIdempotencyKey("organization-outside-tenant", command.submissionKey)).toBeNull();
  });

  it("collapses concurrent identical issue submissions onto one request", async () => {
    const gateway = getPublicOperationsGateway();
    const repository = getNorthlineFixtureRepository();
    const command = issueCommand("idem-store-issue-concurrent-retry-0001");
    const requestCountBefore = repository.snapshot().requests.length;

    const [left, right] = await Promise.all([
      gateway.reportStoreIssue(PUBLIC_DEMO_LINKS.storeToken, command),
      gateway.reportStoreIssue(PUBLIC_DEMO_LINKS.storeToken, command),
    ]);

    expect(left.requestNumber).toBe(right.requestNumber);
    expect([left.replayed, right.replayed].filter(Boolean)).toHaveLength(1);
    expect(repository.snapshot().requests).toHaveLength(requestCountBefore + 1);
  });

  it("rejects reuse of an issue key for edited report details", async () => {
    const gateway = getPublicOperationsGateway();
    const command = issueCommand("idem-store-issue-conflicting-edit-0001");
    await gateway.reportStoreIssue(PUBLIC_DEMO_LINKS.storeToken, command);

    await expect(gateway.reportStoreIssue(PUBLIC_DEMO_LINKS.storeToken, {
      ...command,
      problem: "The edited report describes a different problem.",
    })).rejects.toMatchObject({ status: 409, code: "idempotency_conflict" });
  });
});

describe("public idempotency header boundary", () => {
  it("requires a sufficiently strong client submission key", () => {
    expect(readPublicIdempotencyKey(new Request("https://operations.example/check-in", {
      headers: { "idempotency-key": "browser-submit-uuid-0001" },
    }))).toBe("browser-submit-uuid-0001");

    expect(() => readPublicIdempotencyKey(new Request("https://operations.example/check-in")))
      .toThrowError(expect.objectContaining({ status: 422, code: "invalid_idempotency_key" }));
  });
});
