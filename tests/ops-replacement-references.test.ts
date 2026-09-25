import { describe, expect, it } from "vitest";
import { replacementReferences } from "@/lib/ops/replacement-references";
import { buildDecisionContext } from "@/app/app/_data/decision-context";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";
import type { OperatorSession } from "@/components/ops/data-contract";
function setup() {
  const f = buildNorthlinePresentationFixture(); const asset = f.assets.find(a => a.id === "asset-115-beer-cave")!;
  const request = f.estimateRequests.find(r => r.decisionKind === "replacement_quote" && f.workOrders.some(w => w.id === r.workOrderId && w.assetId === asset.id))!;
  const quote = f.estimateProposals.find(p => p.requestId === request.id)!;
  return { f, asset, request, quote, scope: { organizationId: asset.organizationId } };
}
describe("replacement source references", () => {
  it("shows saved source amounts, validity, installation and direct evidence links", () => {
    const t = setup(); t.quote.validUntil = "2026-08-01";
    const rows = replacementReferences(t.f, t.scope, t.asset);
    const row = rows.find(r => r.id === `quote:${t.quote.id}`)!;
    expect(row).toBeDefined(); expect(row.status).toBe("Expired quote"); expect(row.href).toContain(t.request.workOrderId);
    expect(row.date).toBe(t.quote.submittedAt.slice(0,10)); expect(row.kind).toBe("Replacement quote");
    expect(rows.some(r => r.installation.includes("Installation $"))).toBe(true);
  });
  it("keeps component and whole-unit prices separate and enforces store and tenant scope", () => {
    const t = setup(); const component = t.f.components.find(c => c.assetId === t.asset.id)!;
    expect(replacementReferences(t.f, t.scope, t.asset, component.id).some(r => r.kind === "Replacement quote")).toBe(false);
    expect(replacementReferences(t.f, { ...t.scope, storeIds: [] }, t.asset)).toEqual([]);
    expect(replacementReferences(t.f, { organizationId: "other" }, t.asset)).toEqual([]);
    expect(replacementReferences(t.f, t.scope, t.asset, "wrong-component")).toEqual([]);
  });
  it("uses confirmed invoice allocations only, never an unrelated repair invoice or gross total", () => {
    const t = setup(); const original = t.f.invoiceReferences[0];
    t.f.invoiceReferences.push({ ...original, id: "replacement-source-invoice", invoiceDate: "2026-08-20", invoiceNumber: "REFERENCE-1", grossAmount: { amountMinor: 9999999, currency: "USD" } });
    t.f.invoiceAllocations.push({ id: "reference-allocation", organizationId: t.scope.organizationId, invoiceReferenceId: "replacement-source-invoice", workOrderId: t.request.workOrderId, amount: { amountMinor: 100000, currency: "USD" }, confirmedAt: "2026-08-20", confirmedByMembershipId: "membership-northline-facilities" });
    let rows = replacementReferences(t.f, t.scope, t.asset);
    expect(rows.find(r => r.id === `invoice:replacement-source-invoice:${t.request.workOrderId}`)?.amount).toBe("$1,000.00");
    t.f.invoiceAllocations.at(-1)!.confirmedAt = undefined;
    rows = replacementReferences(t.f, t.scope, t.asset);
    expect(rows.some(r => r.id.startsWith("invoice:replacement-source-invoice"))).toBe(false);
  });
  it("defaults to twelve months, retains older sources on request and preserves history scope", () => {
    const t = setup(); t.quote.submittedAt = "2024-08-01T00:00:00Z";
    const session = { ...t.scope, role: "executive", permissions: ["ops:*"] } as OperatorSession;
    const recent = buildDecisionContext(t.f, session, t.asset.id, { history: "24" })!;
    expect(recent.references.some(r => r.id === `quote:${t.quote.id}`)).toBe(false);
    const query = Object.fromEntries(new URL(recent.referenceToggleHref, "https://local.test").searchParams);
    const all = buildDecisionContext(t.f, session, t.asset.id, query)!;
    expect(all.references.some(r => r.id === `quote:${t.quote.id}` && r.older)).toBe(true);
    expect(query.history).toBe("24"); expect(all.fullHistoryHref).toContain("history=all");
    expect(all.rows.every(r => r.href.includes("returnDecision="))).toBe(true);
  });
});
