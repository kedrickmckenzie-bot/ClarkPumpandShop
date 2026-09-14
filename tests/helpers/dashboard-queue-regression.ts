import { expect } from "vitest";
import type { OpsRepository } from "@/lib/ops/repository";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import { WORK_STAGE_STATUSES, matchesWorkStage } from "@/lib/ops/dashboard-cohorts";

/** Same IDs, scope and pagination against fixture, real SQLite and embedded PostgreSQL. */
export async function dashboardQueueRegression(repository: OpsRepository) {
  const fixture = buildNorthlinePresentationFixture();
  const scope = { organizationId: NORTHLINE_ORGANIZATION_ID };
  const pending = fixture.requests.filter((row) => ["submitted", "under_review"].includes(row.status));
  const ids: string[] = [];
  for (let offset = 0; offset < pending.length; offset += 2) {
    const page = await repository.listRequests(scope, { status: "pending", limit: 2, offset });
    ids.push(...page.items.map((row) => row.id));
  }
  expect(ids).toHaveLength(pending.length);
  expect(new Set(ids)).toEqual(new Set(pending.map((row) => row.id)));
  const first = await repository.listRequests(scope, { status: "pending", limit: 2 });
  const next = await repository.listRequests(scope, { status: "pending", limit: 2, cursor: first.nextCursor });
  expect(new Set([...first.items, ...next.items].map((row) => row.id)).size).toBe(4);
  const selected = pending[0];
  expect((await repository.listRequests(scope, { status: "pending", search: selected.reference })).items.map((row) => row.id)).toEqual([selected.id]);
  for (const store of fixture.stores) {
    const expected = pending.filter((row) => row.storeId === store.id).map((row) => row.id);
    expect(new Set((await repository.listRequests({ ...scope, storeIds: [store.id] }, { status: "pending" })).items.map((row) => row.id))).toEqual(new Set(expected));
  }
  for (const [stage, statuses] of Object.entries(WORK_STAGE_STATUSES)) {
    const expected = fixture.workOrders.filter((work) => matchesWorkStage(work, stage, fixture));
    const found = await repository.listWorkOrders(scope, { statuses, stage, limit: 100 });
    expect(new Set(found.items.map((row) => row.id)), stage).toEqual(new Set(expected.map((row) => row.id)));
  }
  expect((await repository.listRequests({ organizationId: "other-tenant" }, { status: "pending" })).items).toEqual([]);
  expect((await repository.listRequests({ ...scope, storeIds: [] }, { status: "pending" })).items).toEqual([]);
}
