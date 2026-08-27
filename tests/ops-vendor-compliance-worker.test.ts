import { describe, expect, it } from "vitest";
import { assignWorkOrder, type OpsCommandServices } from "@/lib/ops/commands";
import { createNotificationEmailTransport, type TransactionalEmail } from "@/lib/ops/email-delivery";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import { blockingVendorComplianceIssue, heldWorkVendorEligibility } from "@/lib/ops/held-work-policy";
import { runVendorComplianceCycle } from "@/lib/ops/job-workers";

const VENDOR_ID = "vendor-northline-brightpath";
const CURRENT_DOCUMENT_ID = "compliance-brightpath-insurance-2026";

function complianceHarness(now = "2026-08-01T12:00:00.000Z") {
  const fixture = buildNorthlinePresentationFixture();
  fixture.vendorComplianceDocuments = fixture.vendorComplianceDocuments.filter((row) => row.vendorId === VENDOR_ID);
  fixture.vendorComplianceAlerts = [];
  fixture.vendorReminders = fixture.vendorReminders.filter((row) => row.vendorId !== VENDOR_ID);
  fixture.outboxMessages = [];
  const repository = createOpsFixtureRepository(fixture);
  let current = now;
  let sequence = 0;
  const services: OpsCommandServices = {
    repository,
    clock: { now: () => current },
    ids: { next: (prefix) => `${prefix}-compliance-test-${++sequence}` },
  };
  return { repository, services, setNow(value: string) { current = value; } };
}

