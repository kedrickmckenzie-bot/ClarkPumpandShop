import { describe, expect, it } from "vitest";
import { buildShowcaseFixture } from "@/lib/ops/showcase-fixture";
import { assertOpsFixture } from "@/lib/ops/fixtures";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { SINCE_KINDS } from "@/lib/ops/since-last-looked";
import { equipmentIssuesFromFixture, repeatProblemWindow } from "@/lib/ops/equipment-issues";
import { REPEAT_WORK_MIN_JOBS } from "@/lib/ops/replacement-intelligence";
import { buildScorecard, scorecardWindowAt, vendorJobFactsFromFixture } from "@/lib/ops/vendor-scorecard";
import type { OpsFixture } from "@/lib/ops/types";

const anchor = "2026-10-07T15:00:00.000Z";
const story = buildShowcaseFixture(anchor);
const earlier = buildShowcaseFixture(anchor, { operatingHistory: false });
const org = story.organizations[0]!.id;
const DAY = 86_400_000;

describe("showcase story inventory", () => {
  it("is valid and keeps the presentation contract", () => {
    expect(() => assertOpsFixture(story)).not.toThrow();
    expect(story.stores).toHaveLength(15);
    expect(story.vendors).toHaveLength(5);
    expect(story.memberships.filter(m => m.role === "internal_technician")).toHaveLength(6);
  });

  it("keeps every record of the earlier showcase, so no showcased story is lost", () => {
    const missing: string[] = [];
    for (const [key, rows] of Object.entries(earlier) as Array<[keyof OpsFixture, unknown]>) {
      if (!Array.isArray(rows)) continue;
      const kept = new Set(((story[key] ?? []) as Array<{ id?: string }>).map(row => row.id));
      for (const row of rows as Array<{ id?: string }>) if (row.id && !kept.has(row.id)) missing.push(`${String(key)}:${row.id}`);
    }
    expect(missing).toEqual([]);
  });

  it("bases the in-house team at Central, where most in-house work happens", () => {
    const homes = (story.technicianProfiles ?? []).map(p => p.homeRegionId);
    expect(homes.filter(h => h === "region-northline-central")).toHaveLength(4);
    const region = new Map(story.stores.map(s => [s.id, s.regionId]));
    const internal = story.assignments.filter(a => a.kind === "internal").map(a => region.get(story.workOrders.find(w => w.id === a.workOrderId)!.storeId));
    const central = internal.filter(r => r === "region-northline-central").length;
    expect(central).toBeGreaterThan(internal.length / 2);
  });

  it("gives every vendor real, varied work and one shared type of work to compare", () => {
    const facts = vendorJobFactsFromFixture(story, { organizationId: org }, { from: scorecardWindowAt(story.asOf, 365, 0).from, to: story.asOf });
    for (const vendor of story.vendors) expect(facts.filter(f => f.vendorId === vendor.id).length, vendor.name).toBeGreaterThan(8);
    const groups = buildScorecard(facts, [], story.asOf).filter(g => g.vendors.length > 1 && g.trade !== "unclassified");
    expect(groups.map(g => g.trade)).toContain("hvac");
    // Vendors behave differently: response times are not all the same.
    const responses = new Set(facts.filter(f => f.firstResponseAt).map(f => Math.round((Date.parse(f.firstResponseAt!) - Date.parse(f.sentAt)) / 600_000)));
    expect(responses.size).toBeGreaterThan(20);
    expect(facts.some(f => f.declined)).toBe(true);
    expect(facts.filter(f => f.appointmentAt && f.firstCheckInAt).length).toBeGreaterThan(50);
    expect(facts.some(f => f.checkDecision === "rejected")).toBe(true);
  });

  it("has steady history: every one of the last 24 months has work", () => {
    const end = Date.parse(story.asOf);
    for (let back = 1; back <= 24; back++) {
      const month = new Date(end - back * 30 * DAY).toISOString().slice(0, 7);
      expect(story.workOrders.filter(w => w.createdAt.startsWith(month)).length, month).toBeGreaterThanOrEqual(8);
    }
  });

  it("has something current for Since you last looked, limbo and repeat problems", async () => {
    const repository = createOpsFixtureRepository(story), scope = { organizationId: org };
    const from = new Date(Date.parse(story.asOf) - 7 * DAY).toISOString();
    for (const kind of SINCE_KINDS) expect(await repository.countWorkOrders(scope, { change: { kind, from, to: story.asOf } }), kind).toBeGreaterThan(0);
    const limbo = story.workOrders.filter(w => w.status === "completed_pending_review");
    expect(limbo.length).toBeGreaterThan(2);
    expect(limbo.some(w => w.dueAt! < story.asOf)).toBe(true);
    const repeat = equipmentIssuesFromFixture(story, scope, repeatProblemWindow(story.asOf), { limit: 10, minIssueCount: REPEAT_WORK_MIN_JOBS }).items.map(r => r.id);
    expect(repeat).toEqual(expect.arrayContaining(["asset-104-beer-cave", "asset-112-ice-machine"]));
  });
});
