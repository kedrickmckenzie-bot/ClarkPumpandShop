import { describe, expect, it } from "vitest";
import { buildShowcaseFixture } from "@/lib/ops/showcase-fixture";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { attentionReason, storesNeedingAttention } from "@/lib/ops/stores-needing-attention";

const AS_OF = "2026-10-16T18:00:00.000Z";

describe("stores that need attention", () => {
  it("counts each reason from open source records, most serious first", async () => {
    const f = buildShowcaseFixture(AS_OF), repository = createOpsFixtureRepository(f), org = f.organizations[0]!.id;
    const scope = { organizationId: org };
    const rows = await storesNeedingAttention(repository, scope, AS_OF);
    expect(rows.length).toBeGreaterThan(0);
    // Every flagged store has at least one reason, and the order puts stopped stores first.
    for (const row of rows) expect(row.stopped + row.limited + row.urgentLate + row.complianceOverdue).toBeGreaterThan(0);
    const firstCalm = rows.findIndex(row => !row.stopped);
    if (firstCalm >= 0) expect(rows.slice(firstCalm).every(row => !row.stopped)).toBe(true);
    // Late urgent jobs match the work orders themselves.
    const late = f.workOrders.filter(w => w.organizationId === org && ["urgent", "emergency"].includes(w.priority) && w.dueAt && w.dueAt < AS_OF
      && ["awaiting_approval", "approved", "issued", "accepted", "scheduled", "in_progress", "waiting_on_parts", "waiting_on_vendor"].includes(w.status));
    expect(rows.reduce((n, row) => n + row.urgentLate, 0)).toBe(late.length);
    // A store limited to one region sees only its own stores.
    const region = f.stores.find(s => s.organizationId === org)!.regionId!;
    const regional = await storesNeedingAttention(repository, { organizationId: org, regionIds: [region] }, AS_OF);
    const regionStores = new Set(f.stores.filter(s => s.regionId === region).map(s => s.id));
    expect(regional.every(row => regionStores.has(row.storeId))).toBe(true);
  });

  it("says why in plain words", () => {
    expect(attentionReason({ storeId: "s", stopped: 1, limited: 0, urgentLate: 2, complianceOverdue: 1 })).toBe("Can't operate · 2 urgent jobs late · 1 compliance item overdue");
    expect(attentionReason({ storeId: "s", stopped: 0, limited: 1, urgentLate: 0, complianceOverdue: 3 })).toBe("Partly operating · 3 compliance items overdue");
  });
});
