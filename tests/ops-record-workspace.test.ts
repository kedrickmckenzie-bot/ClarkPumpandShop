import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { RecordSections } from "@/components/workspace/record-sections";
import { ControlTower } from "@/components/workspace/control-tower";
import type { DashboardPageViewModel, DetailSectionViewModel } from "@/components/ops/data-contract";

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

    expect(markup).toContain("Choose what you want to see");
    expect(markup).toContain("Service history");
    expect(markup).toContain("1 record");
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

  it("keeps review details off the overview while preserving one count that opens the full queue", () => {
    const model: DashboardPageViewModel = {
      state: { kind: "ready" },
      layout: "operations",
      page: {
        title: "Maintenance overview",
        description: "A clean daily view.",
        scopeLabel: "Companywide",
      },
      metrics: [{
        id: "review-items",
        label: "Items to review",
        value: "12",
        supportingText: "Open the queue for records, owners, and next steps",
        tone: "warning",
        link: { href: "/app/action-center", label: "Open review queue" },
      }],
      priorityActions: [{
        id: "detail-that-belongs-in-the-queue",
        title: "Detailed exception that belongs in the review queue",
        description: "This source-record wording must not appear on the overview.",
        categoryLabel: "Visit review",
        dueLabel: "Review now",
        ownerLabel: "Maintenance",
        tone: "critical",
        link: { href: "/app/action-center/detail", label: "Review" },
      }],
      prioritySection: {
        title: "Review queue",
        description: "Open the full queue.",
        link: { href: "/app/action-center", label: "Open review queue" },
        display: "summary",
      },
      breakdowns: [],
      trends: [],
    };

    const markup = renderToStaticMarkup(createElement(ControlTower, { model }));

    expect(markup).toContain("Items to review");
    expect(markup).toContain("12");
    expect(markup).toContain('href="/app/action-center"');
    expect(markup).not.toContain("Detailed exception that belongs in the review queue");
    expect(markup).not.toContain("Action queue summary");
  });
});
