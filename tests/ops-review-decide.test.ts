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

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/app/action-center", useSearchParams: () => new URLSearchParams() }));

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

it("shows Mine as only your items, and My stores as help, on-site by store and waiting", () => {
  const row = (id: string, title: string, stage: "new" | "stuck" | "done", bucket: "mine" | "help" | "onsite" | "waiting", extra: Record<string, unknown> = {}) => ({ id, sourceKind: "workflow_task" as const, workOrderId: `wo-${id}`, storeId: "s", title, reason: "", owner: "Facilities", priority: "high" as const, lane: "team" as const, linkHref: `/app/work-orders/wo-${id}`, storeLabel: "Store 114 · North Market", workNumber: `CPS-${id}`, problem: `Problem ${id}`, sourceCount: 1, group: "work_vendor" as const, stage, bucket, waitingOn: "Store manager", waitingSince: "2026-10-01T12:00:00.000Z", ...extra });
  const base = {
    asOf: "2026-10-05T12:00:00.000Z", canRoute: true, sent: [], showOnsite: false, showAllHelp: false,
    sections: [
      { stage: "new" as const, rows: [row("1", "Review issue", "new", "mine")], totalCount: 1 },
      { stage: "stuck" as const, rows: [], totalCount: 0 },
      { stage: "done" as const, rows: [row("3", "Verify repair", "done", "mine")], totalCount: 1 },
    ],
    help: [row("5", "Approve quote", "new", "help", { taskType: "approve_quote" })],
    onsiteByStore: [{ storeId: "s", storeLabel: "Store 114 · North Market", rows: [row("7", "Verify repair", "done", "onsite")], oldest: "2026-10-01T12:00:00.000Z" }],
    waiting: [row("9", "Vendor to respond", "new", "waiting")],
    counts: { mine: 2, help: 1, onsite: 1, waiting: 1, stores: 3 },
  };
  const mine = renderToStaticMarkup(createElement(ReviewDecide, { ...base, view: "mine" }));
  for (const text of ["Mine <b>2</b>", "My stores <b>3</b>", "New · needs a decision (1)", "Done · needs a check (1)", "Problem 1", "Urgent", "Check it"]) expect(mine).toContain(text);
  expect(mine).not.toContain("Stuck (0)");
  expect(mine).not.toContain("Problem 5");
  const stores = renderToStaticMarkup(createElement(ReviewDecide, { ...base, view: "stores" }));
  for (const text of ["You can help (1)", "Problem 5", "Review quote", "Store manager", "On-site work (1)", "Show on-site work (1)", "Waiting on others (1)"]) expect(stores).toContain(text);
  // On-site work is counted and summarized by store, but its jobs stay hidden until asked for.
  expect(stores).not.toContain("Problem 7");
  expect(renderToStaticMarkup(createElement(ReviewDecide, { ...base, view: "stores", showOnsite: true }))).toContain("Problem 7");
  const caughtUp = renderToStaticMarkup(createElement(ReviewDecide, { ...base, view: "mine", sections: [], counts: { ...base.counts, mine: 0 } }));
  expect(caughtUp).toContain("caught up");
  expect(caughtUp).toContain("See 1 item you can help with");
});

it("sorts Review items by who can act: yours, help from anywhere, on site, or waiting", async () => {
  const { reviewBucket } = await import("@/lib/ops/review-buckets");
  expect(reviewBucket({ lane: "mine", taskType: "verify_repair" }, "regional_manager")).toBe("mine");
  expect(reviewBucket({ lane: "waiting", taskType: "review_issue", assignee: { assigneeType: "role", assigneeRole: "facilities_admin" } }, "regional_manager")).toBe("help");
  expect(reviewBucket({ lane: "waiting", taskType: "verify_repair", assignee: { assigneeType: "role", assigneeRole: "store_manager" } }, "regional_manager")).toBe("onsite");
  expect(reviewBucket({ lane: "waiting", taskType: "approve_quote", assignee: { assigneeType: "role", assigneeRole: "store_manager" } }, "regional_manager")).toBe("help");
  // An approval above your limit stays with the higher level.
  expect(reviewBucket({ lane: "waiting", taskType: "approve_quote", assignee: { assigneeType: "role", assigneeRole: "facilities_admin" } }, "regional_manager")).toBe("waiting");
  expect(reviewBucket({ lane: "waiting", taskType: "approve_quote", assignee: { assigneeType: "role", assigneeRole: "regional_manager" } }, "facilities_admin")).toBe("help");
  expect(reviewBucket({ lane: "waiting", taskType: "schedule_return_visit", assignee: { assigneeType: "vendor" } }, "facilities_admin")).toBe("waiting");
  expect(reviewBucket({ lane: "team", taskType: "schedule_return_visit", assignee: { assigneeType: "user" } }, "facilities_admin")).toBe("help");
  expect(reviewBucket({ lane: "upcoming" }, "facilities_admin")).toBe("waiting");
  // Reviewing inspection paperwork is office work, even though the job's task is a repair check.
  expect(reviewBucket({ lane: "waiting", taskType: "verify_repair", assignee: { assigneeType: "role", assigneeRole: "facilities_admin" }, inspectionReview: true }, "regional_manager")).toBe("help");
});

