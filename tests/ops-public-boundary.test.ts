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
    expect(authorization?.operatorWorkOrderNumber).toBe("NL-2026-0116");
    expect(authorization?.vendorName).toBe("Summit Refrigeration");
    expect(authorization?.store).toMatchObject({
      number: "104",
      name: "Northline Ridgeview",
      address: "104 Ridgeview Drive, Ridgeview, MI 49031",
    });
    expect(authorization?.service.problem).toContain("Evaporator fan");
    expect(authorization?.service.requestedWork).toContain("Inspect the evaporator fan assembly");
    expect(authorization?.authorization.notToExceedLabel).toContain("$1,750.00");
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

  it("creates a visit-bound checkout capability and rejects generic or cross-vendor use", async () => {
    const gateway = getPublicOperationsGateway();
    const vendorId = "vendor-northline-summit";
    const receipt = await gateway.checkIn(PUBLIC_DEMO_LINKS.storeToken, {
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
      vendorId,
      visitId: receipt.visitId,
      outcome: "resolved",
      location: { captureResult: "permission_denied" },
      evidence: [],
    });
    expect(checkout.visitId).toBe(receipt.visitId);
    expect(checkout.heading).toBe("Checkout received");
    expect(await gateway.loadStorePortal(checkoutToken!)).toBeNull();
  });

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
    expect(workContext.eligibleWorkOrders.some((work) => work.number === "NL-2026-0116")).toBe(true);

    const checkIn = await gateway.checkIn(PUBLIC_DEMO_LINKS.trustedStoreToken, {
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
      vendorId: otherStoreVendorId!,
      visitId: otherStoreContext.activeVisits[0]!.id,
      outcome: "resolved",
      location: { captureResult: "not_requested" },
      evidence: [],
    })).rejects.toMatchObject({ code: "visit_not_available", status: 403 });

    const checkout = await gateway.checkOut(PUBLIC_DEMO_LINKS.trustedStoreToken, {
      vendorId,
      visitId: checkIn.visitId,
      outcome: "resolved",
      outcomeNotes: "Store device checkout completed at the service counter.",
      location: { captureResult: "not_requested" },
      evidence: [],
    });
    expect(checkout.location.label).toBe("Recorded on this trusted store device");
    expect((await gateway.lookupVendorVisitContext(PUBLIC_DEMO_LINKS.trustedStoreToken, vendorId)).activeVisits).toEqual([]);
  });
});
