import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { buildShowcaseFixture } from "@/lib/ops/showcase-fixture";
import { assignmentForWork, scopeFixture } from "@/app/app/_data/operator-presenter";
import { costWhileUnderWarranty, equipmentHistory, jobs, linksIn, periodWindow, repeatRepairs, spending, type AskContext } from "@/lib/ops/ask-lookups";
import type { OperatorSession } from "@/components/ops/data-contract";

const NOW = "2026-10-17T14:00:00.000Z", TODAY = "2026-10-17";
function context(session: Partial<OperatorSession> = {}): AskContext {
  const fixture = buildShowcaseFixture(NOW), org = fixture.organizations[0]!.id;
  const full = { organizationId: org, organizationName: "Clark Pump and Shop", userId: "u", membershipId: "m", displayName: "J", email: "j@x.test", scopeLabel: "All", role: "facilities", demoEdition: "complete", ...session } as OperatorSession;
  const scope = scopeFixture(fixture, full);
  return { fixture, scope, today: TODAY, now: NOW, vendorOf: id => { const a = assignmentForWork(fixture, org, id); return a?.kind === "outside_vendor" ? a.vendorId : undefined; } };
}

describe("Ask lookups", () => {
  it("adds spending up from cost lines and links every row to its jobs", () => {
    const ctx = context();
    const result = spending(ctx, { period: "12m", groupBy: "store", top: 25 });
    const window = periodWindow("12m", TODAY);
    const ids = new Set(ctx.scope.workOrders.map(w => w.id));
    const expected = ctx.fixture.costLines.filter(l => ids.has(l.workOrderId) && l.amount.currency === "USD" && l.serviceDate.slice(0, 10) >= window.start && l.serviceDate.slice(0, 10) <= window.end).reduce((n, l) => n + l.amount.amountMinor, 0);
    expect(result.total).toBe(`$${(expected / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`);
    expect(result.rows.length).toBeGreaterThan(0);
    for (const row of result.rows) expect(row.href).toMatch(/^\/app\/work-orders\?.*hasCost=true/);
    expect(result.priorPeriod).toBeDefined();
  });

  it("finds open and late jobs, repeat repairs, equipment and warranty cost", () => {
    const ctx = context();
    const late = jobs(ctx, { status: "late" });
    expect(late.jobs.every(j => j.href.startsWith("/app/work-orders/"))).toBe(true);
    const repeats = repeatRepairs(ctx, { period: "12m" });
    expect(repeats.count).toBeGreaterThan(0);
    const beer = equipmentHistory(ctx, { store: "104", equipment: "beer cave" });
    expect(beer.found).toBe(1);
    expect(costWhileUnderWarranty(ctx, { period: "12m" }).rule).toMatch(/warranty/);
    expect(linksIn(late).size).toBeGreaterThan(0);
  });

  it("only sees a regional manager's own stores", () => {
    const all = context();
    const region = all.scope.stores[0]!.regionId!;
    const regional = context({ role: "regional", regionIds: [region] });
    const allowed = new Set(regional.scope.stores.map(s => s.id));
    expect(allowed.size).toBeLessThan(all.scope.stores.length);
    const result = jobs(regional, { status: "all", limit: 20 });
    for (const j of result.jobs) expect(allowed.has(regional.scope.workOrders.find(w => j.href.endsWith(encodeURIComponent(w.id)))!.storeId)).toBe(true);
    const outside = all.scope.stores.find(s => !allowed.has(s.id))!;
    expect(spending(regional, { store: outside.storeNumber }).notes).toContain(`No store matches "${outside.storeNumber}".`);
  });

  it("says when a name doesn't match instead of guessing", () => {
    expect(spending(context(), { vendor: "Nonexistent Plumbing" }).notes[0]).toMatch(/No vendor matches/);
  });
});
