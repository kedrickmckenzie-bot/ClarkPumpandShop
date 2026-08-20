import { describe, expect, it } from "vitest";
import { issueWorkOrder, type OpsCommandServices } from "@/lib/ops/commands";
import {
  declineEstimate,
  markEstimateOpened,
  reopenEstimateSelection,
  requestEstimate,
  selectEstimate,
  submitEstimate,
  withdrawEstimate,
} from "@/lib/ops/estimate-commands";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import {
  buildNorthlinePresentationFixture,
  NORTHLINE_DEMO_HANDLES,
  NORTHLINE_ORGANIZATION_ID,
} from "@/lib/ops/fixtures";
import type { ActorContext, OpsFixture, WorkOrderStatus } from "@/lib/ops/types";

const NOW = "2026-08-14T12:00:00.000Z";
const TOKEN_EXPIRY = "2026-09-14T12:00:00.000Z";
const RESPONSE_DUE = "2026-08-20T16:00:00.000Z";
const PUBLIC_WORK_ORDER_ID = NORTHLINE_DEMO_HANDLES.publicServiceWorkOrderId;
const PUBLIC_ASSIGNMENT_ID = "assignment-northline-104-issued";
const PUBLIC_ISSUANCE_ID = "issuance-northline-104-issued-r1";
const SUMMIT = "vendor-northline-summit";
const CEDAR = "vendor-northline-cedar";
const BRIGHTPATH = "vendor-northline-brightpath";

const facilitiesActor: ActorContext = {
  organizationId: NORTHLINE_ORGANIZATION_ID,
  actorType: "user",
  actorId: "membership-northline-facilities",
  actorName: "Jordan Lee",
};

function vendorActor(vendorName: string): ActorContext {
  return {
    organizationId: NORTHLINE_ORGANIZATION_ID,
    actorType: "vendor_link",
    actorName: `${vendorName} estimating desk`,
  };
}

function tokenHash(character: string) {
  return character.repeat(64);
}

function buildBidReadyFixture() {
  const fixture = buildNorthlinePresentationFixture();
  const assignment = fixture.assignments.find((candidate) => candidate.id === PUBLIC_ASSIGNMENT_ID);
  const workOrder = fixture.workOrders.find((candidate) => candidate.id === PUBLIC_WORK_ORDER_ID);
  if (!assignment || !workOrder) throw new Error("Bid-ready fixture is missing its public service records");
  assignment.status = "pending";
  workOrder.status = "awaiting_approval";
  workOrder.accountableParty = "Facilities coordinator";
  workOrder.nextAction = "Review vendor bids and select a service provider";
  return fixture;
}

function harness(input?: {
  fixture?: OpsFixture;
  collisions?: Partial<Record<string, string[]>>;
}) {
  const repository = createOpsFixtureRepository(input?.fixture ?? buildBidReadyFixture());
  const collisions = Object.fromEntries(
    Object.entries(input?.collisions ?? {}).map(([prefix, values]) => [prefix, [...(values ?? [])]]),
  ) as Record<string, string[]>;
  let sequence = 0;
  const services: OpsCommandServices = {
    repository,
    clock: { now: () => NOW },
    ids: {
      next(prefix) {
        const collision = collisions[prefix]?.shift();
        if (collision) return collision;
        sequence += 1;
        return `${prefix}-estimate-${String(sequence).padStart(4, "0")}`;
      },
    },
  };
  return { repository, services };
}

async function createEstimateRequest(
  test: ReturnType<typeof harness>,
  vendorId: string,
  hashCharacter: string,
  kind: "estimate_only" | "diagnostic_and_estimate" = "estimate_only",
) {
  const token = tokenHash(hashCharacter);
  const result = await requestEstimate(test.services, {
    organizationId: NORTHLINE_ORGANIZATION_ID,
    workOrderId: PUBLIC_WORK_ORDER_ID,
    vendorId,
    kind,
    requestedScope: "Diagnose the beer-cave evaporator fan and quote the complete repair, including labor, travel, and materials.",
    channel: "email",
    dueAt: RESPONSE_DUE,
    publicToken: { tokenHash: token, expiresAt: TOKEN_EXPIRY },
    actor: facilitiesActor,
  });
  return { ...result, tokenHash: token };
}

async function openEstimateRequest(
  test: ReturnType<typeof harness>,
  request: Awaited<ReturnType<typeof createEstimateRequest>>,
  vendorId: string,
  vendorName: string,
) {
  return markEstimateOpened(test.services, {
    organizationId: NORTHLINE_ORGANIZATION_ID,
    estimateRequestId: request.request.id,
    vendorId,
    tokenHash: request.tokenHash,
    actor: vendorActor(vendorName),
  });
}

