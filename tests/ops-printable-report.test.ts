import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PrintableReport } from "@/components/workspace/printable-report";
import { reportCatalogEntry } from "@/lib/ops/report-catalog";
import type { ListPageViewModel } from "@/components/ops/data-contract";

const model = {
  state: { kind: "ready" },
  page: { title: "Stores", description: "", scopeLabel: "Clark Pump and Shop companywide · 15 stores", periodLabel: "Nov 1, 2025 – Oct 8, 2026" },
  metrics: [{ id: "cost", label: "Recorded work cost", value: "$371,511", supportingText: "All 15 stores", link: { href: "/app/stores", label: "Stores" } }],
  table: { id: "t", caption: "Store cost ranking", columns: [{ key: "store", label: "Store" }, { key: "cost", label: "Recorded work cost", align: "end" }],
    rows: [{ id: "s1", label: "Store 104", href: "/app/stores/s1", cells: [{ key: "store", value: "Store 104 · Ridgeview" }, { key: "cost", value: "$47,536", secondary: "13% of scope total" }] }] },
  resultSummary: "1 store",
  pagination: { summary: "Showing 1–25 of 40", currentPage: 1, totalPages: 2, pageLinks: [] },
} as unknown as ListPageViewModel;

describe("printable report", () => {
  it("shows who it covers, the period, how it's counted, the totals and every record, and flags a partial list", () => {
    const html = renderToStaticMarkup(createElement(PrintableReport, { definition: reportCatalogEntry("store-cost-comparison")!, model, preparedFor: "Clark Pump and Shop", preparedBy: "Jordan Lee", generatedAt: "2026-10-08T15:00:00.000Z" }));
    for (const text of ["Spending by store", "Clark Pump and Shop companywide · 15 stores", "Nov 1, 2025 – Oct 8, 2026", "How this is counted", "$371,511", "Store 104 · Ridgeview", "13% of scope total", "Jordan Lee", "Print or save as PDF", "Showing 1–25 of 40"]) expect(html).toContain(text);
  });
});
