import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { OperatorSession } from "@/components/ops/data-contract";
import { ApprovedWorkPortfolio } from "@/components/workspace/approved-work-portfolio";
import { NORTHLINE_ORGANIZATION_ID, buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";

vi.mock("server-only", () => ({}));

let buildApprovedWorkPortfolio: typeof import("@/app/app/_data/approved-work-presenter").buildApprovedWorkPortfolio;
let buildListModel: typeof import("@/app/app/_data/operator-presenter").buildListModel;

beforeAll(async () => {
  ({ buildApprovedWorkPortfolio } = await import("@/app/app/_data/approved-work-presenter"));
  ({ buildListModel } = await import("@/app/app/_data/operator-presenter"));
});

function facilitiesSession(overrides: Partial<OperatorSession> = {}): OperatorSession {
  return {
    userId: "user-northline-facilities",
    membershipId: "membership-northline-facilities",
    displayName: "Morgan Lee",
    email: "morgan.lee@clark-demo.example",
    role: "facilities",
    organizationId: NORTHLINE_ORGANIZATION_ID,
    organizationName: "Clark Pump and Shop",
    scopeLabel: "Clark Pump and Shop companywide · 15 stores",
    ...overrides,
  };
}

describe("approved-work portfolio presenter", () => {
  it("counts only active holds whose canonical work order is still approved", () => {
    const fixture = buildNorthlinePresentationFixture();
    const expectedIds = new Set(
      (fixture.workOrderVisitHolds ?? [])
        .filter((hold) => hold.organizationId === NORTHLINE_ORGANIZATION_ID && hold.status === "active")
        .filter((hold) => fixture.workOrders.some((workOrder) => workOrder.id === hold.workOrderId && workOrder.status === "approved"))
        .map((hold) => hold.workOrderId),
    );

    const model = buildApprovedWorkPortfolio(fixture, facilitiesSession());
    expect(new Set(model.storeRows.flatMap((row) => row.items.map((item) => item.workOrderId)))).toEqual(expectedIds);
    expect(model.totalItems).toBe(expectedIds.size);
    expect(model.storeCount).toBe(new Set(
      [...expectedIds].map((id) => fixture.workOrders.find((workOrder) => workOrder.id === id)?.storeId),
    ).size);

    const firstId = [...expectedIds][0]!;
    fixture.workOrders.find((workOrder) => workOrder.id === firstId)!.status = "issued";
    expect(buildApprovedWorkPortfolio(fixture, facilitiesSession()).totalItems).toBe(expectedIds.size - 1);
  });

  it("labels confirmed opportunities only when store and classified service area both match", () => {
    const fixture = buildNorthlinePresentationFixture();
    const model = buildApprovedWorkPortfolio(fixture, facilitiesSession());
    const matchedItems = model.storeRows.flatMap((row) => row.items).filter((item) => item.confirmedVisits.length > 0);

    expect(matchedItems.length).toBeGreaterThan(0);
    expect(model.confirmedOpportunityItemCount).toBe(matchedItems.length);
    for (const item of matchedItems) {
      const appointment = fixture.serviceAppointments?.find((candidate) => candidate.id === item.confirmedVisits[0]!.appointmentId);
      const scheduledWork = fixture.workOrders.find((workOrder) => workOrder.id === appointment?.workOrderId);
      const heldWork = fixture.workOrders.find((workOrder) => workOrder.id === item.workOrderId);
      expect(appointment?.status).toBe("confirmed");
      expect(Date.parse(appointment!.startsAt)).toBeGreaterThanOrEqual(Date.parse(fixture.asOf));
      expect(Date.parse(appointment!.startsAt)).toBeLessThanOrEqual(Date.parse(item.reviewAt));
      expect(scheduledWork?.storeId).toBe(heldWork?.storeId);
      expect(scheduledWork?.categoryKey).toBe(heldWork?.categoryKey);
      expect(heldWork?.categoryKey).toBeTruthy();
    }
  });

  it("applies the operator store scope before producing totals or rows", () => {
    const fixture = buildNorthlinePresentationFixture();
    const companywide = buildApprovedWorkPortfolio(fixture, facilitiesSession());
    const selectedStore = companywide.storeRows.find((row) => row.itemCount > 0)!;
    const scoped = buildApprovedWorkPortfolio(fixture, facilitiesSession({
      role: "store_manager",
      storeIds: [selectedStore.storeId],
      scopeLabel: selectedStore.storeLabel,
    }));

    expect(scoped.storeRows).toHaveLength(1);
    expect(scoped.storeRows[0]?.storeId).toBe(selectedStore.storeId);
    expect(scoped.totalItems).toBe(selectedStore.itemCount);
  });

  it("keeps portfolio counts and store links inside the active queue filters", () => {
    const fixture = buildNorthlinePresentationFixture();
    const companywide = buildApprovedWorkPortfolio(fixture, facilitiesSession());
    const sourceItem = companywide.storeRows.flatMap((row) => row.items).find((item) => item.serviceAreaKey)!;
    const workOrder = fixture.workOrders.find((candidate) => candidate.id === sourceItem.workOrderId)!;
    const store = fixture.stores.find((candidate) => candidate.id === workOrder.storeId)!;
    const filtered = buildApprovedWorkPortfolio(fixture, facilitiesSession(), {
      q: sourceItem.workOrderNumber,
      regionId: store.regionId,
      categoryKey: sourceItem.serviceAreaKey,
    });

    expect(filtered.totalItems).toBe(1);
    expect(filtered.storeRows).toHaveLength(1);
    expect(filtered.storeRows[0]?.items[0]?.workOrderId).toBe(sourceItem.workOrderId);
    const rowHref = new URL(filtered.storeRows[0]!.reviewItemsHref, "https://example.test");
    expect(rowHref.searchParams.get("visitPlan")).toBe("ready");
    expect(rowHref.searchParams.get("q")).toBe(sourceItem.workOrderNumber);
    expect(rowHref.searchParams.get("region")).toBe(store.regionId);
    expect(rowHref.searchParams.get("category")).toBe(sourceItem.serviceAreaKey);
    expect(rowHref.searchParams.get("store")).toBe(store.id);
  });

  it("applies the review-window and confirmed-visit filters to portfolio totals", () => {
    const fixture = buildNorthlinePresentationFixture();
    const companywide = buildApprovedWorkPortfolio(fixture, facilitiesSession());
    const reviewSoon = buildApprovedWorkPortfolio(fixture, facilitiesSession(), { reviewWindow: "30" });
    const confirmed = buildApprovedWorkPortfolio(fixture, facilitiesSession(), { opportunity: "confirmed" });

    expect(reviewSoon.totalItems).toBe(companywide.reviewSoonCount);
    expect(reviewSoon.storeRows.flatMap((row) => row.items).every((item) => item.reviewState === "due_soon" || item.reviewState === "overdue")).toBe(true);
    expect(confirmed.totalItems).toBe(companywide.confirmedOpportunityItemCount);
    expect(confirmed.storeRows.flatMap((row) => row.items).every((item) => item.confirmedVisits.length > 0)).toBe(true);
  });

  it("drills the multi-job-store summary into the same filtered portfolio and queue", () => {
    const fixture = buildNorthlinePresentationFixture();
    const session = facilitiesSession();
    const companywide = buildApprovedWorkPortfolio(fixture, session);
    const multiple = buildApprovedWorkPortfolio(fixture, session, { storeGroup: "multiple" });
    const href = new URL(companywide.summaryLinks.multipleStores, "https://example.test");

    expect(href.searchParams.get("visitPlan")).toBe("ready");
    expect(href.searchParams.get("storeGroup")).toBe("multiple");
    expect(href.searchParams.has("reviewWindow")).toBe(false);
    expect(href.searchParams.has("opportunity")).toBe(false);
    expect(multiple.storeRows.every((row) => row.itemCount > 1)).toBe(true);
    expect(multiple.storeRows).toHaveLength(companywide.multiItemStoreCount);
    const queueIds = buildListModel(fixture, session, "work-orders", { visitPlan: "ready", storeGroup: "multiple" }).table.rows.map((row) => row.id).sort();
    expect(queueIds).toEqual(multiple.storeRows.flatMap((row) => row.items.map((item) => item.workOrderId)).sort());
  });

  it("stays aligned with every supported active work-queue filter", () => {
    const fixture = buildNorthlinePresentationFixture();
    const session = facilitiesSession();
    const base = buildApprovedWorkPortfolio(fixture, session);
    const sourceItem = base.storeRows.flatMap((row) => row.items)[0]!;
    const sourceWork = fixture.workOrders.find((workOrder) => workOrder.id === sourceItem.workOrderId)!;
    const sourceStore = fixture.stores.find((store) => store.id === sourceWork.storeId)!;
    const sourceAssignment = fixture.assignments.find((assignment) => assignment.workOrderId === sourceWork.id);
    const sourceCost = fixture.costLines.find((line) => line.workOrderId === sourceWork.id);
    const queries: Array<Record<string, string | undefined>> = [
      { q: sourceItem.workOrderNumber },
      { store: sourceStore.id },
      { region: sourceStore.regionId },
      { category: sourceWork.categoryKey ?? "unclassified" },
      { status: "approved" },
      { status: "open" },
      { stage: "vendor-response" },
      { vendor: sourceAssignment?.vendorId ?? "vendor-not-assigned" },
      { hasCost: "true" },
      { costFrom: fixture.asOf.slice(0, 10) },
      { costMonth: sourceCost?.serviceDate.slice(0, 7) ?? "1900-01" },
      { asset: sourceWork.assetId ?? "unlinked" },
      { component: sourceWork.componentId ?? "unlinked" },
      { path: "No matching equipment path" },
      { reviewWindow: "30" },
      { opportunity: "confirmed" },
    ];

    for (const query of queries) {
      const queueQuery: Record<string, string | undefined> = { visitPlan: "ready", ...query };
      const portfolio = buildApprovedWorkPortfolio(fixture, session, {
        q: queueQuery.q,
        storeId: queueQuery.store,
        regionId: queueQuery.region,
        categoryKey: queueQuery.category,
        status: queueQuery.status,
        stage: queueQuery.stage,
        vendorId: queueQuery.vendor,
        hasCost: queueQuery.hasCost === "true",
        costFrom: queueQuery.costFrom,
        costMonth: queueQuery.costMonth,
        assetId: queueQuery.asset,
        componentId: queueQuery.component,
        path: queueQuery.path,
        reviewWindow: queueQuery.reviewWindow,
        opportunity: queueQuery.opportunity,
      });
      const portfolioIds = portfolio.storeRows.flatMap((row) => row.items.map((item) => item.workOrderId)).sort();
      const queueIds = buildListModel(fixture, session, "work-orders", queueQuery).table.rows.map((row) => row.id).sort();
      expect(portfolioIds, JSON.stringify(query)).toEqual(queueIds);
    }
  });

  it("shows send controls only to roles that can issue work", () => {
    const fixture = buildNorthlinePresentationFixture();
    const facilitiesModel = buildApprovedWorkPortfolio(fixture, facilitiesSession());
    const selectedStore = facilitiesModel.storeRows[0]!;
    const storeManagerModel = buildApprovedWorkPortfolio(fixture, facilitiesSession({
      role: "store_manager",
      storeIds: [selectedStore.storeId],
      scopeLabel: selectedStore.storeLabel,
    }));
    const facilitiesMarkup = renderToStaticMarkup(createElement(ApprovedWorkPortfolio, { model: facilitiesModel }));
    const storeManagerMarkup = renderToStaticMarkup(createElement(ApprovedWorkPortfolio, { model: storeManagerModel }));

    expect(facilitiesModel.canSendTogether).toBe(true);
    expect(facilitiesModel.storeRows.every((row) => Boolean(row.sendTogetherHref))).toBe(true);
    expect(facilitiesMarkup).toContain("/app/store-sweeps/new");
    expect(storeManagerModel.canSendTogether).toBe(false);
    expect(storeManagerModel.storeRows.every((row) => row.sendTogetherHref === undefined)).toBe(true);
    expect(storeManagerMarkup).not.toContain("/app/store-sweeps/new");
  });

  it("shows every confirmed visit match with its vendor, time, and scheduled job context", () => {
    const fixture = buildNorthlinePresentationFixture();
    const model = buildApprovedWorkPortfolio(fixture, facilitiesSession());
    const matchedItems = model.storeRows.flatMap((row) => row.items).filter((item) => item.confirmedVisits.length > 0);

    expect(matchedItems.length).toBeGreaterThan(0);
    for (const row of model.storeRows.filter((candidate) => candidate.matchedItemCount > 0)) {
      const selected = buildApprovedWorkPortfolio(fixture, facilitiesSession(), { matchStoreId: row.storeId });
      const visibleText = renderToStaticMarkup(createElement(ApprovedWorkPortfolio, { model: selected })).replaceAll("&amp;", "&");
      for (const item of row.items.filter((candidate) => candidate.confirmedVisits.length > 0)) {
        expect(visibleText).toContain(item.workOrderNumber);
        for (const visit of item.confirmedVisits) {
          expect(visibleText).toContain(visit.vendorName);
          expect(visibleText).toContain(visit.startsAtLabel);
          expect(visibleText).toContain(visit.scheduledWorkOrderNumber);
        }
      }
      expect(visibleText).toContain("It does not assign the job or change the confirmed visit");
      expect(visibleText).toContain("Plan for vendor review");
      expect(visibleText).toContain("expectedHoldVersion");
    }
  });

  it("opens confirmed visit evidence in a route-backed dialog instead of an inline table popover", () => {
    const fixture = buildNorthlinePresentationFixture();
    const companywide = buildApprovedWorkPortfolio(fixture, facilitiesSession());
    const matchedStore = companywide.storeRows.find((row) => row.matchedItemCount > 0)!;
    const href = new URL(matchedStore.reviewMatchesHref!, "https://example.test");
    const selected = buildApprovedWorkPortfolio(fixture, facilitiesSession(), { matchStoreId: matchedStore.storeId });
    const markup = renderToStaticMarkup(createElement(ApprovedWorkPortfolio, { model: selected }));

    expect(href.searchParams.get("matchStore")).toBe(matchedStore.storeId);
    expect(selected.matchReview?.storeLabel).toBe(matchedStore.storeLabel);
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain("It does not assign the job or change the confirmed visit");
  });

  it("renders a store-first operating surface without scheduling or unsupported savings language", () => {
    const fixture = buildNorthlinePresentationFixture();
    const model = buildApprovedWorkPortfolio(fixture, facilitiesSession());
    const markup = renderToStaticMarkup(createElement(ApprovedWorkPortfolio, { model }));

    expect(markup).toContain("Approved for next suitable visit");
    expect(markup).toContain("Control small approved jobs without losing them in the backlog");
    expect(markup).toContain("Review if not handled by");
    expect(markup).toContain("Nothing is assigned automatically");
    expect(markup).toContain("it is an opportunity to review, not an assignment");
    expect(markup).not.toContain("route optimization");
    expect(markup).not.toContain("trip savings");
    expect(markup).not.toContain("estimated duration");
  });
});
