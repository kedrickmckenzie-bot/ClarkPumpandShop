import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { RecordSections } from "@/components/workspace/record-sections";
import type { DetailSectionViewModel } from "@/components/ops/data-contract";

describe("summary-first enterprise records", () => {
  it("opens generic records on a section map instead of rendering every source table at once", () => {
    const sections: DetailSectionViewModel[] = [{
      id: "service-history",
      title: "Service history",
      description: "Source-linked work for this record.",
      table: {
        id: "service-history-records",
        caption: "Service history source records",
        columns: [{ key: "work", label: "Work order" }],
        rows: [{ id: "wo-1", label: "WO-1", href: "/app/work-orders/wo-1", cells: [{ key: "work", value: "WO-1 source detail" }] }],
      },
    }];

    const markup = renderToStaticMarkup(createElement(RecordSections, { sections }));

    expect(markup).toContain("Open only the detail you need");
    expect(markup).toContain("Service history");
    expect(markup).toContain("1 source record");
    expect(markup).not.toContain("WO-1 source detail");
  });

  it("routes each work-order tab to a server-selectable view so anchors never land on unrendered panels", async () => {
    const [page, workspace] = await Promise.all([
      readFile("app/app/work-orders/[id]/page.tsx", "utf8"),
      readFile("components/workspace/work-order-case.tsx", "utf8"),
    ]);

    expect(page).toContain('const workOrderViews = ["overview", "service", "visits", "cost", "equipment", "activity"]');
    expect(page).toContain("activeView={view}");
    expect(workspace).toContain('activeView === "overview"');
    expect(workspace).toContain('activeView === "service"');
    expect(workspace).toContain('activeView === "visits"');
    expect(workspace).toContain('activeView === "cost"');
    expect(workspace).toContain('activeView === "equipment"');
    expect(workspace).toContain('activeView === "activity"');
  });
});
