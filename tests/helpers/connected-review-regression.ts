import { expect } from "vitest";
import type { OpsRepository } from "@/lib/ops/repository";
import { loadWorkReview } from "@/lib/ops/work-review";
import { invoiceReporting } from "@/lib/ops/invoice-reporting";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";

/** Executes real joins in both SQL engines, including full sibling invoice reconciliation. */
export async function connectedReviewRegression(repository: OpsRepository) {
  const fixture = buildNorthlinePresentationFixture();
  const org = NORTHLINE_ORGANIZATION_ID;
  const work = fixture.workOrders.find((row) => row.number === "CPS-2026-0104")!;
  const sources = await repository.getWorkOrderInvoiceSources(org, work.id);
  const expected = invoiceReporting(fixture, org).allocations.filter((row) => row.workOrderId === work.id);
  const actual = invoiceReporting(sources, org).allocations.filter((row) => row.workOrderId === work.id);
  expect(actual.map((row) => row.id).sort()).toEqual(expected.map((row) => row.id).sort());
  expect(actual.map((row) => row.amount.amountMinor).sort()).toEqual(expected.map((row) => row.amount.amountMinor).sort());
  expect((await repository.getWorkOrderInvoiceSources("another-org", work.id)).invoices).toEqual([]);
  const warranty = await repository.getAssetWarrantySources(org, work.assetId!);
  expect(warranty.repairItems.map((row) => row.id).sort()).toEqual(fixture.repairItems.filter((row) => row.assetId === work.assetId).map((row) => row.id).sort());
  expect(warranty.manufacturerWarranties.length).toBeGreaterThan(0);
  const sharedVisit = fixture.visits.find((visit) => fixture.siteVisitWorkOrders.filter((row) => row.visitId === visit.id).length > 1)!;
  const secondary = fixture.siteVisitWorkOrders.filter((row) => row.visitId === sharedVisit.id).at(-1)!;
  const secondaryWork = fixture.workOrders.find((row) => row.id === secondary.workOrderId)!;
  const visits = await repository.listVisits({ organizationId: org }, { search: secondaryWork.number, limit: 100 });
  expect(visits.items.find((row) => row.id === sharedVisit.id)?.workOrders?.some((row) => row.id === secondary.workOrderId)).toBe(true);
  const model = await loadWorkReview(repository, { organizationId: org, userId: "demo", displayName: "Manager", email: "demo@example.test", organizationName: "Demo", scopeLabel: "All", role: "facilities", demoEdition: "complete" }, work.id, fixture.asOf);
  expect(model?.history.length).toBeGreaterThan(0);
  expect(model?.costTotal).toBe("$9,385.00");
  expect(model?.warranties.length).toBeGreaterThan(0);
}
