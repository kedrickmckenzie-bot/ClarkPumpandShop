import { describe, expect, it, vi } from "vitest";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import { createNotificationEmailTransport, createResendEmailProvider, notificationEventForTopic, sendVendorServiceAuthorizationEmail, type TransactionalEmail } from "@/lib/ops/email-delivery";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { importTemplate, parseCsv, previewImport } from "@/lib/ops/import-preview";

describe("transactional email and onboarding previews", () => {
  it("sends a vendor authorization through Resend with an idempotency key", async () => {
    let captured: RequestInit | undefined;
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => { captured = init; return new Response(JSON.stringify({ id: "email-123" }), { status: 200 }); });
    const fixture = buildNorthlinePresentationFixture();
    const workOrder = fixture.workOrders[0]!;
    const result = await sendVendorServiceAuthorizationEmail({ provider: createResendEmailProvider({ apiKey: "secret", from: "Operations <ops@example.com>", fetcher: fetcher as typeof fetch }), vendorEmail: "dispatch@example.com", vendorName: "Example Vendor", organizationName: "Clark Pump and Shop", workOrder, storeLabel: "Store 101 · Northline", actionUrl: "https://example.com/public/service/token", issuanceId: "issuance-1" });
    expect(result.messageId).toBe("email-123");
    expect(fetcher).toHaveBeenCalledOnce();
    expect(captured?.headers).toMatchObject({ "Idempotency-Key": "service-authorization/issuance-1/dispatch@example.com" });
    expect(String(captured?.body)).toContain(workOrder.number);
  });

  it("routes accepted multi-store PM and reactive work to Maintenance and only the affected store and region", async () => {
    const fixture = buildNorthlinePresentationFixture();
    const run = fixture.serviceRuns.find((candidate) => fixture.serviceRunWorkOrders.some((link) => link.serviceRunId === candidate.id && link.occurrenceId) && fixture.serviceRunWorkOrders.some((link) => link.serviceRunId === candidate.id && !link.occurrenceId))!;
    const links = fixture.serviceRunWorkOrders.filter((link) => link.serviceRunId === run.id && link.planned);
    const affectedWork = links.map((link) => fixture.workOrders.find((workOrder) => workOrder.id === link.workOrderId)!).filter(Boolean);
    const affectedStores = [...new Set(affectedWork.map((workOrder) => workOrder.storeId))];
    expect(affectedStores).toHaveLength(2);
    fixture.notificationRules = [
      { id: "rule-facilities", organizationId: NORTHLINE_ORGANIZATION_ID, eventKey: "vendor_commitment_received", emailEnabled: true, recipientRole: "facilities_admin", createdAt: fixture.asOf, updatedAt: fixture.asOf },
      { id: "rule-store", organizationId: NORTHLINE_ORGANIZATION_ID, eventKey: "vendor_commitment_received", emailEnabled: true, recipientRole: "store_manager", createdAt: fixture.asOf, updatedAt: fixture.asOf },
      { id: "rule-region", organizationId: NORTHLINE_ORGANIZATION_ID, eventKey: "vendor_commitment_received", emailEnabled: true, recipientRole: "regional_manager", createdAt: fixture.asOf, updatedAt: fixture.asOf },
    ];
    const repository = createOpsFixtureRepository(fixture);
    const sent: TransactionalEmail[] = [];
    const transport = createNotificationEmailTransport({
      repository,
      baseUrl: "https://ops.example.com",
      provider: { name: "test", async send(email) { sent.push(email); return { messageId: `message-${sent.length}` }; } },
    });

    await transport.deliver({ organizationId: NORTHLINE_ORGANIZATION_ID, id: "outbox-run-accepted", topic: "ops.service_run.vendor_accepted", aggregateType: "service_run", aggregateId: run.id, payloadJson: "{}", attemptCount: 0 });

    const facilitiesEmails = fixture.memberships.filter((membership) => membership.role === "facilities_admin").map((membership) => fixture.users.find((user) => user.id === membership.userId)!.email);
    const affectedStoreManagerEmails = affectedStores.map((storeId) => {
      const membershipId = fixture.scopeGrants.find((grant) => grant.scopeKind === "store" && grant.scopeId === storeId)!.membershipId;
      const membership = fixture.memberships.find((candidate) => candidate.id === membershipId)!;
      return fixture.users.find((user) => user.id === membership.userId)!.email;
    });
    const affectedRegionIds = [...new Set(affectedStores.map((storeId) => fixture.stores.find((store) => store.id === storeId)!.regionId))];
    const affectedRegionalEmails = affectedRegionIds.map((regionId) => {
      const membershipId = fixture.scopeGrants.find((grant) => grant.scopeKind === "region" && grant.scopeId === regionId)!.membershipId;
      const membership = fixture.memberships.find((candidate) => candidate.id === membershipId)!;
      return fixture.users.find((user) => user.id === membership.userId)!.email;
    });
    expect(sent.map((email) => email.to).sort()).toEqual([...facilitiesEmails, ...affectedStoreManagerEmails, ...affectedRegionalEmails].sort());
    for (const storeId of affectedStores) {
      const store = fixture.stores.find((candidate) => candidate.id === storeId)!;
      const managerEmail = affectedStoreManagerEmails[affectedStores.indexOf(storeId)]!;
      const managerNotice = sent.find((email) => email.to === managerEmail)!;
      expect(managerNotice.text).toContain(`Store ${store.storeNumber}`);
      for (const otherStoreId of affectedStores.filter((candidate) => candidate !== storeId)) {
        const other = fixture.stores.find((candidate) => candidate.id === otherStoreId)!;
        expect(managerNotice.text).not.toContain(`Store ${other.storeNumber}`);
      }
    }
    expect(sent.find((email) => facilitiesEmails.includes(email.to))?.text).toContain("2 work orders");
    expect(sent.find((email) => facilitiesEmails.includes(email.to))?.text).toMatch(/\((?:PM and Reactive|Reactive and PM)\)/);
  });

  it("routes a reactive vendor acceptance to the affected store manager without notifying every store", async () => {
    const fixture = buildNorthlinePresentationFixture();
    const accepted = fixture.vendorResponses.find((response) => response.response === "accepted")!;
    const workOrder = fixture.workOrders.find((candidate) => candidate.id === accepted.workOrderId)!;
    fixture.notificationRules = [{ id: "rule-store", organizationId: NORTHLINE_ORGANIZATION_ID, eventKey: "vendor_commitment_received", emailEnabled: true, recipientRole: "store_manager", createdAt: fixture.asOf, updatedAt: fixture.asOf }];
    const repository = createOpsFixtureRepository(fixture);
    const sent: TransactionalEmail[] = [];
    const transport = createNotificationEmailTransport({ repository, baseUrl: "https://ops.example.com", provider: { name: "test", async send(email) { sent.push(email); return { messageId: "message-reactive" }; } } });

    await transport.deliver({ organizationId: NORTHLINE_ORGANIZATION_ID, id: "outbox-reactive-accepted", topic: "ops.vendor.accepted", aggregateType: "work_order", aggregateId: workOrder.id, payloadJson: JSON.stringify({ assignmentId: accepted.assignmentId }), attemptCount: 0 });

    expect(sent).toHaveLength(1);
    const store = fixture.stores.find((candidate) => candidate.id === workOrder.storeId)!;
    expect(sent[0]!.to).toBe(`store${store.storeNumber}.manager@clark-demo.example`);
    expect(sent[0]!.text).toContain(workOrder.number);
    expect(sent[0]!.text).toContain("service date has not been recorded yet");
  });

  it("separates accepted commitments from other vendor responses", () => {
    expect(notificationEventForTopic("ops.vendor.accepted")).toBe("vendor_commitment_received");
    expect(notificationEventForTopic("ops.service_run.vendor_accepted")).toBe("vendor_commitment_received");
    expect(notificationEventForTopic("ops.vendor.question")).toBe("vendor_response_received");
    expect(notificationEventForTopic("ops.service_run.vendor_countered")).toBe("vendor_response_received");
  });

  it("parses quoted CSV cells and produces a non-writing store dry run", () => {
    const fixture = buildNorthlinePresentationFixture();
    expect(parseCsv('a,b\r\n"one, two","say ""yes"""\r\n')).toEqual([["a", "b"], ["one, two", 'say "yes"']]);
    const preview = previewImport("stores", `${importTemplate("stores")}999,Test Store,1 Main St,,Toledo,OH,43604,central,"test;new"\r\n`, fixture, NORTHLINE_ORGANIZATION_ID);
    expect(preview.writesPerformed).toBe(false);
    expect(preview.summary.error).toBe(0);
    expect(preview.rows[0]?.status).toBe("ready");
  });

  it("blocks duplicates and unknown equipment templates before apply", () => {
    const fixture = buildNorthlinePresentationFixture();
    const existing = fixture.stores.find((store) => store.organizationId === NORTHLINE_ORGANIZATION_ID)!;
    const duplicate = previewImport("stores", `${importTemplate("stores")}${existing.storeNumber},Duplicate,2 Main St,,Toledo,OH,43604,central,\r\n`, fixture, NORTHLINE_ORGANIZATION_ID);
    expect(duplicate.rows[0]?.errors).toContain("Store number already exists.");
    const equipment = previewImport("equipment", `${importTemplate("equipment")}999,Unknown machine,2,Machine,Rear room\r\n`, fixture, NORTHLINE_ORGANIZATION_ID);
    expect(equipment.summary.error).toBe(1);
  });
});
