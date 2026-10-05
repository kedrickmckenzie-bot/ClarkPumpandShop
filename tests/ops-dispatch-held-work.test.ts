import { beforeEach, expect, it, vi } from "vitest";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildShowcaseFixture } from "@/lib/ops/showcase-fixture";
import { loadDispatchBoard } from "@/lib/server/dispatch-board-page";
import { POST as releaseHeld } from "@/app/api/ops/internal-dispatch/held/[id]/route";
import { canPlanJob } from "@/lib/ops/dispatch-board";
import { dispatchNow, dispatchOrg } from "./helpers/internal-dispatch-regression";
import type { OperatorSession } from "@/components/ops/data-contract";

const mocks = vi.hoisted(() => ({ session: vi.fn(), repository: vi.fn() }));
vi.mock("@/app/app/_data/operator-loader", () => ({ loadOperatorSession: mocks.session }));
vi.mock("@/lib/server/ops-repository-provider", () => ({ getServerOpsRepository: mocks.repository }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

let session: OperatorSession;
let repository: ReturnType<typeof createOpsFixtureRepository>;
beforeEach(() => {
  repository = createOpsFixtureRepository(buildShowcaseFixture(dispatchNow));
  session = { accessMode: "authenticated", demoEdition: "complete", role: "facilities", userId: "user-northline-facilities", membershipId: "membership-northline-facilities", organizationId: dispatchOrg, organizationName: "Fictional QA", displayName: "Jordan", email: "qa@example.test", companywide: true, scopeLabel: "Test", permissions: ["ops:write"] };
  mocks.repository.mockResolvedValue(repository);
  mocks.session.mockImplementation(async () => session);
});
const post = (id: string) => releaseHeld(new Request(`http://localhost/api/ops/internal-dispatch/held/${id}`, { method: "POST", headers: { origin: "http://localhost", host: "localhost" } }), { params: Promise.resolve({ id }) });

it("loads next-visit work separately from jobs that need a tech", async () => {
  const board = await loadDispatchBoard({ view: "map" });
  expect(board.held.length).toBeGreaterThan(0);
  expect(board.held.every(job => job.visitHoldPosture)).toBe(true);
  expect(board.queue.items.some(job => board.held.some(held => held.id === job.id))).toBe(false);
  // The list and week pages don't need it.
  expect((await loadDispatchBoard({ view: "list" })).held).toEqual([]);
});

it("takes a job off the next-visit list so it can be planned, and keeps a record", async () => {
  const held = (await loadDispatchBoard({ view: "map" })).held[0];
  expect(canPlanJob(held)).toBe(false);
  const response = await post(held.id);
  expect(response.status).toBe(200);
  const { job } = await response.json() as { job: typeof held };
  expect(job.visitHoldPosture).toBeUndefined();
  expect(job.dueAt).toBe(held.dueAt);
  expect((await loadDispatchBoard({ view: "map" })).held.map(j => j.id)).not.toContain(held.id);
  expect(repository.snapshot().auditEvents.some(e => e.aggregateId === held.id && e.eventType === "work_order.visit_hold_released")).toBe(true);
  // A second release is refused: the job is no longer set aside.
  expect((await post(held.id)).status).toBe(409);
});

it("only lets planners release next-visit work", async () => {
  const held = (await loadDispatchBoard({ view: "map" })).held[0];
  session = { ...session, role: "technician", membershipId: "membership-northline-tech-1", userId: "user-northline-tech-1" };
  expect((await post(held.id)).status).toBe(403);
});
