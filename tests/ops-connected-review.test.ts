import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OperatorSession } from "@/components/ops/data-contract";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import { createOpsFixtureReadRepository, createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { loadWorkReview, recordedMoneyLabel, workOutcomeEvidence } from "@/lib/ops/work-review";
import { buildEquipmentReview } from "@/app/app/_data/equipment-review";
import { buildQueryListModel } from "@/app/app/_data/operator-query-presenter";

const session: OperatorSession = { organizationId: NORTHLINE_ORGANIZATION_ID, userId: "demo", displayName: "Manager", email: "demo@example.test", organizationName: "Demo", scopeLabel: "All stores", role: "facilities", demoEdition: "complete" };
let fixture = buildNorthlinePresentationFixture();
const target = () => fixture.workOrders.find((row) => row.number === "CPS-2026-0104")!;

describe("connected source review", () => {
  beforeEach(() => { fixture = buildNorthlinePresentationFixture(); });

  it("assembles the repair, later complaint, warranty and distinct money bases without changing records", async () => {
    const before = JSON.stringify(fixture);
    const work = target();
    const model = await loadWorkReview(createOpsFixtureReadRepository(fixture), session, work.id, fixture.asOf);
    expect(model?.outcome.label).toBe("Provider reported completed");
    expect(model?.outcome.detail).toContain("Manager review: verified");
    expect(model?.related.some((row) => row.label.includes("CPS-2026-0119"))).toBe(true);
    expect(model?.warranties.some((row) => row.detail.includes("Check whether this problem is covered"))).toBe(true);
    expect(model?.costTotal).toBe("$9,385.00");
    expect(model?.invoiceTotal).not.toBe(model?.costTotal);
    expect(model?.invoices.every((row) => row.href?.startsWith("/app/invoices/"))).toBe(true);
    expect(JSON.stringify(fixture)).toBe(before);
  });

  it("does not carry a previous confirmation into a newer service cycle", () => {
    const work = target();
    const links = fixture.siteVisitWorkOrders.filter((row) => row.workOrderId === work.id);
    const newest = { ...links.at(-1)!, id: "new-cycle", linkedAt: "2026-08-26T10:00:00Z", outcome: undefined, outcomeRecordedAt: undefined };
    const result = workOutcomeEvidence({ id: work.id, visits: [] }, [...links, newest], fixture.workOrderVerifications.filter((row) => row.workOrderId === work.id));
    expect(result.label).toBe("Current visit has no job outcome yet");
    expect(result.detail).not.toContain("verified");
  });

  it("reads every job on a shared visit and searches the secondary job reference", async () => {
    const work = target();
    const link = fixture.siteVisitWorkOrders.find((row) => row.workOrderId === work.id)!;
    const visit = fixture.visits.find((row) => row.id === link.visitId)!;
    const second = fixture.workOrders.find((row) => row.storeId === work.storeId && row.id !== work.id)!;
    visit.workOrderId = undefined;
    fixture.siteVisitWorkOrders.push({ ...link, id: "secondary-job", workOrderId: second.id, ordinal: 2, outcome: "parts_required", outcomeNotes: "Waiting for a different part" });
    const repository = createOpsFixtureRepository(fixture);
    const page = await repository.listVisits({ organizationId: session.organizationId }, { search: second.number, limit: 100 });
    expect(page.items.find((row) => row.id === visit.id)?.workOrders?.map((row) => row.id)).toEqual([work.id, second.id]);
    const model = await buildQueryListModel(repository, session, "visits", { q: second.number });
    const row = model.table.rows.find((row) => row.id === visit.id)!;
    expect(row.cells.find((cell) => cell.key === "outcome")?.value).toContain(`${second.number}: Parts Required`);
    expect(row.cells.find((cell) => cell.key === "work")?.value).toContain(work.number);
  });

  it("stops unauthorized lookups before related queries and fails closed for unassigned managers", async () => {
    const repository = createOpsFixtureRepository(fixture);
    const invoices = vi.spyOn(repository, "getWorkOrderInvoiceSources");
    expect(await loadWorkReview(repository, { ...session, role: "store_manager", storeIds: [] }, target().id, fixture.asOf)).toBeNull();
    expect(await loadWorkReview(repository, { ...session, storeIds: ["store-northline-101"] }, target().id, fixture.asOf)).toBeNull();
    expect(await loadWorkReview(repository, { ...session, organizationId: "another-tenant" }, target().id, fixture.asOf)).toBeNull();
    expect(invoices).not.toHaveBeenCalled();
  });

  it("does not follow malformed equipment or report associations into another store", async () => {
    const work = target();
    work.assetId = fixture.assets.find((row) => row.storeId !== work.storeId)!.id;
    work.requestId = fixture.requests.find((row) => row.storeId !== work.storeId)!.id;
    const repository = createOpsFixtureReadRepository(fixture);
    const warranties = vi.spyOn(repository, "getAssetWarrantySources");
    const model = await loadWorkReview(repository, { ...session, storeIds: [work.storeId] }, work.id, fixture.asOf);
    expect(model?.equipmentScope).toBeUndefined();
    expect(model?.context.some((row) => row.id === work.requestId)).toBe(false);
    expect(warranties).not.toHaveBeenCalled();
  });

  it("distinguishes missing amounts, recorded zero and separate currencies", async () => {
    expect(recordedMoneyLabel([])).toBe("No amounts recorded");
    expect(recordedMoneyLabel([{ amountMinor: 0, currency: "USD" }])).toBe("$0.00");
    expect(recordedMoneyLabel([{ amountMinor: 100, currency: "USD" }, { amountMinor: 200, currency: "EUR" }])).toBe("€2.00 + $1.00");
    fixture.costLines = fixture.costLines.filter((row) => row.workOrderId !== target().id);
    const review = await loadWorkReview(createOpsFixtureReadRepository(fixture), session, target().id, fixture.asOf);
    expect(review?.costTotal).toBe("No amounts recorded");
    expect(review?.missing.join(" ")).toContain("does not mean the work was free");
  });

  it("retains open source-report obligations while excluding completed historical tasks", async () => {
    const work = target();
    const seed = fixture.workflowTasks[0];
    fixture.workflowTasks.push({ ...seed, id: "open-report-obligation", workOrderId: undefined, serviceRequestId: work.requestId, status: "in_progress", title: "Confirm the source report's safety follow-up" }, { ...seed, id: "superseded-report-obligation", workOrderId: undefined, serviceRequestId: work.requestId, status: "completed", title: "Old concern already resolved" });
    const review = await loadWorkReview(createOpsFixtureReadRepository(fixture), session, work.id, fixture.asOf);
    expect(review?.obligations.some((row) => row.id === "open-report-obligation")).toBe(true);
    expect(review?.obligations.some((row) => row.id === "superseded-report-obligation")).toBe(false);
  });

  it("uses current quote revisions and does not display withdrawn options", async () => {
    const work = target();
    const seed = fixture.estimateRequests[0];
    fixture.estimateRequests.push({ ...seed, id: "review-quote", workOrderId: work.id, status: "submitted", decisionKind: "replacement_quote" });
    const proposal = fixture.estimateProposals[0];
    fixture.estimateProposals.push({ ...proposal, id: "old-quote", requestId: "review-quote", workOrderId: work.id, revision: 1, scope: "Old incorrect scope" }, { ...proposal, id: "corrected-quote", requestId: "review-quote", workOrderId: work.id, revision: 2, scope: "Compressor only; not the cooler", amount: { amountMinor: 200000, currency: "USD" } });
    const review = await loadWorkReview(createOpsFixtureReadRepository(fixture), session, work.id, fixture.asOf);
    expect(review?.quotes.find((row) => row.id === "review-quote")?.detail).toContain("Compressor only; not the cooler");
    expect(review?.quotes.find((row) => row.id === "review-quote")?.label).toContain(fixture.vendors.find((row) => row.id === seed.vendorId)!.name);
    expect(JSON.stringify(review?.quotes)).not.toContain("Old incorrect scope");
    fixture.estimateRequests.find((row) => row.id === "review-quote")!.status = "withdrawn";
    expect((await loadWorkReview(createOpsFixtureReadRepository(fixture), session, work.id, fixture.asOf))?.quotes.some((row) => row.id === "review-quote")).toBe(false);
  });

  it("exposes warranty amendments without relying on superseded calculated dates", async () => {
    const work = target();
    const repair = fixture.repairItems.find((row) => row.workOrderId === work.id)!;
    const warranty = fixture.appliedWarranties.find((row) => row.repairItemId === repair.id)!;
    fixture.warrantyAmendments.push({ id: "unavailable-warranty", organizationId: session.organizationId, appliedWarrantyId: warranty.id, amendmentKind: "mark_unavailable", appliesToRepairOnly: true, amendedTermsJson: "{}", reason: "This coverage was entered incorrectly", decidedByMembershipId: "membership-northline-facilities", decidedByName: "Manager", decidedAt: fixture.asOf });
    const review = await loadWorkReview(createOpsFixtureReadRepository(fixture), session, work.id, fixture.asOf);
    const result = review?.warranties.find((row) => row.id === warranty.id);
    expect(result?.detail).toContain("Terms amended");
    expect(result?.detail).not.toContain("Recorded term");
  });

  it("does not revive legacy invoice amounts when a canonical match is invalidated", async () => {
    const work = target();
    const lines = new Set(fixture.invoiceLineAllocations.filter((row) => row.workOrderId === work.id).map((row) => row.invoiceLineId));
    const invoices = new Set(fixture.invoiceLines.filter((row) => lines.has(row.id)).map((row) => row.invoiceId));
    fixture.invoiceLineAllocations.forEach((row) => { if (lines.has(row.invoiceLineId)) row.confirmedAt = undefined; });
    const review = await loadWorkReview(createOpsFixtureReadRepository(fixture), session, work.id, fixture.asOf);
    expect(review?.invoices.some((row) => [...invoices].some((id) => row.href?.includes(id)))).toBe(false);
  });
});

describe("equipment scope, history and handoff", () => {
  beforeEach(() => { fixture = buildNorthlinePresentationFixture(); });
  it("includes a parent component's descendants while labeling the separate whole-equipment queue", () => {
    const work = target();
    const child = fixture.components.find((row) => row.id === work.componentId)!;
    const model = buildEquipmentReview(fixture, session, work.assetId!, { component: child.parentComponentId, history: "all" })!;
    expect(model.title).toContain("and its components");
    expect(model.rows.some((row) => row.id === work.id)).toBe(true);
    expect(model.recordsLabel).toBe("All work on the whole equipment");
    expect(model.recordsHref).not.toContain("component=");
  });
  it("keeps component work, costs, quotes and creation context together without absorbing other components", () => {
    const work = target();
    const model = buildEquipmentReview(fixture, session, work.assetId!, { component: work.componentId, history: "all" })!;
    const expected = fixture.workOrders.filter((row) => row.assetId === work.assetId && row.componentId === work.componentId);
    expect(new Set(model.rows.map((row) => row.id))).toEqual(new Set(expected.map((row) => row.id)));
    expect(model.title).toContain("Compressor");
    expect(model.createHref).toContain(`component=${work.componentId}`);
    expect(model.currentWork.some((row) => row.label.includes("CPS-2026-0119"))).toBe(true);
    expect(model.warranty.length).toBeGreaterThan(0);
  });
  it("retains original query context, excludes out-of-period costs, and does not invent an unclassified component", () => {
    const work = target();
    const base = fixture.costLines.find((row) => row.workOrderId === work.id)!;
    fixture.costLines = [{ ...base, serviceDate: "2020-01-01", amount: { amountMinor: 999999, currency: "USD" } }];
    const model = buildEquipmentReview(fixture, session, work.assetId!, { component: work.componentId, history: "12", section: "service-history", from: "2026-07-01" })!;
    expect(model.workCost).toBe("No amounts recorded");
    expect(model.choices[0].href).toContain("section=service-history");
    expect(model.choices[0].href).toContain("from=2026-07-01");
    const unclassified = buildEquipmentReview(fixture, session, work.assetId!, { component: "unlinked" })!;
    expect(unclassified.createHref).not.toContain("component=");
    expect(unclassified.warranty).toEqual([]);
  });
  it("does not silently broaden an invalid or cross-equipment component selection", () => {
    const work = target();
    const foreignComponent = fixture.components.find((row) => row.assetId !== work.assetId)!;
    const model = buildEquipmentReview(fixture, session, work.assetId!, { component: foreignComponent.id })!;
    expect(model.notice).toContain("unavailable");
    expect(model.rows).toEqual([]);
    expect(model.createHref).toBeUndefined();
    expect(buildEquipmentReview(fixture, { ...session, storeIds: [] }, work.assetId!, {})).toBeNull();
  });
});
