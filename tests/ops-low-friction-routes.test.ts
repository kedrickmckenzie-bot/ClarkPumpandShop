import { POST as updateControl } from "@/app/api/ops/work-orders/[id]/control/route";
import { GET as downloadWorkFile } from "@/app/api/ops/work-orders/[id]/files/[fileId]/route";
import { createWorkOrder } from "@/lib/ops/commands";
import { beforeEach, expect, it, vi } from "vitest";
import { POST } from "@/app/api/ops/work-orders/[id]/notes/route";
import { GET } from "@/app/api/ops/store-work/route";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import { persistedWorkOrderVersion } from "@/lib/ops/concurrency";
import type { OperatorSession } from "@/components/ops/data-contract";
const mocks = vi.hoisted(() => ({ session: vi.fn(), repository: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/app/app/_data/operator-loader", () => ({ loadOperatorSession: mocks.session }));
vi.mock("@/lib/server/ops-repository-provider", () => ({ getServerOpsRepository: mocks.repository }));
let repository: ReturnType<typeof createOpsFixtureRepository>;
let session: OperatorSession;
beforeEach(() => {
  repository = createOpsFixtureRepository(buildNorthlinePresentationFixture());
  session = { accessMode: "preview", organizationId: NORTHLINE_ORGANIZATION_ID, organizationName: "Fictional company", userId: "user-northline-store-104", membershipId: "membership-northline-store-104", displayName: "Store manager", email: "store@example.test", role: "store_manager", scopeLabel: "Store 104", storeIds: ["store-northline-104"] };
  mocks.session.mockImplementation(async () => session); mocks.repository.mockImplementation(async () => repository);
});
it("lets a store add a note without changing service status or ownership", async () => {
  const work = (await repository.listWorkOrders(session, { storeId: session.storeIds![0], statuses: ["issued", "waiting_on_parts"], limit: 1 })).items[0];
  const original = (await repository.getWorkOrder(session.organizationId, work.id))!;
  const form = new FormData(); form.set("expectedVersion", String(persistedWorkOrderVersion(original))); form.set("note", "Phone update: still waiting for the part"); form.set("status", "closed");
  const response = await POST(new Request("http://localhost:3000/api/ops/notes", { method: "POST", body: form }), { params: Promise.resolve({ id: work.id }) });
  expect(response.status).toBe(303);
  expect(await repository.getWorkOrder(session.organizationId, work.id)).toMatchObject({ status: original.status, accountableParty: original.accountableParty, nextAction: original.nextAction });
});
it("rejects notes and work lookup outside the assigned store", async () => {
  const foreign = (await repository.listWorkOrders({ organizationId: session.organizationId }, { storeId: "store-northline-105", limit: 1 })).items[0];
  const response = await POST(new Request("http://localhost:3000/api/ops/notes", { method: "POST", body: new FormData() }), { params: Promise.resolve({ id: foreign.id }) });
  expect(response.status).toBe(403);
  expect((await GET(new Request("http://localhost:3000/api/ops/store-work?store=store-northline-105"))).status).toBe(403);
});
it("returns a bounded open-work list and rejects a revoked member", async () => {
  const response = await GET(new Request("http://localhost:3000/api/ops/store-work?store=store-northline-104"));
  expect(response.status).toBe(200);
  const body = await response.json() as { items: unknown[] }; expect(body.items.length).toBeLessThanOrEqual(5); expect(body.items.length).toBeGreaterThan(0);
  session.membershipId = "revoked";
  expect((await GET(new Request("http://localhost:3000/api/ops/store-work?store=store-northline-104"))).status).toBe(403);
});

it("uploads completion photos and downloads them only through the scoped work record", async () => {
  session = { ...session, userId: "user-northline-facilities", membershipId: "membership-northline-facilities", role: "facilities", storeIds: undefined };
  const actor = { organizationId: session.organizationId, actorType: "user" as const, actorId: session.membershipId, actorName: "Jordan Lee" };
  const work = await createWorkOrder({ repository }, { organizationId: session.organizationId, storeId: "store-northline-104", problem: "Check back door latch", accountableParty: "Facilities coordinator", nextAction: "Call store", actor });
  const form = new FormData();
  for (const [key, value] of Object.entries({ operation: "manual_close", expectedVersion: String(persistedWorkOrderVersion(work)), expectedStatus: work.status, completionSource: "phone", confirmedBy: "Casey", performedDate: new Date().toISOString().slice(0, 10), resultConfirmed: "on", note: "Latch repaired and confirmed by store" })) form.set(key, value);
  const bytes = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
  form.set("attachments", new File([bytes], "latch.png", { type: "image/png" }));
  const response = await updateControl(new Request("http://localhost:3000/api/ops/work-orders/control", { method: "POST", body: form }), { params: Promise.resolve({ id: work.id }) });
  expect(response.status).toBe(303);
  const files = await repository.listFilesForEntity(session.organizationId, "work_order", work.id);
  expect(files).toHaveLength(1);
  const params = { params: Promise.resolve({ id: work.id, fileId: files[0].id }) };
  const download = await downloadWorkFile(new Request("http://localhost:3000/api/ops/files"), params);
  expect(download.status).toBe(200); expect(download.headers.get("content-type")).toBe("image/png");
  expect(new Uint8Array(await download.arrayBuffer())).toEqual(bytes);
  session = { ...session, userId: "user-northline-store-105", membershipId: "membership-northline-store-105", role: "store_manager", storeIds: ["store-northline-105"] };
  expect((await downloadWorkFile(new Request("http://localhost:3000/api/ops/files"), params)).status).toBe(403);
});