it("puts every open Review item in exactly one place, and Mine matches the to-do count", async () => {
  const { createOpsFixtureRepository } = await import("@/lib/ops/fixture-repository");
  const { loadReviewDecide, reviewMineCount } = await import("@/lib/server/review-decide");
  const fixture = buildNorthlinePresentationFixture(), org = fixture.organizations[0].id, repository = createOpsFixtureRepository(fixture);
  for (const [role, membershipId, regionIds] of [["facilities", "membership-northline-facilities", undefined], ["regional", "membership-northline-regional-1", [fixture.regions[0].id]]] as const) {
    const session = { organizationId: org, organizationName: fixture.organizations[0].name, role, membershipId, regionIds, demoEdition: "complete" } as never;
    const review = await loadReviewDecide(repository, session, fixture.asOf);
    const all = await repository.listAttention({ organizationId: org, regionIds }, { role: role === "facilities" ? "facilities_admin" : "regional_manager", membershipId, canOpenWarranty: true, canOpenRequest: true }, { asOf: fixture.asOf, stage: "decide", limit: 100 });
    expect(review.counts.mine + review.counts.stores).toBe(all.totalCount);
    expect(review.allOpenCount).toBe(all.totalCount);
    const counted = await reviewMineCount(repository, session, fixture.asOf);
    expect(counted.mine).toBe(review.counts.mine);
    expect(counted.stores).toBe(review.counts.stores);
    // Nothing in My stores is assigned to you, and on-site work is never in "You can help".
    for (const row of review.help) expect(row.lane).not.toBe("mine");
    for (const group of review.onsiteByStore) for (const row of group.rows) {
      expect(["verify_repair", "confirm_store_access", "record_service_outcome"]).toContain(row.taskType);
      expect(row.linkHref.startsWith("/app/compliance/")).toBe(false);
      if (row.workOrderId) expect(await repository.inspectionForWork(org, row.workOrderId)).toBeNull();
    }
  }
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
    expect(breakdown.total).toBe(all.mineCount);
    expect([...breakdown.text.matchAll(/(\d+) /g)].reduce((n, m) => n + Number(m[1]), 0)).toBe(breakdown.total);
    // "N to review" equals New + Stuck + Done on the Review page.
    const sections = await Promise.all((["new", "stuck", "done"] as const).map(stage => repository.listAttention(scope, access, { asOf: fixture.asOf, stage, limit: 1 })));
    expect((await repository.listAttention(scope, access, { asOf: fixture.asOf, stage: "decide", limit: 1 })).totalCount).toBe(sections.reduce((n, s) => n + s.totalCount, 0));
    // Every job decision assigned to you shows in Review.
    const mine = await repository.listAttention(scope, access, { asOf: fixture.asOf, lane: "mine", limit: 200 });
    const inReview = new Set((await repository.listAttention(scope, access, { asOf: fixture.asOf, lane: "mine", stage: "decide", limit: 200 })).items.map(r => r.id));
    for (const row of mine.items.filter(r => ["review_issue", "choose_service_provider", "approve_quote", "review_warranty", "schedule_service", "schedule_return_visit", "verify_repair", "close_verified_work"].includes(r.taskType ?? ""))) expect(inReview.has(row.id)).toBe(true);
  }
});

