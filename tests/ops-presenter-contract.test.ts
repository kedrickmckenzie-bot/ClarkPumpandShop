import { beforeAll, describe, expect, it, vi } from "vitest";
import type { OperatorSession } from "@/components/ops/data-contract";
import {
  NORTHLINE_DEMO_ENTRY_TOKENS,
  NORTHLINE_DEMO_HANDLES,
  NORTHLINE_ORGANIZATION_ID,
  buildNorthlinePresentationFixture,
} from "@/lib/ops/fixtures";

vi.mock("server-only", () => ({}));

let buildListModel: typeof import("@/app/app/_data/operator-presenter").buildListModel;
let buildProgramModel: typeof import("@/app/app/_data/operator-presenter").buildProgramModel;
let buildDetailModel: typeof import("@/app/app/_data/operator-presenter").buildDetailModel;
let buildCreateWorkOrderModel: typeof import("@/app/app/_data/operator-presenter").buildCreateWorkOrderModel;

beforeAll(async () => {
  ({ buildListModel, buildProgramModel, buildDetailModel, buildCreateWorkOrderModel } = await import("@/app/app/_data/operator-presenter"));
});

function executiveSession(): OperatorSession {
  return {
    userId: "user-northline-executive",
    membershipId: "membership-northline-executive",
    displayName: "Alex Morgan",
    email: "alex.morgan@northline-demo.example",
    role: "executive",
    organizationId: NORTHLINE_ORGANIZATION_ID,
    organizationName: "Northline Fuel & Market",
    scopeLabel: "Northline companywide · 15 stores",
    permissions: ["ops:*"],
  };
}

function queryValue(href: string, key: string) {
  return new URL(href, "https://traceops.test").searchParams.get(key);
}

