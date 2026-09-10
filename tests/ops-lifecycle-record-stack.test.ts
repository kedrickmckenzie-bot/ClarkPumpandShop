import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { DetailPageViewModel } from "@/components/ops/data-contract";
import { LifecycleRecordStack, type LifecycleDecisionWorkspaceModel } from "@/components/workspace/lifecycle-record-stack";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/lifecycle",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams("view=review&decision=asset-115&record=equipment"),
}));

const detail = (title: string): DetailPageViewModel => ({
  state: { kind: "ready" },
  page: { title, description: `${title} source record`, scopeLabel: "Companywide" },
  statusLabel: "Open",
  statusTone: "info",
  facts: [{ label: "Store", value: "Store 115" }],
  sections: [{ id: "history", title: "History", description: "Source history" }],
  backLink: { label: "Back", href: "/app/lifecycle" },
});

const model: LifecycleDecisionWorkspaceModel = {
  assetId: "asset-115",
  assetName: "Beer cave",
  assetTag: "115-REF-01",
  storeLabel: "115 - Southgate",
  statusLabel: "Replacement approved",
  statusTone: "warning",
  description: "Temperature is high",
  workOrderId: "wo-115",
  workOrderNumber: "CPS-2026-0115",
  repairAmountLabel: "$18,000",
  replacementAmountLabel: "$32,853",
  repairShareLabel: "55%",
  requiredRunwayLabel: "6.6 years",
  enteredServiceLabel: "5 years",
  decisionLabel: "Replacement approved",
  decisionHelper: "Management approved the selected quote.",
  ownerLabel: "Facilities",
  nextActionLabel: "Coordinate installation",
  dueLabel: "Aug 29, 2026",
  contextFacts: ["2 reactive work orders"],
  activity: [{ id: "event-1", title: "Quote selected", timestampLabel: "Aug 9, 2026", actorLabel: "Jordan Lee" }],
  closeHref: "/app/lifecycle?view=review",
  openWorkOrderHref: "/app/lifecycle?view=review&decision=asset-115&record=work-order",
  openEquipmentHref: "/app/lifecycle?view=review&decision=asset-115&record=equipment",
  childCloseHref: "/app/lifecycle?view=review&decision=asset-115",
};

describe("lifecycle stacked record workspace", () => {
  it("shows readable prices and evidence on a normal page", () => {
    const markup = renderToStaticMarkup(createElement(LifecycleRecordStack, {
      model,
      equipmentDetail: detail("Beer cave"),
      workOrderDetail: detail("CPS-2026-0115"),
    }));
    expect(markup).toContain("Repair or replace");
    expect(markup).toContain("$18,000");
    expect(markup).toContain("$32,853");
    expect(markup).not.toContain('role="dialog"');
    expect(markup).toContain("Continue CPS-2026-0115");
    expect(markup).toContain("record=work-order");
    expect(markup).toContain("Open the complete equipment history");
    expect(markup).toContain("record=equipment");
    expect(markup).toContain("Decision history");
  });

  it("keeps legacy child query links usable without stacking modal layers", () => {
    const markup = renderToStaticMarkup(createElement(LifecycleRecordStack, {
      model: { ...model, activeChild: "equipment" },
      equipmentDetail: detail("Beer cave"),
      workOrderDetail: detail("CPS-2026-0115"),
    }));
    expect(markup).not.toContain('aria-modal="true"');
    expect(markup).toContain('href="/app/lifecycle?view=review"');
    expect(markup).toContain("record=equipment");
  });
});
