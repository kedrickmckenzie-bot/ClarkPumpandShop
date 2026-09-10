import { safeDecisionReturn } from "@/lib/ops/review-navigation";
import { describe, expect, it } from "vitest";
import type { OperatorSession } from "@/components/ops/data-contract";
import { buildDecisionContext } from "@/app/app/_data/decision-context";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";

const session = { organizationId: NORTHLINE_ORGANIZATION_ID, role: "executive", permissions: ["ops:*"] } as OperatorSession;
function setup() {
  const fixture = buildNorthlinePresentationFixture();
  const work = fixture.workOrders.find((row) => row.id === "wo-northline-104")!;
  const component = fixture.components.find((row) => row.id === work.componentId)!;
  const line = fixture.costLines.find((row) => row.workOrderId === work.id)!;
  fixture.workOrders = [work, { ...work, id: "other-part", componentId: "other-part" }, { ...work, id: "unclassified", componentId: undefined }];
  fixture.components.push({ ...component, id: "other-part", name: "Fan" });
  fixture.costLines = [{ ...line, id:"recorded", amount:{amountMinor:12000,currency:"USD"}, serviceDate:"2026-07-10" }, { ...line, id:"other", workOrderId:"other-part", amount:{amountMinor:5000,currency:"USD"}, serviceDate:"2026-07-10" }, { ...line, id:"unclassified", workOrderId:"unclassified", amount:{amountMinor:2000,currency:"USD"}, serviceDate:"2026-07-10" }, { ...line, id:"older", amount:{amountMinor:10000,currency:"USD"}, serviceDate:"2025-01-10" }];
  return { fixture, work, component };
}
describe("decision context scope and evidence", () => {
  it("separates component, unclassified and whole spending without adding invoice evidence", () => {
    const {fixture,work,component} = setup();
    const selected = buildDecisionContext(fixture,session,work.assetId!,{component:component.id,history:"12"},work)!;
    expect(selected.wholeHref).toMatch(/#decision-costs$/);
    expect(selected.selectedCost).toBe("$120.00"); expect(selected.wholeCost).toBe("$190.00");
    expect(selected.costs.map((row)=>row.id)).toEqual(["recorded"]);
    expect(selected.rows.some((row)=>row.id==="other-part")).toBe(false);
    expect(selected.choices.every((row)=>row.href.startsWith("/app/lifecycle?")&&row.href.includes("history=12")&&row.href.includes("decision="))).toBe(true);
    expect(buildDecisionContext(fixture,session,work.assetId!,{component:"unlinked"})?.selectedCost).toBe("$20.00");
    expect(buildDecisionContext(fixture,session,work.assetId!,{component:component.id,history:"24"})?.selectedCost).toBe("$220.00");
    fixture.invoices.forEach((row)=>{row.total.amountMinor*=10;});
    expect(buildDecisionContext(fixture,session,work.assetId!,{component:component.id})?.selectedCost).toBe("$120.00");
  });
  it("keeps unknown costs distinct from genuine zero and rejects a foreign component", () => {
    const {fixture,work,component} = setup(); fixture.costLines = [];
    let result = buildDecisionContext(fixture,session,work.assetId!,{component:component.id})!;
    expect(result.selectedCost).toBe("No amounts recorded"); expect(result.facts.some((row)=>row.text.includes("no cost lines"))).toBe(true);
    const original=buildNorthlinePresentationFixture().costLines[0];
    fixture.costLines.push({...original,id:"zero",workOrderId:work.id,organizationId:work.organizationId,serviceDate:"2026-07-10",amount:{amountMinor:0,currency:"USD"}});
    result=buildDecisionContext(fixture,session,work.assetId!,{component:component.id})!;
    expect(result.selectedCost).toBe("$0.00");
    expect(buildDecisionContext(fixture,session,work.assetId!,{component:"foreign-component"})?.notice).toBeTruthy();
    expect(buildDecisionContext(fixture,{...session,role:"store_manager",storeIds:[]},work.assetId!,{})).toBeUndefined();
  });
  it("paginates exact cost evidence while retaining the total and rejects unsafe return paths", () => {
    const {fixture,work,component} = setup(); const line = fixture.costLines[0];
    fixture.costLines=Array.from({length:25},(_,i)=>({...line,id:`cost-${String(i).padStart(2,"0")}`}));
    const first=buildDecisionContext(fixture,session,work.assetId!,{component:component.id,history:"24"})!;
    const next=new URL(first.costPages[0].href,"https://local.test");
    const second=buildDecisionContext(fixture,session,work.assetId!,Object.fromEntries(next.searchParams))!;
    expect(first.costs).toHaveLength(20);expect(second.costs).toHaveLength(5);expect(first.selectedCost).toBe(second.selectedCost);
    expect(new Set([...first.costs,...second.costs].map((row)=>row.id)).size).toBe(25);
    expect(next.searchParams.get("component")).toBe(component.id);
    const path=`/app/lifecycle?asset=${work.assetId}&decision=${work.assetId}&component=${component.id}&history=24`;
    expect(safeDecisionReturn(path)).toContain("history=24");expect(safeDecisionReturn(`https://evil.test${path}`)).toBeUndefined();expect(safeDecisionReturn("/app/lifecycle?asset=a&decision=b")).toBeUndefined();
  });

  it("shows structured repair and exact outcome verification without diagnosing repeat complaints", () => {
    const {fixture,work,component} = setup();
    const result=buildDecisionContext(fixture,session,work.assetId!,{component:component.id},work)!;
    expect(result.rows[0].repairs[0].action).toContain("compressor");
    expect(result.rows[0].verification).toContain("verified");
    expect(result.facts.some((row)=>row.text.includes("Most recent recorded repair"))).toBe(true);
    fixture.siteVisitWorkOrders.push({...fixture.siteVisitWorkOrders.find((row)=>row.workOrderId===work.id)!,id:"new-service-cycle",linkedAt:"2026-08-20T15:00:00Z",outcome:undefined,outcomeRecordedAt:undefined});
    expect(buildDecisionContext(fixture,session,work.assetId!,{component:component.id})?.rows[0].verification).toContain("No manager review");
  });
});