describe("operator presenter drill-through contracts", () => {
  it("keeps the selected store scope on spend context, totals, and source links", () => {
    const fixture = buildNorthlinePresentationFixture();
    const storeId = NORTHLINE_DEMO_HANDLES.storyStoreId;
    const model = buildProgramModel(fixture, executiveSession(), "spend", { store: storeId });
    const store = fixture.stores.find((candidate) => candidate.id === storeId)!;
    const storeWorkIds = new Set(
      fixture.workOrders
        .filter((workOrder) => workOrder.organizationId === NORTHLINE_ORGANIZATION_ID && workOrder.storeId === storeId)
        .map((workOrder) => workOrder.id),
    );
    const sourceLineCount = fixture.costLines.filter(
      (line) => line.organizationId === NORTHLINE_ORGANIZATION_ID && storeWorkIds.has(line.workOrderId),
    ).length;
    const storeInvoiceCount = new Set(
      fixture.invoiceAllocations
        .filter((allocation) => allocation.organizationId === NORTHLINE_ORGANIZATION_ID && storeWorkIds.has(allocation.workOrderId))
        .map((allocation) => allocation.invoiceReferenceId),
    ).size;

    expect(model.page.scopeLabel).toContain(`Store ${store.storeNumber}`);
    expect(model.metrics.find((metric) => metric.id === "total")?.supportingText).toContain(`${sourceLineCount} entered source lines`);
    expect(model.metrics.find((metric) => metric.id === "invoices")?.value).toBe(String(storeInvoiceCount));

    const totalSource = model.metrics.find((metric) => metric.id === "total")?.link?.href;
    expect(totalSource && queryValue(totalSource, "store")).toBe(storeId);

    const categorySources = model.breakdowns.find((breakdown) => breakdown.id.includes("service-area"))?.segments ?? [];
    expect(categorySources.length).toBeGreaterThan(0);
    expect(categorySources.every((segment) => queryValue(segment.link.href, "store") === storeId)).toBe(true);

    const equipmentSources = model.breakdowns.find((breakdown) => breakdown.id.includes("equipment"))?.segments ?? [];
    expect(equipmentSources.length).toBeGreaterThan(0);
    expect(equipmentSources.every((segment) => queryValue(segment.link.href, "store") === storeId)).toBe(true);

    const companyModel = buildProgramModel(fixture, executiveSession(), "spend");
    const storeSources = companyModel.breakdowns.find((breakdown) => breakdown.id.includes("by-store"))?.segments ?? [];
    expect(storeSources.length).toBeGreaterThan(1);
    expect(storeSources.every((segment) => queryValue(segment.link.href, "store") === segment.id)).toBe(true);

    const monthlySources = model.trends.flatMap((trend) => trend.points);
    expect(monthlySources.length).toBeGreaterThan(0);
    expect(monthlySources.every((point) => queryValue(point.link.href, "store") === storeId)).toBe(true);
  });

  it("keeps spend interactive through service area, flexible groups, equipment, and component", () => {
    const fixture = buildNorthlinePresentationFixture();
    const session = executiveSession();
    const asset = fixture.assets.find((candidate) => candidate.id === NORTHLINE_DEMO_HANDLES.storyAssetId)!;
    const component = fixture.components.find((candidate) => candidate.assetId === asset.id)!;

    const company = buildProgramModel(fixture, session, "spend");
    const refrigeration = company.breakdowns[0].segments.find((segment) => segment.id === "refrigeration")!;
    expect(new URL(refrigeration.link.href, "https://traceops.test").pathname).toBe("/app/spend");
    expect(queryValue(refrigeration.link.href, "category")).toBe("refrigeration");

    const grouped = buildProgramModel(fixture, session, "spend", {
      store: asset.storeId,
      category: asset.categoryKey,
      path: asset.groupPath.join("|"),
    });
    const equipment = grouped.breakdowns[0].segments.find((segment) => segment.id === asset.id)!;
    expect(queryValue(equipment.link.href, "store")).toBe(asset.storeId);
    expect(queryValue(equipment.link.href, "asset")).toBe(asset.id);

    const assetSpend = buildProgramModel(fixture, session, "spend", {
      store: asset.storeId,
      category: asset.categoryKey,
      path: asset.groupPath.join("|"),
      asset: asset.id,
    });
    const componentSpendLink = assetSpend.breakdowns[0].segments.find((segment) => segment.id === component.id)?.link.href;
    expect(componentSpendLink && queryValue(componentSpendLink, "component")).toBe(component.id);

    const componentSpend = buildProgramModel(fixture, session, "spend", {
      store: asset.storeId,
      category: asset.categoryKey,
      path: asset.groupPath.join("|"),
      asset: asset.id,
      component: component.id,
    });
    expect(componentSpend.page.title).toBe(component.name);
    expect(componentSpend.breakdowns[0].title).toMatch(/source type/i);
    expect(componentSpend.metrics.find((metric) => metric.id === "total")?.link.href).toContain(`component=${encodeURIComponent(component.id)}`);
  });

  it("enforces the advertised rolling-12-month period instead of including old cost", () => {
    const fixture = buildNorthlinePresentationFixture();
    const storeId = NORTHLINE_DEMO_HANDLES.storyStoreId;
    const baseline = buildProgramModel(fixture, executiveSession(), "spend", { store: storeId });
    const baselineTotal = baseline.metrics.find((metric) => metric.id === "total")?.value;
    const source = fixture.costLines.find((line) => line.workOrderId === NORTHLINE_DEMO_HANDLES.storyWorkOrderId)!;
    fixture.costLines.push({
      ...source,
      id: "cost-contract-outside-rolling-window",
      amount: { amountMinor: 9_999_999, currency: "USD" },
      serviceDate: "2024-01-15",
      recordedAt: "2024-01-15T18:00:00.000Z",
    });

    const withOldCost = buildProgramModel(fixture, executiveSession(), "spend", { store: storeId });
    expect(withOldCost.page.periodLabel).toMatch(/^Rolling 12 months/);
    expect(withOldCost.metrics.find((metric) => metric.id === "total")?.value).toBe(baselineTotal);
  });

  it("makes every PM status tile an exact row filter and uses only closed windows in compliance", () => {
    const fixture = buildNorthlinePresentationFixture();
    const session = executiveSession();
    const model = buildProgramModel(fixture, session, "pm");
    for (const metric of model.metrics.filter((candidate) => ["due", "scheduled", "completed", "missed"].includes(candidate.id))) {
      const filtered = buildProgramModel(fixture, session, "pm", { status: metric.id });
      expect(filtered.table!.rows).toHaveLength(Number(metric.value));
      expect(
        filtered.table!.rows.every(
          (row) => row.cells.find((cell) => cell.key === "status")?.value.toLocaleLowerCase("en-US") === metric.id,
        ),
      ).toBe(true);
    }

    const closedOccurrences = fixture.pmOccurrences.filter(
      (occurrence) => occurrence.status !== "waived" && Date.parse(occurrence.windowEndsAt) < Date.parse(fixture.asOf),
    );
    const completed = closedOccurrences.filter(
      (occurrence) => occurrence.status === "completed" || Boolean(occurrence.completedAt),
    ).length;
    expect(model.breakdowns[0].description).toContain(`${completed} completed / ${closedOccurrences.length} eligible occurrences`);
  });

  it("opens the exact CapEx year assets and explains Store 104 return-visit evidence", () => {
    const fixture = buildNorthlinePresentationFixture();
    const session = executiveSession();
    const store104 = buildProgramModel(fixture, session, "lifecycle", {
      asset: NORTHLINE_DEMO_HANDLES.storyAssetId,
    });
    const evidence = store104.table!.rows[0]?.cells.find((cell) => cell.key === "evidence")?.value;
    expect(evidence).toMatch(/return visit/i);

    const storyAsset = fixture.assets.find((asset) => asset.id === NORTHLINE_DEMO_HANDLES.storyAssetId)!;
    const replacementYear = String(new Date(storyAsset.installedAt!).getUTCFullYear() + storyAsset.expectedLifeYears!);
    const filtered = buildProgramModel(fixture, session, "lifecycle", { replacementYear });
    expect(filtered.table!.rows.some((row) => row.id === storyAsset.id)).toBe(true);
    expect(
      filtered.table!.rows.every((row) => {
        const asset = fixture.assets.find((candidate) => candidate.id === row.id)!;
        return String(new Date(asset.installedAt!).getUTCFullYear() + asset.expectedLifeYears!) === replacementYear;
      }),
    ).toBe(true);
  });

  it("lands invoice and action-center drill-downs on the promised source rows", () => {
    const fixture = buildNorthlinePresentationFixture();
    const session = executiveSession();
    const invoiceReports = buildListModel(fixture, session, "reports", { q: "invoice" });
    expect(invoiceReports.state.kind).toBe("ready");
    expect(invoiceReports.table.rows.length).toBeGreaterThan(0);

    const followUp = fixture.followUps[0];
    followUp.status = "open";
    const exceptionOnly = buildListModel(fixture, session, "action-center", { type: "exception" });
    expect(exceptionOnly.table.rows.some((row) => row.id === followUp.id)).toBe(false);
  });

  it("keeps unmatched invoice references visible without pretending to be accounts payable", () => {
    const fixture = buildNorthlinePresentationFixture();
    const session = executiveSession();
    const source = fixture.invoiceReferences[0];
    fixture.invoiceReferences.push({
      ...source,
      id: "invoice-presenter-unmatched",
      invoiceNumber: "INV-REVIEW-401",
      operatorWorkOrderNumber: "NL-2026-UNKNOWN",
      matchStatus: "unmatched",
      grossAmount: { amountMinor: 148_500, currency: "USD" },
    });

    const list = buildListModel(fixture, session, "invoices", { q: "INV-REVIEW-401" });
    expect(list.table.rows).toHaveLength(1);
    expect(list.table.rows[0].href).toBe("/app/invoices/invoice-presenter-unmatched");
    expect(list.table.rows[0].cells.find((cell) => cell.key === "work")?.secondary).toMatch(/not linked/i);

    const detail = buildDetailModel(fixture, session, "invoice", "invoice-presenter-unmatched");
    expect(detail.state.kind).toBe("ready");
    expect(detail.page.description).toMatch(/does not approve or pay/i);
    expect(detail.facts.find((fact) => fact.label === "Unmatched balance")?.value).not.toBe("$0");
  });

  it("opens a complete equipment record and carries it into work-order creation", () => {
    const fixture = buildNorthlinePresentationFixture();
    const session = executiveSession();
    const assetId = NORTHLINE_DEMO_HANDLES.storyAssetId;
    const asset = fixture.assets.find((candidate) => candidate.id === assetId)!;
    const detail = buildDetailModel(fixture, session, "equipment", assetId);

    expect(detail.state.kind).toBe("ready");
    expect(detail.page.title).toBe(asset.name);
    expect(detail.facts.map((fact) => fact.label)).toEqual(
      expect.arrayContaining(["Asset tag", "Manufacturer / model", "Serial number", "Warranty", "Recorded work cost", "Replacement estimate"]),
    );
    expect(detail.sections.map((section) => section.id)).toEqual(
      expect.arrayContaining(["lifecycle-evidence", "components", "service-history", "preventive-maintenance"]),
    );
    expect(detail.sections.find((section) => section.id === "components")?.table?.rows.length).toBeGreaterThan(0);
    expect(detail.sections.find((section) => section.id === "service-history")?.table?.rows.length).toBeGreaterThan(0);

    const create = buildCreateWorkOrderModel(fixture, session, { store: asset.storeId, asset: asset.id });
    expect(create.defaults).toEqual({ storeId: asset.storeId, assetId: asset.id, categoryKey: asset.categoryKey });
  });

  it("exposes working Store 104 QR, trusted-device, and vendor entry points", () => {
    const fixture = buildNorthlinePresentationFixture();
    const detail = buildDetailModel(fixture, executiveSession(), "store", NORTHLINE_DEMO_HANDLES.storyStoreId);
    const section = detail.sections.find((candidate) => candidate.id === "demo-entry-points");

    expect(section?.facts).toHaveLength(3);
    expect(section?.facts?.map((fact) => fact.link?.href)).toEqual([
      `/public/store/${NORTHLINE_DEMO_ENTRY_TOKENS.store104}`,
      `/public/store/${NORTHLINE_DEMO_ENTRY_TOKENS.trustedStore104}`,
      `/public/service/${NORTHLINE_DEMO_ENTRY_TOKENS.serviceAuthorization104}`,
    ]);
    expect(section?.facts?.every((fact) => Boolean(fact.link?.label))).toBe(true);
  });
});
