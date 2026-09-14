import { beforeEach, describe, expect, it, vi } from "vitest";
import { createNorthlineFixtureRepository } from "@/lib/ops/fixture-repository";
import { loadOperatorSession } from "@/app/app/_data/operator-loader";
import { getOpsRequestContext, assertStoreInSessionScope } from "@/lib/server/ops-request-context";
import { POST as selectRole } from "@/app/api/ops/preview-role/route";
import { POST as createWork } from "@/app/api/ops/work-orders/route";

const boundary = vi.hoisted(() => ({ cookies: new Map<string, string>(), repository: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => boundary.cookies.has(name) ? { value: boundary.cookies.get(name) } : undefined }) }));
vi.mock("@/app/chatgpt-auth", () => ({ getChatGPTUser: async () => null }));
vi.mock("@/lib/server/ops-repository-provider", () => ({ getServerOpsRepository: () => boundary.repository() }));

async function switchRole(role: string) {
  const body = new FormData();
  body.set("role", role);
  const response = await selectRole(new Request("http://localhost/api/ops/preview-role", { method: "POST", body }));
  // Exercise the actual session loader with the root cookie emitted by the
  // route. Native cookie path migration is additionally checked over HTTP.
  for (const header of response.headers.getSetCookie()) {
    if (!/; Path=\/;/.test(header)) continue;
    const [name, value] = header.split(";")[0].split("=");
    boundary.cookies.set(name, value);
  }
}

describe("preview page and command identity", () => {
  beforeEach(() => boundary.cookies.clear());

  it("retains store scope and rejects facilities-only commands", async () => {
    boundary.repository.mockReturnValue(createNorthlineFixtureRepository());
    await switchRole("store_manager");
    const pageSession = await loadOperatorSession();
    expect(pageSession).toMatchObject({ role: "store_manager", storeIds: ["store-northline-104"] });
    const context = await getOpsRequestContext(["store_manager"]);
    expect(context.session).toEqual(pageSession);
    expect(context.actor.actorId).toBe(pageSession.membershipId);
    await expect(assertStoreInSessionScope(pageSession, "store-northline-105")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getOpsRequestContext(["facilities"])).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("uses the selected regional membership for a persisted command and its audit", async () => {
    const repository = createNorthlineFixtureRepository();
    boundary.repository.mockReturnValue(repository);
    await switchRole("regional");
    const pageSession = await loadOperatorSession();
    const store = repository.snapshot().stores.find((row) => pageSession.regionIds?.includes(row.regionId!))!;
    const body = new FormData();
    body.set("storeId", store.id);
    body.set("problem", "Preview identity regression: routine inspection");
    body.set("priority", "routine");
    body.set("assignmentKind", "choose_later");
    const response = await createWork(new Request("http://localhost/api/ops/work-orders", { method: "POST", body }));
    expect(response.status).toBe(303);
    const snapshot = repository.snapshot();
    const work = snapshot.workOrders.find((row) => row.problem === "Preview identity regression: routine inspection");
    expect(work).toMatchObject({ storeId: store.id, organizationId: pageSession.organizationId });
    const event = snapshot.auditEvents.find((row) => row.eventType === "work_order.created" && row.aggregateId === work?.id);
    expect(event).toMatchObject({ actorId: pageSession.membershipId, actorName: pageSession.displayName, organizationId: pageSession.organizationId });
    expect(event?.actorId).not.toBe("membership-northline-facilities");
  });
});