async function submitProposal(
  test: ReturnType<typeof harness>,
  request: Awaited<ReturnType<typeof createEstimateRequest>>,
  vendorId: string,
  vendorName: string,
  expectedRevision: number,
  amount: number,
  suffix: string,
) {
  return submitEstimate(test.services, {
    organizationId: NORTHLINE_ORGANIZATION_ID,
    estimateRequestId: request.request.id,
    vendorId,
    tokenHash: request.tokenHash,
    expectedRevision,
    amountMinor: amount,
    currency: "usd",
    scope: `Replace the confirmed failed evaporator-fan assembly and verify operation. ${suffix}`,
    exclusions: "Refrigerant-circuit repairs require separate approval.",
    leadTimeDays: 2,
    validUntil: TOKEN_EXPIRY,
    actor: vendorActor(vendorName),
  });
}

async function prepareSelection(test: ReturnType<typeof harness>) {
  await test.repository.atomicWrite([
    {
      sql: "UPDATE ops_work_order_assignments SET status = ? WHERE organization_id = ? AND id = ?",
      params: ["pending", NORTHLINE_ORGANIZATION_ID, PUBLIC_ASSIGNMENT_ID],
    },
    {
      sql: "UPDATE ops_work_orders SET status = ? WHERE organization_id = ? AND id = ?",
      params: ["awaiting_approval", NORTHLINE_ORGANIZATION_ID, PUBLIC_WORK_ORDER_ID],
    },
  ]);
  const cedar = await createEstimateRequest(test, CEDAR, "1", "diagnostic_and_estimate");
  await openEstimateRequest(test, cedar, CEDAR, "Cedar Mechanical");
  const cedarFirst = await submitProposal(test, cedar, CEDAR, "Cedar Mechanical", 0, 188_000, "Initial revision.");
  const cedarLatest = await submitProposal(test, cedar, CEDAR, "Cedar Mechanical", 1, 178_000, "Revised after parts confirmation.");

  const summit = await createEstimateRequest(test, SUMMIT, "2");
  await openEstimateRequest(test, summit, SUMMIT, "Summit Refrigeration");
  const summitLatest = await submitProposal(test, summit, SUMMIT, "Summit Refrigeration", 0, 245_000, "Includes ECM motor and blade.");

  const brightPath = await createEstimateRequest(test, BRIGHTPATH, "3");
  await openEstimateRequest(test, brightPath, BRIGHTPATH, "BrightPath Electrical");
  return { cedar, cedarFirst, cedarLatest, summit, summitLatest, brightPath };
}

function proposalRows(fixture: OpsFixture, requestId: string) {
  return fixture.estimateProposals
    .filter((proposal) => proposal.requestId === requestId)
    .sort((left, right) => left.revision - right.revision);
}

function withoutWorkOrderVersions(fixture: OpsFixture) {
  return fixture.workOrders.map((workOrder) => ({ ...workOrder, version: 0 }));
}

