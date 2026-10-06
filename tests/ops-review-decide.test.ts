import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";
import { buildOpsSeedStatements } from "@/lib/ops/seed";
import { queryAttention } from "@/lib/ops/attention-sql";
import { attentionFromFixture } from "@/lib/ops/attention-query";
import { jobShortName, suggestShortName } from "@/lib/ops/short-name";
import { ReviewDecide } from "@/components/workspace/review-decide";
import type { OpsSqlDriver, SqlRow } from "@/lib/ops/sql-driver";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

it("splits Review into new, stuck and done the same way in SQL and the fixture", async () => {
  const fixture = buildNorthlinePresentationFixture(), org = fixture.organizations[0].id;
  const db = new DatabaseSync(":memory:");
  const driver: OpsSqlDriver = { dialect: "sqlite", async query<Row extends SqlRow>(statement: { sql: string; params: readonly unknown[] }) { return { rows: db.prepare(statement.sql).all(...statement.params as SQLInputValue[]) as Row[], affectedRows: 0 }; }, async atomic() { throw new Error("Read must not mutate"); } };
  const scope = { organizationId: org }, access = { role: "facilities_admin" as const, canOpenWarranty: true, canOpenRequest: true };
  try {
    for (const file of readdirSync("drizzle").filter(file => /^\d.*\.sql$/.test(file)).sort()) db.exec(readFileSync(`drizzle/${file}`, "utf8"));
    for (const statement of buildOpsSeedStatements(fixture)) db.prepare(statement.sql).run(...statement.params.map(v => typeof v === "boolean" ? Number(v) : v ?? null) as SQLInputValue[]);
    const counts: Record<string, number> = {};
    for (const stage of ["new", "stuck", "done", "decide"] as const) {
      // A lane and search alongside the stage proves its parameters stay in order.
      for (const extra of [{}, { lane: "team" as const, q: "e" }]) {
        const query = { asOf: fixture.asOf, stage, limit: 200, ...extra };
        const sql = await queryAttention(driver, scope, access, query);
        expect(sql.items.map(row => row.id).sort()).toEqual(attentionFromFixture(fixture, scope, access, query).items.map(row => row.id).sort());
        if (!("lane" in extra)) counts[stage] = sql.totalCount;
      }
    }
    expect(counts.new + counts.stuck + counts.done).toBe(counts.decide);
    expect(counts.decide).toBeGreaterThan(0);
    const stuck = await queryAttention(driver, scope, access, { asOf: fixture.asOf, stage: "stuck", limit: 200 });
    for (const row of stuck.items) expect(fixture.followUps.some(f => f.workOrderId === row.workOrderId && f.status === "open")).toBe(true);
  } finally { db.close(); }
}, 120_000);

it("suggests a few-word job name and prefers the manager's name", () => {
  expect(suggestShortName("The beer cave door is not sealing")).toBe("Beer cave door");
  expect(suggestShortName("Ice machine is leaking into the drain")).toBe("Ice machine");
  expect(jobShortName({ shortName: "Cooler fan", assetName: "Walk-in cooler", problem: "Fan is loud" })).toBe("Cooler fan");
  expect(jobShortName({ assetName: "Walk-in cooler", problem: "Fan is loud" })).toBe("Walk-in cooler");
});

it("shows each Review section with one clear decision button", () => {
  const row = (id: string, title: string) => ({ id, sourceKind: "workflow_task" as const, workOrderId: `wo-${id}`, storeId: "s", title, reason: "", owner: "Facilities", priority: "high" as const, lane: "team" as const, linkHref: `/app/work-orders/wo-${id}`, storeLabel: "Store 114 · North Market", workNumber: `CPS-${id}`, problem: `Problem ${id}`, sourceCount: 1, group: "work_vendor" as const });
  const html = renderToStaticMarkup(createElement(ReviewDecide, {
    asOf: "2026-10-05T12:00:00.000Z", canRoute: true, allOpenCount: 40,
    sections: [
      { stage: "new", rows: [row("1", "Review issue")], totalCount: 1 },
      { stage: "stuck", rows: [], totalCount: 0 },
      { stage: "done", rows: [row("3", "Verify repair")], totalCount: 12 },
    ],
  }));
  for (const text of ["New · needs a decision (1)", "Nothing is stuck.", "Done · needs a check (12)", "Problem 1", "Urgent", "Check it", "Show all 12", "See everything open (40)"]) expect(html).toContain(text);
  expect(html).toContain("stage=done");
});

it("keeps Needs your action, its breakdown and Review's sections in agreement", async () => {
  const { createOpsFixtureRepository } = await import("@/lib/ops/fixture-repository");
  const { yourActionBreakdown } = await import("@/lib/ops/your-actions");
  const fixture = buildNorthlinePresentationFixture(), org = fixture.organizations[0].id, repository = createOpsFixtureRepository(fixture);
  for (const [role, membershipId] of [["facilities_admin", "membership-northline-facilities"], ["regional_manager", "membership-northline-regional-1"], ["store_manager", "membership-northline-store-101"]] as const) {
    const scope = { organizationId: org }, access = { role, canOpenWarranty: true, canOpenRequest: true, membershipId };
    const all = await repository.listAttention(scope, access, { asOf: fixture.asOf, limit: 1 });
    const breakdown = await yourActionBreakdown(repository, scope, access, fixture.asOf);
    // The parts of the breakdown add up to the "Needs your action" number.
    expect([...breakdown.matchAll(/(\d+) /g)].reduce((n, m) => n + Number(m[1]), 0)).toBe(all.mineCount);
    // "N to review" equals New + Stuck + Done on the Review page.
    const sections = await Promise.all((["new", "stuck", "done"] as const).map(stage => repository.listAttention(scope, access, { asOf: fixture.asOf, stage, limit: 1 })));
    expect((await repository.listAttention(scope, access, { asOf: fixture.asOf, stage: "decide", limit: 1 })).totalCount).toBe(sections.reduce((n, s) => n + s.totalCount, 0));
    // Every job decision assigned to you shows in Review.
    const mine = await repository.listAttention(scope, access, { asOf: fixture.asOf, lane: "mine", limit: 200 });
    const inReview = new Set((await repository.listAttention(scope, access, { asOf: fixture.asOf, lane: "mine", stage: "decide", limit: 200 })).items.map(r => r.id));
    for (const row of mine.items.filter(r => ["review_issue", "choose_service_provider", "approve_quote", "review_warranty", "schedule_service", "schedule_return_visit", "verify_repair", "close_verified_work"].includes(r.taskType ?? ""))) expect(inReview.has(row.id)).toBe(true);
  }
});