it("counts every action past the first page, and keeps overdue confirmations to repair checks in the fixture and SQL", async () => {
  const { createOpsFixtureRepository } = await import("@/lib/ops/fixture-repository");
  const { yourActionBreakdown } = await import("@/lib/ops/your-actions");
  const fixture = buildNorthlinePresentationFixture(), org = fixture.organizations[0].id;
  const access = { role: "facilities_admin" as const, canOpenWarranty: true, canOpenRequest: true, membershipId: "membership-northline-facilities" }, scope = { organizationId: org };
  const template = fixture.workflowTasks.find(t => t.status === "open" && t.workOrderId && t.assigneeType === "role" && t.assigneeRole === "facilities_admin")!;
  expect(template).toBeDefined();
  // 102 extra plain tasks: more than one 100-row page.
  for (let i = 0; i < 102; i++) fixture.workflowTasks.push({ ...template, id: `extra-task-${i}`, taskType: "other", sourceFollowUpId: undefined, title: `Extra task ${i}`, blocking: false, requiredForProgress: false });
  // A closeout task that is overdue must not count as an overdue confirmation.
  // A finished job with no open follow-up, so the task lands in Done rather than Stuck.
  const work = fixture.workOrders.find(w => ["resolved", "completed_pending_review"].includes(w.status) && !fixture.followUps.some(f => f.workOrderId === w.id && f.status === "open"))!;
  expect(work).toBeDefined();
  fixture.workflowTasks.push({ ...template, id: "overdue-closeout", workOrderId: work.id, taskType: "close_verified_work", blocking: false, requiredForProgress: false, createdAt: "2019-12-01T00:00:00.000Z", dueAt: "2020-01-01T00:00:00.000Z", sourceFollowUpId: undefined });
  const repository = createOpsFixtureRepository(fixture);
  const all = await repository.listAttention(scope, access, { asOf: fixture.asOf, limit: 1 });
  const breakdown = await yourActionBreakdown(repository, scope, access, fixture.asOf);
  const sum = (text: string) => [...text.matchAll(/(\d+) /g)].reduce((n, m) => n + Number(m[1]), 0);
  expect(breakdown.total).toBe(all.mineCount);
  expect(sum(breakdown.text)).toBe(breakdown.total);
  expect(all.mineCount).toBeGreaterThan(102);
  // Past the first 100 items outside Review, the rest are still counted.
  expect(breakdown.text).toMatch(/\d+ other items?/);
  // The closeout task is in the queue (Done · needs a check) but is not an overdue confirmation.
  expect((await repository.listAttention(scope, access, { asOf: fixture.asOf, stage: "done", limit: 100 })).items.map(r => r.id)).toContain("overdue-closeout");
  const fixtureOverdue = await repository.listAttention(scope, access, { asOf: fixture.asOf, stage: "confirmation_overdue", limit: 100 });
  expect(fixtureOverdue.items.map(r => r.id)).not.toContain("overdue-closeout");
  const db = new DatabaseSync(":memory:");
  const driver: OpsSqlDriver = { dialect: "sqlite", async query<Row extends SqlRow>(statement: { sql: string; params: readonly unknown[] }) { return { rows: db.prepare(statement.sql).all(...statement.params as SQLInputValue[]) as Row[], affectedRows: 0 }; }, async atomic() { throw new Error("Read must not mutate"); } };
  try {
    for (const file of readdirSync("drizzle").filter(file => /^\d.*\.sql$/.test(file)).sort()) db.exec(readFileSync(`drizzle/${file}`, "utf8"));
    for (const statement of buildOpsSeedStatements(fixture)) db.prepare(statement.sql).run(...statement.params.map(v => typeof v === "boolean" ? Number(v) : v ?? null) as SQLInputValue[]);
    const sqlOverdue = await queryAttention(driver, scope, access, { asOf: fixture.asOf, stage: "confirmation_overdue", limit: 100 });
    expect(sqlOverdue.items.map(r => r.id).sort()).toEqual(fixtureOverdue.items.map(r => r.id).sort());
    // The hosted (SQL) breakdown matches the fixture's, item kinds included.
    const { createOpsSqlRepository } = await import("@/lib/ops/sql-repository");
    const sqlRepository = createOpsSqlRepository({ ...driver, async atomic() { throw new Error("Read must not mutate"); } }, "d1");
    expect(await yourActionBreakdown(sqlRepository, scope, access, fixture.asOf)).toEqual(breakdown);
  } finally { db.close(); }
}, 120_000);
