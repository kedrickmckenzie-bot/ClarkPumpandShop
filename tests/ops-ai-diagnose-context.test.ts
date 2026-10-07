import { describe, expect, it, vi } from "vitest";
import type { OperatorSession } from "@/components/ops/data-contract";
import { NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import { resetNorthlineFixtureRepository } from "@/lib/ops/fixture-repository";

vi.mock("server-only", () => ({}));
import { aiDiagnoseContext } from "@/lib/server/ai-diagnose-context";

const session = { accessMode: "preview", demoEdition: "complete", role: "technician", userId: "user-northline-tech-1", membershipId: "membership-northline-tech-1", organizationId: NORTHLINE_ORGANIZATION_ID, organizationName: "Clark Pump and Shop", displayName: "Maria", email: "tech@example.test", companywide: true, scopeLabel: "Test", permissions: ["ops:write"] } as unknown as OperatorSession;

describe("troubleshooting context for a job not linked to equipment", () => {
  it("uses the store's beer cave records when the report names the beer cave, and says it is not linked", async () => {
    const repository = resetNorthlineFixtureRepository();
    const job = (await repository.listWorkOrders({ organizationId: NORTHLINE_ORGANIZATION_ID }, { search: "evaporator fan stops intermittently", limit: 5 })).items.find(row => row.storeNumber === "104");
    expect(job).toBeDefined();
    const context = await aiDiagnoseContext(repository, session, { workOrderId: job!.id });
    expect(context.assetId).toBe("asset-104-beer-cave");
    expect(context.equipment).toContain("NOT linked on this job");
    expect(context.history).not.toBe("");
  });
});
