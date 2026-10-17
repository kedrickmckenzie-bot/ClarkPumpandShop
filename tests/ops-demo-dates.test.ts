import { describe, expect, it } from "vitest";
import { buildShowcaseFixture } from "@/lib/ops/showcase-fixture";

describe("demo dates", () => {
  it.each(["2026-10-17T02:00:00.000Z", "2026-10-17T17:59:00.000Z", "2026-10-17T20:00:00.000Z"])("seeds no past events after now (%s)", (now) => {
    const f = buildShowcaseFixture(now);
    const future = [
      ...f.requests.map(r => r.submittedAt), ...f.requestImpactAssessments.map(r => r.assessedAt),
      ...f.workOrders.map(w => w.createdAt), ...f.visits.map(v => v.checkedInAt), ...f.auditEvents.map(e => e.occurredAt),
      ...f.serviceDiscrepancies.map(d => d.createdAt), ...(f.inspections ?? []).map(i => i.createdAt),
    ].filter(at => at && at > now);
    expect(future).toEqual([]);
  });
});
