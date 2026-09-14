import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ snapshot: vi.fn(), workspace: vi.fn() }));
vi.mock("@/app/app/_data/operator-loader", () => ({ loadOperatorSession: async () => ({ role: "store_manager" }) }));
vi.mock("@/app/app/_data/warranty-finance-loader", () => ({ loadWarrantyFinanceWorkspace: mocks.workspace }));
vi.mock("@/app/app/_data/request-data", () => ({ getRequestOpsTrendsFixtureSnapshot: mocks.snapshot }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
import InvoicePage from "@/app/app/invoices/page";

describe("invoice page role boundary", () => {
  it.each([{}, { from: "2026-01-01" }])("denies a store manager before reading invoice data: %j", async (query) => {
    await expect(InvoicePage({ searchParams: Promise.resolve(query) })).rejects.toThrow("NOT_FOUND");
    expect(mocks.workspace).not.toHaveBeenCalled();
    expect(mocks.snapshot).not.toHaveBeenCalled();
  });
});
