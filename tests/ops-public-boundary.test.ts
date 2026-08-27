import { beforeEach, describe, expect, it } from "vitest";
import {
  PUBLIC_DEMO_LINKS,
  getPublicOperationsGateway,
} from "@/components/ops-public/server-gateway";
import {
  getNorthlineFixtureRepository,
  resetNorthlineFixtureRepository,
} from "@/lib/ops/fixture-repository";
import {
  NORTHLINE_DEMO_HANDLES,
  NORTHLINE_DEMO_TOKEN_HASHES,
  NORTHLINE_ORGANIZATION_ID,
} from "@/lib/ops/fixtures";
import { checkInVisit } from "@/lib/ops/commands";
import { requestEstimate } from "@/lib/ops/estimate-commands";

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

describe("public service and visit capability boundaries", () => {
  beforeEach(() => {
    resetNorthlineFixtureRepository();
  });

  it("renders immutable issuance terms even after live records change", async () => {
    const repository = getNorthlineFixtureRepository();
    await repository.atomicWrite([
      {
        sql: "UPDATE ops_work_orders SET problem = ?, authorized_scope = ?, priority = ? WHERE organization_id = ? AND id = ?",
        params: [
          "MUTATED LIVE PROBLEM",
          "MUTATED LIVE SCOPE",
          "routine",
          NORTHLINE_ORGANIZATION_ID,
          NORTHLINE_DEMO_HANDLES.publicServiceWorkOrderId,
        ],
      },
      {
        sql: "UPDATE ops_stores SET name = ?, address_1 = ? WHERE organization_id = ? AND id = ?",
        params: ["Mutated store", "999 Changed Road", NORTHLINE_ORGANIZATION_ID, NORTHLINE_DEMO_HANDLES.storyStoreId],
      },
      {
        sql: "UPDATE ops_vendors SET name = ? WHERE organization_id = ? AND id = ?",
        params: ["Mutated vendor", NORTHLINE_ORGANIZATION_ID, "vendor-northline-summit"],
      },
    ]);

    const authorization = await getPublicOperationsGateway().loadServiceAuthorization(PUBLIC_DEMO_LINKS.serviceToken);
    expect(authorization).not.toBeNull();
    expect(authorization?.operatorWorkOrderNumber).toBe("CPS-2026-0116");
    expect(authorization?.vendorName).toBe("ColdLine Refrigeration & HVAC");
    expect(authorization?.store).toMatchObject({
      number: "104",
      name: "Clark Pump and Shop - Ridgeview",
      address: "104 Ridgeview Drive, Ridgeview, MI 49031",
    });
    expect(authorization?.service.problem).toContain("Evaporator fan");
    expect(authorization?.service.requestedWork).toContain("Inspect the evaporator fan assembly");
    expect(authorization?.service.requestedWork).not.toMatch(/authorization limit|exceeding authorization|not-to-exceed|\bNTE\b/iu);
    expect(authorization?.authorization).not.toHaveProperty("notToExceedLabel");
    expect(authorization?.priority).toBe("Priority");
  });

  it("resolves the public token to one exact issuance and purpose", async () => {
    const repository = getNorthlineFixtureRepository();
    const authorization = await repository.getServiceAuthorizationByToken({
      tokenHash: NORTHLINE_DEMO_TOKEN_HASHES.serviceAuthorization104,
      purpose: "service_authorization",
      now: "2026-08-11T12:00:00.000Z",
    });
    const wrongPurpose = await repository.getServiceAuthorizationByToken({
      tokenHash: NORTHLINE_DEMO_TOKEN_HASHES.serviceAuthorization104,
      purpose: "store_gateway",
      now: "2026-08-11T12:00:00.000Z",
    });

    expect(authorization).toMatchObject({
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: NORTHLINE_DEMO_HANDLES.publicServiceWorkOrderId,
      issuanceId: "issuance-northline-104-issued-r1",
      revision: 1,
      vendor: { id: "vendor-northline-summit" },
    });
    expect(wrongPurpose).toBeNull();
  });

  it("keeps page loads read-only and records one explicit vendor opening without treating it as acceptance", async () => {
    const repository = getNorthlineFixtureRepository();
    const gateway = getPublicOperationsGateway();

    expect(await gateway.loadServiceAuthorization(PUBLIC_DEMO_LINKS.serviceToken)).toMatchObject({ opened: false });
    expect(await gateway.loadServiceAuthorization(PUBLIC_DEMO_LINKS.serviceToken)).toMatchObject({ opened: false });

    const beforeOpen = await repository.getActiveAssignment(
      NORTHLINE_ORGANIZATION_ID,
      NORTHLINE_DEMO_HANDLES.publicServiceWorkOrderId,
    );
    expect(beforeOpen?.status).toBe("issued");
    expect(repository.snapshot().auditEvents.filter((event) => event.eventType === "service_authorization.opened")).toHaveLength(0);

    await gateway.openServiceAuthorization(PUBLIC_DEMO_LINKS.serviceToken);
    await gateway.openServiceAuthorization(PUBLIC_DEMO_LINKS.serviceToken);
    expect(await gateway.loadServiceAuthorization(PUBLIC_DEMO_LINKS.serviceToken)).toMatchObject({ opened: true });

    const assignment = await repository.getActiveAssignment(
      NORTHLINE_ORGANIZATION_ID,
      NORTHLINE_DEMO_HANDLES.publicServiceWorkOrderId,
    );
    const workOrder = await repository.getWorkOrder(
      NORTHLINE_ORGANIZATION_ID,
      NORTHLINE_DEMO_HANDLES.publicServiceWorkOrderId,
    );
    expect(assignment?.status).toBe("opened");
    expect(workOrder?.status).toBe("issued");
    expect(repository.snapshot().vendorResponses.filter((response) => response.assignmentId === assignment?.id)).toHaveLength(0);
    expect(repository.snapshot().auditEvents.filter((event) => (
      event.aggregateId === workOrder?.id && event.eventType === "service_authorization.opened"
    ))).toHaveLength(1);
  });

  it("lets a vendor submit non-billable bid evidence through an account-free link", async () => {
    const repository = getNorthlineFixtureRepository();
    const gateway = getPublicOperationsGateway();
    const rawToken = "estimateBoundaryToken_1234567890abcdefghijklmno";
    const workOrderId = NORTHLINE_DEMO_HANDLES.publicServiceWorkOrderId;
    const countsBefore = {
      workOrders: repository.snapshot().workOrders.length,
      costs: repository.snapshot().costLines.length,
      invoices: repository.snapshot().invoiceReferences.length,
    };
    await repository.atomicWrite([{
      sql: "UPDATE ops_work_order_assignments SET status = ? WHERE organization_id = ? AND id = ?",
      params: ["pending", NORTHLINE_ORGANIZATION_ID, "assignment-northline-104-issued"],
    }]);
    await requestEstimate(
      { repository },
      {
        organizationId: NORTHLINE_ORGANIZATION_ID,
        workOrderId,
        vendorId: "vendor-northline-cedar",
        kind: "estimate_only",
        requestedScope: "Price the evaporator fan repair without authorizing the repair.",
        channel: "email",
        dueAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        publicToken: {
          tokenHash: await sha256Hex(rawToken),
          expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        },
        actor: {
          actorType: "user",
          actorId: "membership-northline-facilities",
          actorName: "Jordan Lee",
          organizationId: NORTHLINE_ORGANIZATION_ID,
        },
      },
    );

    expect(await gateway.loadVendorEstimate(rawToken)).toMatchObject({ status: "requested", canRespond: false });
    await gateway.openVendorEstimate(rawToken);
    const opened = await gateway.loadVendorEstimate(rawToken);
    expect(opened).toMatchObject({
      vendorName: "ClearFlow HVAC, Plumbing & Kitchen Repair",
      operatorWorkOrderNumber: "CPS-2026-0116",
      status: "opened",
      canRespond: true,
    });
    const receipt = await gateway.submitVendorEstimate(rawToken, {
      responderName: "Taylor Vendor",
      expectedRevision: 0,
      amount: "1825.00",
      scope: "Replace the fan motor and verify box temperature.",
      exclusions: "Electrical feed repairs excluded.",
      leadTimeDays: 2,
      validUntil: new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10),
    });
    expect(receipt.heading).toBe("Bid received");
    expect(receipt.message).toMatch(/pricing evidence only.*does not assign work.*travel, check-in, service, or billing/i);
    expect(await gateway.loadVendorEstimate(rawToken)).toMatchObject({
      status: "submitted",
      statusLabel: "Bid submitted",
      requestKindLabel: "Bid request - pricing only",
      latestProposal: { revision: 1 },
    });
    expect((await gateway.loadVendorEstimate(rawToken))?.latestProposal?.amountLabel).toContain("$1,825.00");
    expect(repository.snapshot().workOrders).toHaveLength(countsBefore.workOrders);
    expect(repository.snapshot().costLines).toHaveLength(countsBefore.costs);
    expect(repository.snapshot().invoiceReferences).toHaveLength(countsBefore.invoices);
  });

  it("presents an unanswered past-due bid link as expired and read-only", async () => {
    const repository = getNorthlineFixtureRepository();
    const gateway = getPublicOperationsGateway();
    const rawToken = "expiredEstimateBoundaryToken_1234567890abcdefgh";
    await repository.atomicWrite([{
      sql: "UPDATE ops_work_order_assignments SET status = ? WHERE organization_id = ? AND id = ?",
      params: ["pending", NORTHLINE_ORGANIZATION_ID, "assignment-northline-104-issued"],
    }]);
    const created = await requestEstimate(
      { repository },
      {
        organizationId: NORTHLINE_ORGANIZATION_ID,
        workOrderId: NORTHLINE_DEMO_HANDLES.publicServiceWorkOrderId,
        vendorId: "vendor-northline-cedar",
        kind: "estimate_only",
        requestedScope: "Price the evaporator fan repair without authorizing onsite work.",
        channel: "email",
        dueAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        publicToken: {
          tokenHash: await sha256Hex(rawToken),
          expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        },
        actor: {
          actorType: "user",
          actorId: "membership-northline-facilities",
          actorName: "Jordan Lee",
          organizationId: NORTHLINE_ORGANIZATION_ID,
        },
      },
    );
    await repository.atomicWrite([{
      sql: "UPDATE ops_work_order_estimate_requests SET due_at = ? WHERE organization_id = ? AND id = ?",
      params: ["2020-01-01T12:00:00.000Z", NORTHLINE_ORGANIZATION_ID, created.request.id],
    }]);
    const beforeLoad = repository.snapshot();

    await expect(gateway.loadVendorEstimate(rawToken)).resolves.toMatchObject({
      status: "expired",
      statusLabel: "Expired",
      canRespond: false,
    });
    expect(repository.snapshot()).toEqual(beforeLoad);
  });

  it("exposes both seeded Store 105 estimates through deterministic vendor links", async () => {
    const gateway = getPublicOperationsGateway();
    const repository = getNorthlineFixtureRepository();

    expect(await sha256Hex(PUBLIC_DEMO_LINKS.estimate105SummitToken)).toBe(NORTHLINE_DEMO_TOKEN_HASHES.estimate105Summit);
    expect(await sha256Hex(PUBLIC_DEMO_LINKS.estimate105CedarToken)).toBe(NORTHLINE_DEMO_TOKEN_HASHES.estimate105Cedar);

    await expect(gateway.loadVendorEstimate(PUBLIC_DEMO_LINKS.estimate105SummitToken)).resolves.toMatchObject({
      vendorName: "ColdLine Refrigeration & HVAC",
      operatorWorkOrderNumber: "CPS-2026-0117",
      status: "submitted",
      canRespond: false,
      latestProposal: { revision: 1, amountLabel: "$2,450.00" },
    });
    await expect(gateway.loadVendorEstimate(PUBLIC_DEMO_LINKS.estimate105CedarToken)).resolves.toMatchObject({
      vendorName: "ClearFlow HVAC, Plumbing & Kitchen Repair",
      operatorWorkOrderNumber: "CPS-2026-0117",
      status: "submitted",
      canRespond: false,
      latestProposal: { revision: 1, amountLabel: "$1,780.00" },
    });

    expect(repository.snapshot().publicTokens.filter((token) => token.purpose === "vendor_estimate")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          subjectType: "work_order_estimate_request",
          subjectId: "estimate-request-105-summit",
          tokenHash: NORTHLINE_DEMO_TOKEN_HASHES.estimate105Summit,
        }),
        expect.objectContaining({
          subjectType: "work_order_estimate_request",
          subjectId: "estimate-request-105-cedar",
          tokenHash: NORTHLINE_DEMO_TOKEN_HASHES.estimate105Cedar,
        }),
      ]),
    );
  });

  it("creates a visit-bound checkout capability and rejects generic or cross-vendor use", async () => {
    const gateway = getPublicOperationsGateway();
    const vendorId = "vendor-northline-summit";
    const receipt = await gateway.checkIn(PUBLIC_DEMO_LINKS.storeToken, {
      submissionKey: "boundary-visit-capability-check-in",
      vendorId,
      noWorkOrderReason: "Vendor dispatch did not provide the operator work-order number",
      technicianName: "Contract Test Technician",
      location: { captureResult: "permission_denied" },
    });
    const checkoutToken = receipt.checkoutUrl.split("/public/store/")[1]?.split("/")[0];

    expect(checkoutToken).toBeTruthy();
    expect(checkoutToken).not.toBe(PUBLIC_DEMO_LINKS.storeToken);
    const genericContext = await gateway.lookupVendorVisitContext(PUBLIC_DEMO_LINKS.storeToken, vendorId);
    expect(genericContext.activeVisits).toEqual([]);

    await expect(
      gateway.checkOut(PUBLIC_DEMO_LINKS.storeToken, {
        submissionKey: "boundary-generic-link-checkout-rejected",
        vendorId,
        visitId: receipt.visitId,
        outcome: "resolved",
        location: { captureResult: "permission_denied" },
        evidence: [],
      }),
    ).rejects.toMatchObject({ code: "visit_token_required", status: 403 });

    const checkoutPortal = await gateway.loadStorePortal(checkoutToken!);
    expect(checkoutPortal?.capabilities).toEqual({
      reportIssue: false,
      startVisit: false,
      finishVisit: true,
    });
    const isolatedContext = await gateway.lookupVendorVisitContext(checkoutToken!, vendorId);
    expect(isolatedContext.activeVisits.map((visit) => visit.id)).toEqual([receipt.visitId]);
    await expect(
      gateway.lookupVendorVisitContext(checkoutToken!, "vendor-northline-cedar"),
    ).rejects.toMatchObject({ code: "vendor_not_available", status: 403 });

    const checkout = await gateway.checkOut(checkoutToken!, {
      submissionKey: "boundary-visit-capability-checkout",
      vendorId,
      visitId: receipt.visitId,
      outcome: "resolved",
      location: { captureResult: "permission_denied" },
      evidence: [],
    });
    expect(checkout.visitId).toBe(receipt.visitId);
    expect(checkout.heading).toBe("Checkout received");
    expect(await gateway.loadStorePortal(checkoutToken!)).toBeNull();
  }, 30_000);

  it("lets a trusted store device start or finish only visits at its own store", async () => {
    const gateway = getPublicOperationsGateway();
    const vendorId = "vendor-northline-summit";
    const portal = await gateway.loadStorePortal(PUBLIC_DEMO_LINKS.trustedStoreToken);

    expect(portal).toMatchObject({
      trustedStoreDevice: true,
      store: { number: "104" },
      locationPolicy: { enabled: false },
      capabilities: { reportIssue: true, startVisit: true, finishVisit: true },
      visitChannel: "store_device",
    });
    expect(portal?.vendors.some((vendor) => vendor.id === vendorId)).toBe(true);

    const workContext = await gateway.lookupVendorVisitContext(PUBLIC_DEMO_LINKS.trustedStoreToken, vendorId);
    expect(workContext.eligibleWorkOrders.some((work) => work.number === "CPS-2026-0116")).toBe(true);

    const checkIn = await gateway.checkIn(PUBLIC_DEMO_LINKS.trustedStoreToken, {
      submissionKey: "boundary-trusted-store-check-in",
      vendorId,
      noWorkOrderReason: "Emergency compressor follow-up requested directly by the store",
      technicianName: "Taylor Morgan",
      location: { captureResult: "not_requested" },
    });
    expect(checkIn.location.label).toBe("Recorded on this trusted store device");

    const activeContext = await gateway.lookupVendorVisitContext(PUBLIC_DEMO_LINKS.trustedStoreToken, vendorId);
    expect(activeContext.activeVisits.map((visit) => visit.id)).toContain(checkIn.visitId);

    const otherStorePortal = await gateway.loadStorePortal(PUBLIC_DEMO_LINKS.activeVisitToken);
    const otherStoreVendorId = otherStorePortal?.vendors[0]?.id;
    expect(otherStoreVendorId).toBeTruthy();
    const otherStoreContext = await gateway.lookupVendorVisitContext(PUBLIC_DEMO_LINKS.activeVisitToken, otherStoreVendorId!);
    await expect(gateway.checkOut(PUBLIC_DEMO_LINKS.trustedStoreToken, {
      submissionKey: "boundary-cross-store-checkout-rejected",
      vendorId: otherStoreVendorId!,
      visitId: otherStoreContext.activeVisits[0]!.id,
      outcome: "resolved",
      location: { captureResult: "not_requested" },
      evidence: [],
    })).rejects.toMatchObject({ code: "visit_not_available", status: 403 });

    const checkout = await gateway.checkOut(PUBLIC_DEMO_LINKS.trustedStoreToken, {
      submissionKey: "boundary-trusted-store-checkout",
      vendorId,
      visitId: checkIn.visitId,
      outcome: "resolved",
      outcomeNotes: "Store device checkout completed at the service counter.",
      location: { captureResult: "not_requested" },
      evidence: [],
    });
    expect(checkout.location.label).toBe("Recorded on this trusted store device");
    expect((await gateway.lookupVendorVisitContext(PUBLIC_DEMO_LINKS.trustedStoreToken, vendorId)).activeVisits).toEqual([]);
  }, 30_000);

  it("keeps pending outside-vendor assignments out of check-in until service is issued", async () => {
    const gateway = getPublicOperationsGateway();
    const repository = getNorthlineFixtureRepository();
    const vendorId = "vendor-northline-summit";
    const workOrderId = NORTHLINE_DEMO_HANDLES.publicServiceWorkOrderId;
    await repository.atomicWrite([
      {
        sql: "UPDATE ops_work_order_assignments SET status = ? WHERE organization_id = ? AND work_order_id = ? AND vendor_id = ?",
        params: ["pending", NORTHLINE_ORGANIZATION_ID, workOrderId, vendorId],
      },
      {
        sql: "UPDATE ops_work_orders SET status = ? WHERE organization_id = ? AND id = ?",
        params: ["approved", NORTHLINE_ORGANIZATION_ID, workOrderId],
      },
    ]);

    const context = await gateway.lookupVendorVisitContext(PUBLIC_DEMO_LINKS.storeToken, vendorId);
    expect(context.eligibleWorkOrders.map((work) => work.id)).not.toContain(workOrderId);
    await expect(checkInVisit({ repository }, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: NORTHLINE_DEMO_HANDLES.storyStoreId,
      vendorId,
      workOrderId,
      technicianName: "Pending Assignment Technician",
      purpose: "Attempted visit before service authorization issuance",
      channel: "qr",
      location: { result: "permission_denied", capturedAt: new Date().toISOString() },
      actor: {
        actorType: "technician",
        actorName: "Pending Assignment Technician",
        organizationId: NORTHLINE_ORGANIZATION_ID,
      },
    })).rejects.toMatchObject({ code: "CONFLICT" });

    await repository.atomicWrite([
      {
        sql: "UPDATE ops_work_order_assignments SET status = ? WHERE organization_id = ? AND work_order_id = ? AND vendor_id = ?",
        params: ["issued", NORTHLINE_ORGANIZATION_ID, workOrderId, vendorId],
      },
      {
        sql: "UPDATE ops_work_orders SET status = ? WHERE organization_id = ? AND id = ?",
        params: ["issued", NORTHLINE_ORGANIZATION_ID, workOrderId],
      },
    ]);
    const issuedContext = await gateway.lookupVendorVisitContext(PUBLIC_DEMO_LINKS.storeToken, vendorId);
    expect(issuedContext.eligibleWorkOrders.map((work) => work.id)).toContain(workOrderId);
  });

  it("records could-not-reproduce as a clear outcome with accountable manager review", async () => {
    const gateway = getPublicOperationsGateway();
    const repository = getNorthlineFixtureRepository();
    const vendorId = "vendor-northline-summit";
    const checkIn = await gateway.checkIn(PUBLIC_DEMO_LINKS.serviceToken, {
      submissionKey: "boundary-unable-to-reproduce-check-in",
      vendorId,
      workOrderId: NORTHLINE_DEMO_HANDLES.publicServiceWorkOrderId,
      technicianName: "Outcome Test Technician",
      location: { captureResult: "permission_denied" },
    });
    const checkoutToken = checkIn.checkoutUrl.split("/public/store/")[1]?.split("/")[0];
    const checkout = await gateway.checkOut(checkoutToken!, {
      submissionKey: "boundary-unable-to-reproduce-checkout",
      vendorId,
      visitId: checkIn.visitId,
      outcome: "unable_to_reproduce",
      outcomeNotes: "Fan ran normally through three cycles; grinding sound did not recur.",
      location: { captureResult: "permission_denied" },
      evidence: [],
    });

    expect(checkout.outcomeLabel).toBe("Could not reproduce reported issue");
    expect(checkout.followUpLabel).toMatch(/Facilities coordinator now owns/i);
    expect(await repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, NORTHLINE_DEMO_HANDLES.publicServiceWorkOrderId)).toMatchObject({
      status: "waiting_on_vendor",
      accountableParty: "Facilities coordinator",
      nextAction: "Review the unable-to-reproduce outcome and decide whether to monitor, reassign, or close",
    });
  });

  it("keeps completed work in manager review instead of reopening it through an old authorization", async () => {
    const gateway = getPublicOperationsGateway();
    const repository = getNorthlineFixtureRepository();
    const vendorId = "vendor-northline-summit";
    const workOrderId = NORTHLINE_DEMO_HANDLES.publicServiceWorkOrderId;
    const checkIn = await gateway.checkIn(PUBLIC_DEMO_LINKS.serviceToken, {
      submissionKey: "boundary-completed-work-check-in",
      vendorId,
      workOrderId,
      technicianName: "Completion Boundary Technician",
      location: { captureResult: "permission_denied" },
    });
    const checkoutToken = checkIn.checkoutUrl.split("/public/store/")[1]?.split("/")[0];

    await gateway.checkOut(checkoutToken!, {
      submissionKey: "boundary-completed-work-check-out",
      vendorId,
      visitId: checkIn.visitId,
      outcome: "resolved",
      outcomeNotes: "Repair completed and operating normally.",
      location: { captureResult: "permission_denied" },
      evidence: [],
    });

    expect(await repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, workOrderId)).toMatchObject({
      status: "completed_pending_review",
    });
    expect(await gateway.loadServiceAuthorization(PUBLIC_DEMO_LINKS.serviceToken)).toBeNull();
    expect(await repository.getServiceAuthorizationByToken({
      tokenHash: NORTHLINE_DEMO_TOKEN_HASHES.serviceAuthorization104,
      purpose: "service_authorization",
      now: new Date().toISOString(),
    })).toBeNull();

    const storeContext = await gateway.lookupVendorVisitContext(PUBLIC_DEMO_LINKS.storeToken, vendorId);
    expect(storeContext.eligibleWorkOrders.map((work) => work.id)).not.toContain(workOrderId);
    await expect(gateway.checkIn(PUBLIC_DEMO_LINKS.storeToken, {
      submissionKey: "boundary-completed-work-reopen-attempt",
      vendorId,
      workOrderId,
      technicianName: "Completion Boundary Technician",
      location: { captureResult: "permission_denied" },
    })).rejects.toMatchObject({ code: "work_order_not_eligible", status: 403 });

    await expect(checkInVisit({ repository }, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: NORTHLINE_DEMO_HANDLES.storyStoreId,
      vendorId,
      workOrderId,
      technicianName: "Completion Boundary Technician",
      purpose: "Attempt to reopen completed work without manager review.",
      channel: "secure_link",
      location: { result: "permission_denied", capturedAt: new Date().toISOString() },
      actor: {
        actorType: "technician",
        actorName: "Completion Boundary Technician",
        organizationId: NORTHLINE_ORGANIZATION_ID,
      },
    })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
