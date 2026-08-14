import { beforeAll, describe, expect, it, vi } from "vitest";
import type { OperatorSession } from "@/components/ops/data-contract";
import {
  NORTHLINE_DEMO_HANDLES,
  NORTHLINE_ORGANIZATION_ID,
  buildNorthlinePresentationFixture,
} from "@/lib/ops/fixtures";
import type { OpsFixture } from "@/lib/ops/types";

vi.mock("server-only", () => ({}));

let buildListModel: typeof import("@/app/app/_data/operator-presenter").buildListModel;

beforeAll(async () => {
  ({ buildListModel } = await import("@/app/app/_data/operator-presenter"));
});

type PaginatedRoute = "work-orders" | "visits" | "requests" | "invoices";

const routes: PaginatedRoute[] = ["work-orders", "visits", "requests", "invoices"];

function facilitiesSession(): OperatorSession {
  return {
    userId: "user-pagination-facilities",
    membershipId: "membership-northline-facilities",
    displayName: "Jordan Lee",
    email: "jordan.lee@northline-demo.example",
    role: "facilities",
    organizationId: NORTHLINE_ORGANIZATION_ID,
    organizationName: "Northline Fuel & Market",
    scopeLabel: "Northline companywide - 15 stores",
  };
}

function addInvoicePage(fixture: OpsFixture) {
  const work = fixture.workOrders.find((candidate) => candidate.id === NORTHLINE_DEMO_HANDLES.publicServiceWorkOrderId)!;
  for (let index = 0; index < 30; index += 1) {
    const id = `invoice-pagination-${String(index + 1).padStart(2, "0")}`;
    const date = new Date(Date.UTC(2026, 7, 31 - index)).toISOString().slice(0, 10);
    fixture.invoiceReferences.push({
      id,
      organizationId: NORTHLINE_ORGANIZATION_ID,
      vendorId: "vendor-northline-summit",
      invoiceNumber: `PAGINATION-${String(index + 1).padStart(3, "0")}`,
      invoiceDate: date,
      grossAmount: { amountMinor: 100_000 + index * 100, currency: "USD" },
      operatorWorkOrderNumber: work.number,
      matchStatus: "confirmed",
      createdAt: `${date}T18:00:00.000Z`,
    });
    fixture.invoiceAllocations.push({
      id: `allocation-pagination-${String(index + 1).padStart(2, "0")}`,
      organizationId: NORTHLINE_ORGANIZATION_ID,
      invoiceReferenceId: id,
      workOrderId: work.id,
      amount: { amountMinor: 100_000 + index * 100, currency: "USD" },
      confirmedByMembershipId: "membership-northline-finance",
      confirmedAt: `${date}T19:00:00.000Z`,
    });
  }
  return fixture;
}

function paginationFixture() {
  return addInvoicePage(buildNorthlinePresentationFixture());
}

function expectedIds(fixture: OpsFixture, route: PaginatedRoute) {
  if (route === "work-orders") {
    return fixture.workOrders
      .filter((row) => row.organizationId === NORTHLINE_ORGANIZATION_ID)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((row) => row.id);
  }
  if (route === "visits") {
    return fixture.visits
      .filter((row) => row.organizationId === NORTHLINE_ORGANIZATION_ID)
      .sort((left, right) => right.checkedInAt.localeCompare(left.checkedInAt))
      .map((row) => row.id);
  }
  if (route === "requests") {
    return fixture.requests
      .filter((row) => row.organizationId === NORTHLINE_ORGANIZATION_ID)
      .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt))
      .map((row) => row.id);
  }
  return fixture.invoiceReferences
    .filter((row) => row.organizationId === NORTHLINE_ORGANIZATION_ID)
    .sort((left, right) => right.invoiceDate.localeCompare(left.invoiceDate))
    .map((row) => row.id);
}

function query(href: string | undefined) {
  expect(href).toBeDefined();
  return new URL(href!, "https://traceops.test").searchParams;
}

function expectParameters(href: string | undefined, values: Record<string, string>) {
  const parameters = query(href);
  for (const [key, value] of Object.entries(values)) expect(parameters.get(key)).toBe(value);
  return parameters;
}