describe("vendor estimate request boundary", () => {
  it("creates one tenant-scoped request and opaque capability without creating cost, invoice, assignment, or work-order records", async () => {
    const test = harness();
    const before = test.repository.snapshot();
    const result = await createEstimateRequest(test, CEDAR, "a", "diagnostic_and_estimate");
    const after = test.repository.snapshot();

    expect(result.request).toMatchObject({
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: PUBLIC_WORK_ORDER_ID,
      vendorId: CEDAR,
      kind: "diagnostic_and_estimate",
      status: "requested",
      channel: "email",
      requestedAt: NOW,
      dueAt: RESPONSE_DUE,
    });
    expect(after.publicTokens.slice(before.publicTokens.length)).toContainEqual(expect.objectContaining({
      id: result.tokenId,
      organizationId: NORTHLINE_ORGANIZATION_ID,
      purpose: "vendor_estimate",
      subjectType: "work_order_estimate_request",
      subjectId: result.request.id,
      tokenHash: tokenHash("a"),
      expiresAt: TOKEN_EXPIRY,
    }));
    expect(after.costLines).toEqual(before.costLines);
    expect(after.invoiceReferences).toEqual(before.invoiceReferences);
    expect(after.invoiceAllocations).toEqual(before.invoiceAllocations);
    expect(withoutWorkOrderVersions(after)).toEqual(withoutWorkOrderVersions(before));
    expect(after.workOrders.find((work) => work.id === PUBLIC_WORK_ORDER_ID)?.version)
      .toBe((before.workOrders.find((work) => work.id === PUBLIC_WORK_ORDER_ID)?.version ?? 0) + 1);
    expect(after.assignments).toEqual(before.assignments);
    expect(after.auditEvents.slice(before.auditEvents.length)).toContainEqual(expect.objectContaining({
      aggregateId: result.request.id,
      eventType: "work_order_estimate.requested",
    }));
    expect(after.outboxMessages.slice(before.outboxMessages.length)).toContainEqual(expect.objectContaining({
      aggregateId: result.request.id,
      topic: "ops.work_order_estimate.requested",
    }));
  });

  it("requires a future bid response deadline before creating any request evidence", async () => {
    const test = harness();
    const before = test.repository.snapshot();
    const base = {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: PUBLIC_WORK_ORDER_ID,
      vendorId: CEDAR,
      kind: "estimate_only" as const,
      requestedScope: "Price the complete repair without authorizing onsite work.",
      channel: "email" as const,
      publicToken: { tokenHash: tokenHash("d"), expiresAt: TOKEN_EXPIRY },
      actor: facilitiesActor,
    };

    await expect(requestEstimate(test.services, {
      ...base,
      dueAt: undefined as never,
    })).rejects.toMatchObject({ code: "VALIDATION", message: "Bid response due date is required" });
    await expect(requestEstimate(test.services, {
      ...base,
      dueAt: NOW,
    })).rejects.toMatchObject({ code: "VALIDATION", message: "Bid response due date must be in the future" });

    expect(test.repository.snapshot()).toEqual(before);
  });

  it("rejects a duplicate active request for the same work order and vendor without mutation", async () => {
    const test = harness();
    await createEstimateRequest(test, CEDAR, "a");
    const before = test.repository.snapshot();

    await expect(createEstimateRequest(test, CEDAR, "b")).rejects.toMatchObject({ code: "CONFLICT" });
    expect(test.repository.snapshot()).toEqual(before);
  });

  it("blocks bid requests during live outside service or an active onsite visit without mutation", async () => {
    const liveService = harness({ fixture: buildNorthlinePresentationFixture() });
    const beforeLiveService = liveService.repository.snapshot();

    await expect(createEstimateRequest(liveService, CEDAR, "e")).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Active service authorization must be explicitly ended before requesting vendor bids",
    });
    expect(liveService.repository.snapshot()).toEqual(beforeLiveService);

    const activeVisitFixture = buildBidReadyFixture();
    activeVisitFixture.visits.push({
      id: "visit-bid-request-active",
      organizationId: NORTHLINE_ORGANIZATION_ID,
      storeId: "store-northline-104",
      providerKind: "outside_vendor",
      vendorId: SUMMIT,
      workOrderId: PUBLIC_WORK_ORDER_ID,
      technicianName: "Morgan Ellis",
      providerName: "Summit Refrigeration",
      purpose: "Existing authorized service",
      status: "active",
      startedChannel: "secure_link",
      checkedInAt: "2026-08-14T11:30:00.000Z",
    });
    activeVisitFixture.siteVisitWorkOrders.push({
      id: "site-visit-work-bid-request-active",
      organizationId: NORTHLINE_ORGANIZATION_ID,
      visitId: "visit-bid-request-active",
      workOrderId: PUBLIC_WORK_ORDER_ID,
      ordinal: 1,
      linkedByActorType: "technician",
      linkedByActorName: "Morgan Ellis",
      linkedAt: "2026-08-14T11:30:00.000Z",
    });
    const activeVisit = harness({ fixture: activeVisitFixture });
    const beforeActiveVisit = activeVisit.repository.snapshot();

    await expect(createEstimateRequest(activeVisit, CEDAR, "f")).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Vendor bids cannot be requested while a technician is onsite",
    });
    expect(activeVisit.repository.snapshot()).toEqual(beforeActiveVisit);
  });

  it("requires the canonical work order, an approved covered vendor, and matching actor tenant", async () => {
    const actorMismatch = harness();
    const beforeActor = actorMismatch.repository.snapshot();
    await expect(requestEstimate(actorMismatch.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: PUBLIC_WORK_ORDER_ID,
      vendorId: CEDAR,
      kind: "estimate_only",
      requestedScope: "Quote the repair.",
      channel: "email",
      dueAt: TOKEN_EXPIRY,
      publicToken: { tokenHash: tokenHash("a"), expiresAt: TOKEN_EXPIRY },
      actor: { ...facilitiesActor, organizationId: "organization-other" },
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(actorMismatch.repository.snapshot()).toEqual(beforeActor);

    const uncoveredFixture = buildNorthlinePresentationFixture();
    uncoveredFixture.vendorCoverage = uncoveredFixture.vendorCoverage.filter((coverage) => coverage.vendorId !== CEDAR);
    const uncovered = harness({ fixture: uncoveredFixture });
    const beforeCoverage = uncovered.repository.snapshot();
    await expect(createEstimateRequest(uncovered, CEDAR, "b")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(uncovered.repository.snapshot()).toEqual(beforeCoverage);

    const unapprovedFixture = buildNorthlinePresentationFixture();
    unapprovedFixture.vendors.find((vendor) => vendor.id === CEDAR)!.status = "restricted";
    const unapproved = harness({ fixture: unapprovedFixture });
    const beforeVendor = unapproved.repository.snapshot();
    await expect(createEstimateRequest(unapproved, CEDAR, "c")).rejects.toMatchObject({ code: "VALIDATION" });
    expect(unapproved.repository.snapshot()).toEqual(beforeVendor);

    const terminalFixture = buildNorthlinePresentationFixture();
    terminalFixture.workOrders.find((work) => work.id === PUBLIC_WORK_ORDER_ID)!.status = "closed";
    const terminal = harness({ fixture: terminalFixture });
    const beforeTerminal = terminal.repository.snapshot();
    await expect(createEstimateRequest(terminal, CEDAR, "d")).rejects.toMatchObject({ code: "CONFLICT" });
    expect(terminal.repository.snapshot()).toEqual(beforeTerminal);
  });

  it("binds opened state to the exact vendor, request, token, tenant, and vendor-link actor, then repeats idempotently", async () => {
    const test = harness();
    const created = await createEstimateRequest(test, CEDAR, "a");
    const beforeInvalid = test.repository.snapshot();
    const base = {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      estimateRequestId: created.request.id,
      vendorId: CEDAR,
      tokenHash: created.tokenHash,
      actor: vendorActor("Cedar Mechanical"),
    };

    await expect(markEstimateOpened(test.services, { ...base, vendorId: SUMMIT })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(markEstimateOpened(test.services, { ...base, estimateRequestId: "estimate-request-other" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(markEstimateOpened(test.services, { ...base, tokenHash: tokenHash("f") })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(markEstimateOpened(test.services, { ...base, actor: facilitiesActor })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(markEstimateOpened(test.services, {
      ...base,
      organizationId: "organization-other",
      actor: { ...vendorActor("Cedar Mechanical"), organizationId: "organization-other" },
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(test.repository.snapshot()).toEqual(beforeInvalid);

    const opened = await markEstimateOpened(test.services, base);
    expect(opened).toMatchObject({ changed: true, request: { status: "opened", openedAt: NOW } });
    const afterFirst = test.repository.snapshot();
    expect(afterFirst.auditEvents.filter((event) => event.aggregateId === created.request.id && event.eventType === "work_order_estimate.opened")).toHaveLength(1);

    await expect(markEstimateOpened(test.services, base)).resolves.toMatchObject({ changed: false, request: { status: "opened" } });
    expect(test.repository.snapshot()).toEqual(afterFirst);
  });
});

describe("immutable vendor estimate responses", () => {
  it("rejects opening or submitting after the response deadline without mutation", async () => {
    const test = harness();
    const created = await createEstimateRequest(test, CEDAR, "a");
    const lateServices: OpsCommandServices = {
      ...test.services,
      clock: { now: () => "2026-08-21T12:00:00.000Z" },
    };
    const before = test.repository.snapshot();

    await expect(markEstimateOpened(lateServices, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      estimateRequestId: created.request.id,
      vendorId: CEDAR,
      tokenHash: created.tokenHash,
      actor: vendorActor("Cedar Mechanical"),
    })).rejects.toMatchObject({ code: "CONFLICT", message: "This bid response deadline has passed" });
    await expect(submitEstimate(lateServices, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      estimateRequestId: created.request.id,
      vendorId: CEDAR,
      tokenHash: created.tokenHash,
      expectedRevision: 0,
      amountMinor: 178_000,
      currency: "USD",
      scope: "Replace the failed fan assembly and verify operation.",
      actor: vendorActor("Cedar Mechanical"),
    })).rejects.toMatchObject({ code: "CONFLICT", message: "This bid response deadline has passed" });

    expect(test.repository.snapshot()).toEqual(before);
  });

  it("rejects cross-vendor, cross-request, and wrong-token proposal or decline actions without mutation", async () => {
    const test = harness();
    const created = await createEstimateRequest(test, CEDAR, "a");
    const before = test.repository.snapshot();

    await expect(submitEstimate(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      estimateRequestId: created.request.id,
      vendorId: SUMMIT,
      tokenHash: created.tokenHash,
      expectedRevision: 0,
      amountMinor: 178_000,
      currency: "USD",
      scope: "Attempted cross-vendor proposal.",
      actor: vendorActor("Summit Refrigeration"),
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(submitEstimate(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      estimateRequestId: "estimate-request-other",
      vendorId: CEDAR,
      tokenHash: created.tokenHash,
      expectedRevision: 0,
      amountMinor: 178_000,
      currency: "USD",
      scope: "Attempted cross-request proposal.",
      actor: vendorActor("Cedar Mechanical"),
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(declineEstimate(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      estimateRequestId: created.request.id,
      vendorId: CEDAR,
      tokenHash: tokenHash("f"),
      expectedRevision: 0,
      reason: "Attempted wrong-token decline.",
      actor: vendorActor("Cedar Mechanical"),
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(test.repository.snapshot()).toEqual(before);
  });

  it("appends revisions and never turns quote money into work cost, invoice value, NTE, or repair planning amount", async () => {
    const test = harness();
    const created = await createEstimateRequest(test, CEDAR, "a");
    await openEstimateRequest(test, created, CEDAR, "Cedar Mechanical");
    const before = test.repository.snapshot();
    const originalWork = before.workOrders.find((work) => work.id === PUBLIC_WORK_ORDER_ID)!;

    const first = await submitProposal(test, created, CEDAR, "Cedar Mechanical", 0, 188_000, "Initial revision.");
    const firstPersisted = test.repository.snapshot().estimateProposals.find((proposal) => proposal.id === first.proposal.id)!;
    const second = await submitProposal(test, created, CEDAR, "Cedar Mechanical", 1, 178_000, "Revised revision.");
    const after = test.repository.snapshot();

    expect(first.proposal).toMatchObject({ revision: 1, amount: { amountMinor: 188_000, currency: "USD" } });
    expect(second.proposal).toMatchObject({ revision: 2, amount: { amountMinor: 178_000, currency: "USD" } });
    expect(proposalRows(after, created.request.id)).toHaveLength(2);
    expect(after.estimateProposals.find((proposal) => proposal.id === first.proposal.id)).toEqual(firstPersisted);
    expect(await test.repository.getLatestEstimateProposal(NORTHLINE_ORGANIZATION_ID, created.request.id)).toEqual(second.proposal);
    expect(await test.repository.getEstimateRequest(NORTHLINE_ORGANIZATION_ID, created.request.id)).toMatchObject({
      status: "submitted",
      respondedAt: NOW,
    });
    expect(after.costLines).toEqual(before.costLines);
    expect(after.invoiceReferences).toEqual(before.invoiceReferences);
    expect(after.invoiceAllocations).toEqual(before.invoiceAllocations);
    const currentWork = after.workOrders.find((work) => work.id === PUBLIC_WORK_ORDER_ID)!;
    expect({ ...currentWork, version: originalWork.version }).toEqual(originalWork);
    expect(currentWork.version).toBe((originalWork.version ?? 0) + 2);
    expect(await test.repository.getEstimateRequestByPublicToken({
      tokenHash: created.tokenHash,
      purpose: "vendor_estimate",
      now: NOW,
      vendorId: CEDAR,
    })).toMatchObject({ request: { id: created.request.id, status: "submitted" } });

    const beforeStale = test.repository.snapshot();
    await expect(submitProposal(test, created, CEDAR, "Cedar Mechanical", 1, 165_000, "Stale revision.")).rejects.toMatchObject({ code: "CONFLICT" });
    expect(test.repository.snapshot()).toEqual(beforeStale);
  });

  it("rejects unsafe money, invalid currency, blank scope, stale validity, and unreasonable lead time without mutation", async () => {
    const test = harness();
    const created = await createEstimateRequest(test, CEDAR, "a");
    const base = {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      estimateRequestId: created.request.id,
      vendorId: CEDAR,
      tokenHash: created.tokenHash,
      expectedRevision: 0,
      amountMinor: 178_000,
      currency: "USD",
      scope: "Replace the failed fan assembly and verify operation.",
      leadTimeDays: 2,
      validUntil: TOKEN_EXPIRY,
      actor: vendorActor("Cedar Mechanical"),
    };
    const invalidCases: Array<Partial<typeof base>> = [
      { amountMinor: 0 },
      { amountMinor: 10.5 },
      { amountMinor: Number.MAX_SAFE_INTEGER },
      { currency: "US" },
      { scope: "  " },
      { validUntil: "2026-08-13T12:00:00.000Z" },
      { leadTimeDays: 3_651 },
    ];

    for (const invalid of invalidCases) {
      const before = test.repository.snapshot();
      await expect(submitEstimate(test.services, { ...base, ...invalid })).rejects.toMatchObject({ code: "VALIDATION" });
      expect(test.repository.snapshot()).toEqual(before);
    }
  });

  it("records decline as an audited terminal request decision without fabricating a proposal and consumes the vendor capability", async () => {
    const test = harness();
    const created = await createEstimateRequest(test, CEDAR, "a");
    const before = test.repository.snapshot();

    const result = await declineEstimate(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      estimateRequestId: created.request.id,
      vendorId: CEDAR,
      tokenHash: created.tokenHash,
      expectedRevision: 0,
      reason: "The required refrigeration part is outside our supported product line.",
      actor: vendorActor("Cedar Mechanical"),
    });
    const after = test.repository.snapshot();

    expect(result.request).toMatchObject({ status: "declined", respondedAt: NOW, decisionAt: NOW });
    expect(after.estimateProposals).toEqual(before.estimateProposals);
    expect(after.publicTokens.find((token) => token.id === created.tokenId)).toMatchObject({ usedAt: NOW });
    expect(await test.repository.getEstimateRequestByPublicToken({
      tokenHash: created.tokenHash,
      purpose: "vendor_estimate",
      now: NOW,
      vendorId: CEDAR,
    })).toBeNull();
    expect(after.auditEvents.slice(before.auditEvents.length)).toContainEqual(expect.objectContaining({
      aggregateId: created.request.id,
      eventType: "work_order_estimate.declined",
    }));

    const beforeRepeat = test.repository.snapshot();
    await expect(declineEstimate(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      estimateRequestId: created.request.id,
      vendorId: CEDAR,
      tokenHash: created.tokenHash,
      expectedRevision: 0,
      reason: "Repeated decline",
      actor: vendorActor("Cedar Mechanical"),
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(test.repository.snapshot()).toEqual(beforeRepeat);
  });

  it("withdraws an active request, preserves proposal history, and revokes its public capability", async () => {
    const test = harness();
    const created = await createEstimateRequest(test, CEDAR, "a");
    await submitProposal(test, created, CEDAR, "Cedar Mechanical", 0, 188_000, "Initial revision.");
    const before = test.repository.snapshot();

    const result = await withdrawEstimate(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      estimateRequestId: created.request.id,
      expectedRevision: 1,
      note: "Facilities resolved the scope through warranty coverage.",
      actor: facilitiesActor,
    });
    const after = test.repository.snapshot();

    expect(result.request).toMatchObject({ status: "withdrawn", decisionAt: NOW });
    expect(after.estimateProposals).toEqual(before.estimateProposals);
    expect(after.publicTokens.find((token) => token.id === created.tokenId)).toMatchObject({ revokedAt: NOW });
    expect(await test.repository.getEstimateRequestByPublicToken({
      tokenHash: created.tokenHash,
      purpose: "vendor_estimate",
      now: NOW,
      vendorId: CEDAR,
    })).toBeNull();
  });
});

describe("estimate selection and canonical work-order preservation", () => {
  it("selects only the latest proposal, creates one assignment, retires competing requests, and preserves quote/cost/authorization history", async () => {
    const test = harness();
    const prepared = await prepareSelection(test);
    const beforeStale = test.repository.snapshot();

    await expect(selectEstimate(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      estimateRequestId: prepared.cedar.request.id,
      proposalId: prepared.cedarFirst.proposal.id,
      expectedRevision: 1,
      note: "Attempted selection of stale revision",
      actor: facilitiesActor,
    })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(test.repository.snapshot()).toEqual(beforeStale);

    const before = test.repository.snapshot();
    const result = await selectEstimate(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      estimateRequestId: prepared.cedar.request.id,
      proposalId: prepared.cedarLatest.proposal.id,
      expectedRevision: 2,
      note: "Cedar provided the best complete scope and confirmed parts availability.",
      actor: facilitiesActor,
    });
    const after = test.repository.snapshot();
    const workRequests = after.estimateRequests.filter((request) => request.workOrderId === PUBLIC_WORK_ORDER_ID);

    expect(result).toMatchObject({
      request: { id: prepared.cedar.request.id, status: "selected", decisionAt: NOW },
      proposal: { id: prepared.cedarLatest.proposal.id, revision: 2 },
      assignment: {
        workOrderId: PUBLIC_WORK_ORDER_ID,
        kind: "outside_vendor",
        vendorId: CEDAR,
        status: "pending",
        supersedesAssignmentId: PUBLIC_ASSIGNMENT_ID,
      },
    });
    expect(workRequests.filter((request) => request.status === "selected")).toHaveLength(1);
    expect(workRequests.find((request) => request.id === prepared.summit.request.id)).toMatchObject({ status: "not_selected", decisionAt: NOW });
    expect(workRequests.find((request) => request.id === prepared.brightPath.request.id)).toMatchObject({ status: "not_selected", decisionAt: NOW });
    expect(await test.repository.getAssignment(NORTHLINE_ORGANIZATION_ID, PUBLIC_ASSIGNMENT_ID)).toMatchObject({ status: "superseded" });
    expect(await test.repository.getActiveAssignment(NORTHLINE_ORGANIZATION_ID, PUBLIC_WORK_ORDER_ID)).toMatchObject({
      id: result.assignment!.id,
      vendorId: CEDAR,
      status: "pending",
    });
    expect(await test.repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, PUBLIC_WORK_ORDER_ID)).toMatchObject({
      status: "approved",
      accountableParty: "Facilities coordinator",
      nextAction: "Generate service authorization",
    });
    for (const request of workRequests) {
      expect(after.publicTokens.filter((token) => token.purpose === "vendor_estimate" && token.subjectId === request.id))
        .toEqual(expect.arrayContaining([expect.objectContaining({ revokedAt: NOW })]));
    }
    expect(after.publicTokens.find((token) => token.purpose === "service_authorization" && token.subjectId === PUBLIC_ISSUANCE_ID)).toMatchObject({ revokedAt: NOW });
    expect(after.issuances).toEqual(before.issuances);
    expect(after.estimateProposals).toEqual(before.estimateProposals);
    expect(after.costLines).toEqual(before.costLines);
    expect(after.invoiceReferences).toEqual(before.invoiceReferences);
    expect(after.invoiceAllocations).toEqual(before.invoiceAllocations);
    expect(after.workOrders.map((work) => work.id)).toEqual(before.workOrders.map((work) => work.id));
    expect(after.workOrders.find((work) => work.id === PUBLIC_WORK_ORDER_ID)?.repairEstimate)
      .toEqual(before.workOrders.find((work) => work.id === PUBLIC_WORK_ORDER_ID)?.repairEstimate);
    expect(after.auditEvents.slice(before.auditEvents.length).map((event) => event.eventType)).toEqual([
      "work_order_estimate.selected",
      "work_order.assigned",
    ]);
    expect(after.outboxMessages.slice(before.outboxMessages.length).map((message) => message.topic)).toEqual([
      "ops.work_order_estimate.selected",
      "ops.work_order.assigned",
    ]);

    const beforeSecondWinner = test.repository.snapshot();
    await expect(selectEstimate(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      estimateRequestId: prepared.summit.request.id,
      proposalId: prepared.summitLatest.proposal.id,
      expectedRevision: 1,
      note: "Attempted second winner",
      actor: facilitiesActor,
    })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(test.repository.snapshot()).toEqual(beforeSecondWinner);
  });

  it("reopens a selected vendor decision without deleting the quote or creating a second work order", async () => {
    const test = harness();
    const prepared = await prepareSelection(test);
    const selected = await selectEstimate(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      estimateRequestId: prepared.cedar.request.id,
      proposalId: prepared.cedarLatest.proposal.id,
      expectedRevision: 2,
      note: "Initial commercial decision",
      actor: facilitiesActor,
    });
    const countsBefore = {
      workOrders: test.repository.snapshot().workOrders.length,
      proposals: test.repository.snapshot().estimateProposals.length,
      costs: test.repository.snapshot().costLines.length,
      invoices: test.repository.snapshot().invoiceReferences.length,
    };

    const reopened = await reopenEstimateSelection(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      estimateRequestId: prepared.cedar.request.id,
      expectedRevision: 2,
      note: "Vendor approval changed before authorization was issued.",
      actor: facilitiesActor,
    });

    expect(reopened.request.status).toBe("not_selected");
    expect(reopened.supersededAssignmentId).toBe(selected.assignment!.id);
    expect(await test.repository.getAssignment(NORTHLINE_ORGANIZATION_ID, selected.assignment!.id)).toMatchObject({ status: "superseded" });
    expect(await test.repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, PUBLIC_WORK_ORDER_ID)).toMatchObject({
      status: "awaiting_approval",
      accountableParty: "Facilities coordinator",
      nextAction: "Review vendor bids and select a service provider",
    });
    expect(test.repository.snapshot()).toMatchObject({
      workOrders: expect.arrayContaining([expect.objectContaining({ id: PUBLIC_WORK_ORDER_ID })]),
    });
    expect(test.repository.snapshot().workOrders).toHaveLength(countsBefore.workOrders);
    expect(test.repository.snapshot().estimateProposals).toHaveLength(countsBefore.proposals);
    expect(test.repository.snapshot().costLines).toHaveLength(countsBefore.costs);
    expect(test.repository.snapshot().invoiceReferences).toHaveLength(countsBefore.invoices);

    await expect(selectEstimate(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      estimateRequestId: prepared.summit.request.id,
      proposalId: prepared.summitLatest.proposal.id,
      expectedRevision: 1,
      note: "Select the backup after reopening.",
      actor: facilitiesActor,
    })).resolves.toMatchObject({ assignment: { vendorId: SUMMIT, status: "pending" } });
  });

  it("blocks service authorization when the selected proposal expires after selection", async () => {
    const test = harness();
    const prepared = await prepareSelection(test);
    await selectEstimate(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      estimateRequestId: prepared.cedar.request.id,
      proposalId: prepared.cedarLatest.proposal.id,
      expectedRevision: prepared.cedarLatest.proposal.revision,
      note: "Cedar supplied the best complete price and timing.",
      actor: facilitiesActor,
    });
    const [workOrder, assignment, store, vendor] = await Promise.all([
      test.repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, PUBLIC_WORK_ORDER_ID),
      test.repository.getActiveAssignment(NORTHLINE_ORGANIZATION_ID, PUBLIC_WORK_ORDER_ID),
      test.repository.getStore(NORTHLINE_ORGANIZATION_ID, "store-northline-104"),
      test.repository.getVendor(NORTHLINE_ORGANIZATION_ID, CEDAR),
    ]);
    if (!workOrder || !assignment || !store || !vendor) throw new Error("Estimate authorization fixture is incomplete");
    const afterExpiryServices: OpsCommandServices = {
      ...test.services,
      clock: { now: () => "2026-09-15T12:00:00.000Z" },
    };
    const before = test.repository.snapshot();

    await expect(issueWorkOrder(afterExpiryServices, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      workOrderId: workOrder.id,
      assignmentId: assignment.id,
      revision: 2,
      channel: "email",
      authorizationSnapshot: {
        organizationName: "Northline Fuel & Market",
        workOrderNumber: workOrder.number,
        store: {
          id: store.id,
          storeNumber: store.storeNumber,
          name: store.name,
          formattedAddress: `${store.address1}, ${store.city}, ${store.state} ${store.postalCode}`,
        },
        vendor: { id: vendor.id, name: vendor.name },
        problem: workOrder.problem,
        priority: workOrder.priority,
        billingInstruction: `Reference operator work order ${workOrder.number} on all service tickets and invoices.`,
      },
      publicToken: { tokenHash: tokenHash("f"), expiresAt: "2026-10-15T12:00:00.000Z" },
      actor: facilitiesActor,
    })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(test.repository.snapshot()).toEqual(before);
  });

  it.each(["in_progress", "completed_pending_review", "closed", "cancelled"] as WorkOrderStatus[])(
    "rejects selection from %s work without mutation",
    async (status) => {
      const test = harness();
      const prepared = await prepareSelection(test);
      await test.repository.atomicWrite([{
        sql: "UPDATE ops_work_orders SET status = ? WHERE organization_id = ? AND id = ?",
        params: [status, NORTHLINE_ORGANIZATION_ID, PUBLIC_WORK_ORDER_ID],
      }]);
      const before = test.repository.snapshot();

      await expect(selectEstimate(test.services, {
        organizationId: NORTHLINE_ORGANIZATION_ID,
        estimateRequestId: prepared.cedar.request.id,
        proposalId: prepared.cedarLatest.proposal.id,
        expectedRevision: 2,
        note: "This state must block vendor selection.",
        actor: facilitiesActor,
      })).rejects.toMatchObject({ code: "CONFLICT" });
      expect(test.repository.snapshot()).toEqual(before);
    },
  );

  it("rejects selection while a technician is actively onsite", async () => {
    const test = harness();
    const prepared = await prepareSelection(test);
    await test.repository.atomicWrite([
      {
        sql: "INSERT INTO ops_visit_sessions (id, organization_id, store_id, provider_kind, vendor_id, work_order_id, technician_name, provider_name, purpose, status, started_channel, checked_in_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params: [
          "visit-estimate-selection-active",
          NORTHLINE_ORGANIZATION_ID,
          "store-northline-104",
          "outside_vendor",
          SUMMIT,
          PUBLIC_WORK_ORDER_ID,
          "Active technician",
          "Summit Refrigeration",
          "Existing authorized service",
          "active",
          "secure_link",
          "2026-08-14T11:30:00.000Z",
        ],
      },
      {
        sql: "INSERT INTO ops_site_visit_work_orders (id, organization_id, visit_id, work_order_id, ordinal, linked_by_actor_type, linked_by_actor_name, linked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        params: [
          "site-visit-work-estimate-selection-active",
          NORTHLINE_ORGANIZATION_ID,
          "visit-estimate-selection-active",
          PUBLIC_WORK_ORDER_ID,
          1,
          "technician",
          "Active technician",
          "2026-08-14T11:30:00.000Z",
        ],
      },
    ]);
    const before = test.repository.snapshot();

    await expect(selectEstimate(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      estimateRequestId: prepared.cedar.request.id,
      proposalId: prepared.cedarLatest.proposal.id,
      expectedRevision: 2,
      note: "Attempted while onsite",
      actor: facilitiesActor,
    })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(test.repository.snapshot()).toEqual(before);
  });

  it("rolls back request decisions, token revocations, assignment supersession, and work projection when assignment persistence fails", async () => {
    const test = harness({ collisions: { assignment: [PUBLIC_ASSIGNMENT_ID] } });
    const prepared = await prepareSelection(test);
    const before = test.repository.snapshot();

    await expect(selectEstimate(test.services, {
      organizationId: NORTHLINE_ORGANIZATION_ID,
      estimateRequestId: prepared.cedar.request.id,
      proposalId: prepared.cedarLatest.proposal.id,
      expectedRevision: 2,
      note: "Atomic rollback collision test",
      actor: facilitiesActor,
    })).rejects.toThrow(`Duplicate fixture id ${PUBLIC_ASSIGNMENT_ID}`);
    expect(test.repository.snapshot()).toEqual(before);
  });
});