describe("vendor compliance expiry controls", () => {
  it("creates a quiet 60-day notice, then one vendor-level 30-day notification and reminder", async () => {
    const harness = complianceHarness();
    const quiet = await runVendorComplianceCycle(harness.services);
    expect(quiet.quietNoticesCreated).toBe(1);
    expect(harness.repository.snapshot().outboxMessages).toHaveLength(0);
    expect(harness.repository.snapshot().vendorComplianceAlerts).toEqual(expect.arrayContaining([
      expect.objectContaining({ documentId: CURRENT_DOCUMENT_ID, stage: "60_day" }),
    ]));

    harness.setNow("2026-08-20T12:00:00.000Z");
    const actionable = await runVendorComplianceCycle(harness.services);
    expect(actionable.actionNoticesCreated).toBe(1);
    expect(actionable.remindersCreated).toBe(1);
    const snapshot = harness.repository.snapshot();
    const messages = snapshot.outboxMessages.filter((row) => row.topic === "ops.vendor.compliance_due");
    expect(messages).toHaveLength(1);
    expect(JSON.parse(messages[0]!.payloadJson)).toMatchObject({
      vendorId: VENDOR_ID,
      routingEffect: "no_automatic_work_change",
      documents: [expect.objectContaining({ documentId: CURRENT_DOCUMENT_ID, stage: "30_day", blocking: true })],
    });
    expect(snapshot.vendorReminders.filter((row) => row.vendorId === VENDOR_ID && row.status === "open")).toHaveLength(1);

    harness.setNow("2026-08-21T12:00:00.000Z");
    await runVendorComplianceCycle(harness.services);
    expect(harness.repository.snapshot().outboxMessages.filter((row) => row.topic === "ops.vendor.compliance_due")).toHaveLength(1);

    for (const [currentTime, expectedStage, expectedMessageCount] of [
      ["2026-09-02T12:00:00.000Z", "14_day", 2],
      ["2026-09-09T12:00:00.000Z", "7_day", 3],
      ["2026-09-16T12:00:00.000Z", "expired", 4],
    ] as const) {
      harness.setNow(currentTime);
      await runVendorComplianceCycle(harness.services);
      const current = harness.repository.snapshot();
      expect(current.vendorComplianceAlerts).toEqual(expect.arrayContaining([
        expect.objectContaining({ documentId: CURRENT_DOCUMENT_ID, stage: expectedStage }),
      ]));
      expect(current.outboxMessages.filter((row) => row.topic === "ops.vendor.compliance_due")).toHaveLength(expectedMessageCount);
      expect(current.vendorReminders.filter((row) => row.vendorId === VENDOR_ID && row.status === "open")).toHaveLength(1);
    }
    const expiryMessage = harness.repository.snapshot().outboxMessages.filter((row) => row.topic === "ops.vendor.compliance_due").at(-1);
    expect(JSON.parse(expiryMessage!.payloadJson)).toMatchObject({
      routingEffect: "new_routine_work_paused_active_jobs_unchanged",
      documents: [expect.objectContaining({ stage: "expired" })],
    });
  });

  it("keeps an approved current document valid while a newer replacement awaits review", async () => {
    const fixture = buildNorthlinePresentationFixture();
    const documents = fixture.vendorComplianceDocuments.filter((row) => row.vendorId === VENDOR_ID);
    expect(documents.some((row) => row.reviewStatus === "pending" && row.createdAt > documents.find((row) => row.id === CURRENT_DOCUMENT_ID)!.createdAt)).toBe(true);
    expect(blockingVendorComplianceIssue(documents, "2026-08-27T12:00:00.000Z")).toBeUndefined();

    const repository = createOpsFixtureRepository(fixture);
    const workOrder = await repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, "wo-held-104-canopy-light");
    expect(workOrder).toBeTruthy();
    await expect(heldWorkVendorEligibility({ repository, organizationId: NORTHLINE_ORGANIZATION_ID, vendorId: VENDOR_ID, workOrder: workOrder!, now: "2026-08-27T12:00:00.000Z" })).resolves.toEqual({ allowed: true });
    await expect(heldWorkVendorEligibility({ repository, organizationId: NORTHLINE_ORGANIZATION_ID, vendorId: VENDOR_ID, workOrder: workOrder!, now: "2026-09-16T12:00:00.000Z" })).resolves.toMatchObject({ allowed: false, reason: expect.stringContaining("insurance") });
  });

  it("pauses only new routine routing after expiry while allowing emergency response", async () => {
    const fixture = buildNorthlinePresentationFixture();
    const source = fixture.workOrders.find((row) => row.id === "wo-held-104-canopy-light")!;
    fixture.workOrders.push(
      { ...source, id: "wo-compliance-routine", number: "CPS-2026-0991", priority: "routine", createdAt: "2026-09-16T12:00:00.000Z" },
      { ...source, id: "wo-compliance-emergency", number: "CPS-2026-0992", priority: "emergency", createdAt: "2026-09-16T12:00:00.000Z" },
    );
    const repository = createOpsFixtureRepository(fixture);
    let sequence = 0;
    const services: OpsCommandServices = { repository, clock: { now: () => "2026-09-16T12:00:00.000Z" }, ids: { next: (prefix) => `${prefix}-routing-test-${++sequence}` } };
    const actor = { actorType: "user" as const, actorId: "membership-northline-facilities", actorName: "Jordan Lee", organizationId: NORTHLINE_ORGANIZATION_ID };

    await expect(assignWorkOrder(services, { organizationId: NORTHLINE_ORGANIZATION_ID, workOrderId: "wo-compliance-routine", kind: "outside_vendor", vendorId: VENDOR_ID, actor })).rejects.toMatchObject({ code: "FORBIDDEN", message: expect.stringContaining("Active jobs are not cancelled") });
    await expect(assignWorkOrder(services, { organizationId: NORTHLINE_ORGANIZATION_ID, workOrderId: "wo-compliance-emergency", kind: "outside_vendor", vendorId: VENDOR_ID, actor })).resolves.toMatchObject({ vendorId: VENDOR_ID });
  });

  it("emails vendor dispatch and configured internal owners without per-work-order spam", async () => {
    const fixture = buildNorthlinePresentationFixture();
    fixture.notificationRules = [{
      id: "rule-compliance-facilities-test",
      organizationId: NORTHLINE_ORGANIZATION_ID,
      eventKey: "vendor_compliance_due",
      emailEnabled: true,
      recipientRole: "facilities_admin",
      createdAt: fixture.asOf,
      updatedAt: fixture.asOf,
    }];
    const repository = createOpsFixtureRepository(fixture);
    const sent: TransactionalEmail[] = [];
    const transport = createNotificationEmailTransport({
      repository,
      baseUrl: "https://ops.example.com",
      provider: { name: "test", async send(email) { sent.push(email); return { messageId: `compliance-${sent.length}` }; } },
    });
    await transport.deliver({
      organizationId: NORTHLINE_ORGANIZATION_ID,
      id: "outbox-compliance-test",
      topic: "ops.vendor.compliance_due",
      aggregateType: "vendor",
      aggregateId: VENDOR_ID,
      payloadJson: JSON.stringify({
        vendorId: VENDOR_ID,
        documents: [{ documentId: CURRENT_DOCUMENT_ID, documentType: "insurance", stage: "expired", blocking: true }],
        routingEffect: "new_routine_work_paused_active_jobs_unchanged",
      }),
      attemptCount: 0,
    });

    const vendor = fixture.vendors.find((row) => row.id === VENDOR_ID)!;
    const facilitiesEmails = fixture.memberships
      .filter((membership) => membership.role === "facilities_admin")
      .map((membership) => fixture.users.find((user) => user.id === membership.userId)!.email);
    expect(sent.map((email) => email.to).sort()).toEqual([vendor.dispatchEmail, ...facilitiesEmails].sort());
    expect(sent.every((email) => email.text.includes("New routine assignments are paused; active jobs are unchanged."))).toBe(true);
    expect(sent.some((email) => email.text.includes("prior record remains preserved"))).toBe(true);
  });
});