describe("stable operator-list pagination", () => {
  it.each(routes)("renders stable, non-overlapping %s page 1 and page 2 ranges with exact source links", (route) => {
    const fixture = paginationFixture();
    const expected = expectedIds(fixture, route);
    const first = buildListModel(fixture, facilitiesSession(), route);
    const second = buildListModel(fixture, facilitiesSession(), route, { page: "2" });
    const repeatedSecond = buildListModel(fixture, facilitiesSession(), route, { page: "2" });
    const firstIds = first.table.rows.map((row) => row.id);
    const secondIds = second.table.rows.map((row) => row.id);

    expect(expected.length).toBeGreaterThan(25);
    expect(firstIds).toEqual(expected.slice(0, 25));
    expect(secondIds).toEqual(expected.slice(25, 50));
    expect(repeatedSecond.table.rows.map((row) => row.id)).toEqual(secondIds);
    expect(first.table.rows).toHaveLength(25);
    expect(second.table.rows).toHaveLength(Math.min(25, expected.length - 25));
    expect(first.pagination?.summary).toBe(`Showing 1–25 of ${expected.length}`);
    expect(second.pagination?.summary).toBe(`Showing 26–${Math.min(50, expected.length)} of ${expected.length}`);
    expect(first.pagination?.previousHref).toBeUndefined();
    expect(query(first.pagination?.nextHref).get("page")).toBe("2");
    expect(query(second.pagination?.previousHref).get("page")).toBe("1");
    expect(firstIds.some((id) => secondIds.includes(id))).toBe(false);
    expect(new Set([...firstIds, ...secondIds]).size).toBe(firstIds.length + secondIds.length);
    expect([...first.table.rows, ...second.table.rows].every(
      (row) => row.href === `/app/${route}/${row.id}`,
    )).toBe(true);
  });

  it("preserves each route's search, filter, and scope parameters in page navigation", () => {
    const fixture = paginationFixture();
    const contracts: Array<{
      route: PaginatedRoute;
      parameters: Record<string, string>;
    }> = [
      {
        route: "work-orders",
        parameters: { q: "Northline", status: "closed", region: "region-northline-north" },
      },
      {
        route: "visits",
        parameters: { q: "Northline", status: "checked_out" },
      },
      {
        route: "requests",
        parameters: { q: "Northline" },
      },
      {
        route: "invoices",
        parameters: {
          q: "PAGINATION",
          region: "region-northline-north",
          store: NORTHLINE_DEMO_HANDLES.storyStoreId,
          category: "refrigeration",
        },
      },
    ];

    for (const contract of contracts) {
      const first = buildListModel(fixture, facilitiesSession(), contract.route, contract.parameters);
      const second = buildListModel(fixture, facilitiesSession(), contract.route, { ...contract.parameters, page: "2" });
      expect(first.table.rows).toHaveLength(25);
      expect(second.table.rows.length).toBeGreaterThan(0);
      const next = expectParameters(first.pagination?.nextHref, { ...contract.parameters, page: "2" });
      const previous = expectParameters(second.pagination?.previousHref, { ...contract.parameters, page: "1" });
      expect([...next.keys()].sort()).toEqual([...Object.keys(contract.parameters), "page"].sort());
      expect([...previous.keys()].sort()).toEqual([...Object.keys(contract.parameters), "page"].sort());
      if (second.pagination?.nextHref) {
        expectParameters(second.pagination.nextHref, { ...contract.parameters, page: "3" });
      }
    }
  });

  it("drops page state when search or a filter changes while retaining the other active context", () => {
    const fixture = paginationFixture();
    const work = buildListModel(fixture, facilitiesSession(), "work-orders", {
      q: "Northline",
      status: "closed",
      region: "region-northline-north",
      page: "2",
    });
    expect(work.search?.action).toBe("/app/work-orders");
    expect(work.search?.preservedParameters).toEqual(expect.arrayContaining([
      { name: "status", value: "closed" },
      { name: "region", value: "region-northline-north" },
    ]));
    expect(work.search?.preservedParameters?.some((parameter) => parameter.name === "page")).toBe(false);
    expect(work.search?.preservedParameters?.some((parameter) => parameter.name === "q")).toBe(false);
    expect(work.appliedFilters?.every((filter) => query(filter.removeHref).get("page") === null)).toBe(true);

    const visits = buildListModel(fixture, facilitiesSession(), "visits", {
      q: "Northline",
      status: "checked_out",
      page: "2",
    });
    const statusFilter = visits.filters?.find((filter) => filter.id === "visit-status");
    expect(statusFilter).toBeDefined();
    if (!statusFilter) throw new Error("Visit status filter is required for this contract");
    expect(statusFilter.options.every((option) => query(option.href).get("page") === null)).toBe(true);
    expect(statusFilter.options.find((option) => option.value === "active")?.href).toContain("status=active");
  });

  it.each(routes)("normalizes invalid and out-of-range %s pages without treating page as a data filter", (route) => {
    const fixture = paginationFixture();
    const expected = expectedIds(fixture, route);
    const first = buildListModel(fixture, facilitiesSession(), route);

    for (const invalidPage of ["not-a-page", "0", "-4", "1.5"]) {
      const invalid = buildListModel(fixture, facilitiesSession(), route, { page: invalidPage });
      expect(invalid.table.rows.map((row) => row.id)).toEqual(first.table.rows.map((row) => row.id));
      expect(invalid.pagination?.summary).toBe(`Showing 1–25 of ${expected.length}`);
      expect(invalid.pagination?.previousHref).toBeUndefined();
      expect(invalid.appliedFilters?.some((filter) => filter.id === "page")).not.toBe(true);
      expect(invalid.clearFiltersHref).toBeUndefined();
    }

    const totalPages = Math.ceil(expected.length / 25);
    const lastStart = (totalPages - 1) * 25;
    const outOfRange = buildListModel(fixture, facilitiesSession(), route, { page: "999" });
    expect(outOfRange.table.rows.map((row) => row.id)).toEqual(expected.slice(lastStart));
    expect(outOfRange.pagination?.summary).toBe(`Showing ${lastStart + 1}–${expected.length} of ${expected.length}`);
    expect(outOfRange.pagination?.nextHref).toBeUndefined();
    expect(query(outOfRange.pagination?.previousHref).get("page")).toBe(String(totalPages - 1));
    expect(outOfRange.appliedFilters?.some((filter) => filter.id === "page")).not.toBe(true);
    expect(outOfRange.clearFiltersHref).toBeUndefined();
  });
});
