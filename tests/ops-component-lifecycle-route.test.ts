import { beforeEach, describe, expect, it, vi } from "vitest";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ getContext: vi.fn(), getRepository: vi.fn() }));
vi.mock("@/lib/server/ops-request-context", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/ops-request-context")>("@/lib/server/ops-request-context");
  return { ...actual, getOpsRequestContext: mocks.getContext };
});
vi.mock("@/lib/server/ops-repository-provider", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/ops-repository-provider")>("@/lib/server/ops-repository-provider");
  return { ...actual, getServerOpsRepository: mocks.getRepository };
});

import { POST } from "@/app/api/ops/equipment/[id]/components/[componentId]/replacement/route";

function setup() {
  const fixture = buildNorthlinePresentationFixture();
  const prior = fixture.repairItems.find((item) => item.id === "repair-item-104-compressor-2026-07")!;
  fixture.componentLifecycleEvents = fixture.componentLifecycleEvents.filter((item) => item.repairItemId !== prior.id);
  fixture.appliedWarranties = fixture.appliedWarranties.filter((item) => item.repairItemId !== prior.id);
  fixture.repairItems = fixture.repairItems.filter((item) => item.id !== prior.id);
  const repository = createOpsFixtureRepository(fixture);
  const session = { organizationId: NORTHLINE_ORGANIZATION_ID, role: "facilities" as const, membershipId: "membership-northline-facilities", displayName: "Jordan Lee" };
  mocks.getContext.mockResolvedValue({ session, repository, actor: { organizationId: session.organizationId, actorType: "user", actorId: session.membershipId, actorName: session.displayName } });
  mocks.getRepository.mockResolvedValue(repository);
  return { repository, prior };
}

function form(prior: ReturnType<typeof setup>["prior"]) {
  const body = new FormData();
  body.set("siteVisitWorkOrderId", prior.siteVisitWorkOrderId); body.set("replacementKind", "reactive"); body.set("repairSeverity", "major");
  body.set("removedAt", "2026-08-20"); body.set("installedAt", "2026-08-20"); body.set("warrantyEndsAt", "2028-08-20");
  body.set("installedComponentName", "Compressor"); body.set("partManufacturer", "Copeland"); body.set("partModel", "ZB38KCE-TFD"); body.set("partNumber", "ZB38KCE-TFD"); body.set("serialNumber", "DEMO-NEW-001"); body.set("expectedLifeMonths", "96");
  body.set("laborCost", "1650.00"); body.set("partCost", "7250.00"); body.set("currency", "USD"); body.set("vendorSupplied", "yes"); body.set("failureMode", "compressor-ground-fault"); body.set("rootCause", "Internal winding insulation failure"); body.set("repairAction", "Removed, installed, evacuated, charged, and commissioned replacement compressor.");
  return body;
}

describe("Component replacement route", () => {
  beforeEach(() => vi.clearAllMocks());
  it("persists the complete structured replacement through the authorized server route", async () => {
    const { repository, prior } = setup();
    const response = await POST(new Request("https://ops.test/api/ops/equipment/asset-104-beer-cave/components/component-104-compressor/replacement", { method: "POST", body: form(prior) }), { params: Promise.resolve({ id: "asset-104-beer-cave", componentId: "component-104-compressor" }) });
    expect(response.status).toBe(303);
    const snapshot = repository.snapshot();
    expect(snapshot.componentLifecycleEvents).toHaveLength(1);
    expect(snapshot.componentLifecycleEvents[0]).toMatchObject({ removedComponentId: "component-104-compressor", partManufacturer: "Copeland", replacementKind: "reactive", expectedLifeMonths: 96 });
    expect(snapshot.repairItems).toContainEqual(expect.objectContaining({ id: snapshot.componentLifecycleEvents[0].repairItemId, siteVisitWorkOrderId: prior.siteVisitWorkOrderId }));
  });
});
