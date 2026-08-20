import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AssetReplacementIntelligencePanel,
  ReplacementProfileManager,
} from "@/components/ops/replacement-intelligence-panel";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ getOpsRequestContext: vi.fn(), getSnapshot: vi.fn(), getRepository: vi.fn() }));
vi.mock("@/lib/server/ops-request-context", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/ops-request-context")>("@/lib/server/ops-request-context");
  return { ...actual, getOpsRequestContext: mocks.getOpsRequestContext };
});
vi.mock("@/lib/server/ops-repository-provider", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/ops-repository-provider")>("@/lib/server/ops-repository-provider");
  return { ...actual, getServerOpsFixtureSnapshot: mocks.getSnapshot, getServerOpsRepository: mocks.getRepository };
});

import { POST as updateAssetReplacement } from "@/app/api/ops/equipment/[id]/replacement/route";
import { POST as updateReplacementProfiles } from "@/app/api/ops/replacement-profiles/route";

function context() {
  const repository = createOpsFixtureRepository(buildNorthlinePresentationFixture());
  const session = {
    organizationId: NORTHLINE_ORGANIZATION_ID,
    role: "facilities" as const,
    membershipId: "membership-northline-facilities",
    displayName: "Jordan Lee",
  };
  mocks.getOpsRequestContext.mockResolvedValue({
    session,
    repository,
    actor: {
      organizationId: session.organizationId,
      actorType: "user",
      actorId: session.membershipId,
      actorName: session.displayName,
    },
  });
  mocks.getSnapshot.mockImplementation(() => Promise.resolve(repository.snapshot()));
  mocks.getRepository.mockResolvedValue(repository);
  return repository;
}

describe("interactive replacement intelligence", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders real profile, benchmark, equipment override, and closeout form targets", () => {
    const profileMarkup = renderToStaticMarkup(createElement(ReplacementProfileManager, {
      model: {
        permitted: true,
        action: "/api/ops/replacement-profiles",
        profiles: [{ id: "profile-1", code: "REF", name: "Refrigeration", categoryLabel: "Refrigeration", description: "Comparable system", specificationLabel: "Capacity: 5 ton", expectedLifeLabel: "15 years", escalationLabel: "3.00% annually", benchmarkAmountLabel: "$30,000", benchmarkSourceLabel: "Approved quote", benchmarkEffectiveLabel: "Aug 9, 2026", evidenceHistoryLabel: "1 dated source", peerCount: 4 }],
        categories: [{ id: "refrigeration", label: "Refrigeration" }],
      },
    }));
    const assetMarkup = renderToStaticMarkup(createElement(AssetReplacementIntelligencePanel, {
      model: {
        assetId: "asset-1", permitted: true, action: "/api/ops/equipment/asset-1/replacement",
        currentAmountLabel: "$30,000", rangeLabel: "$27,000–$36,000 planning range", sourceLabel: "Approved quote", effectiveLabel: "Aug 9, 2026", freshnessLabel: "Current", explanation: "One dated source, not a market average.",
        currentProfileId: "profile-1", profileName: "Refrigeration", specificationLabel: "Capacity: 5 ton", adjustmentLabel: "None", inheritedPeerCount: 4,
        profiles: [], event: { id: "event-1", approvedAmountLabel: "$30,000", approvedAtLabel: "Aug 9, 2026", workOrderNumber: "NL-2026-001" },
        recommendation: { recommendationLabel: "Capital Review", confidenceLabel: "Medium", explanation: "One transparent threshold is met.", missingData: ["Verified downtime history"] },
        recommendationHistory: [{ id: "rec-1", version: 1, modelVersion: "transparent-rules-v1", recommendationLabel: "Capital Review", confidenceLabel: "Medium", decisionLabel: "Investigate", reason: "Confirm the compressor scope.", decidedAtLabel: "Aug 9, 2026", explanation: "One transparent threshold is met.", missingData: ["Verified downtime history"], actualOutcomeLabel: "Outcome not recorded yet" }],
        assetDefaults: { tag: "BC-01", name: "Beer cave", manufacturer: "Hillphoenix", model: "BC-5", supplier: "Supplier" },
      },
    }));
    expect(profileMarkup).toContain('action="/api/ops/replacement-profiles"');
    expect(profileMarkup).toContain("Publish a newer benchmark");
    expect(assetMarkup).toContain('action="/api/ops/equipment/asset-1/replacement"');
    expect(assetMarkup).toContain("Save equipment-only estimate");
    expect(assetMarkup).toContain("Retire old equipment and create successor");
    expect(assetMarkup).toContain("Record versioned recommendation and decision");
    expect(assetMarkup).toContain("Recommendation history (1)");
  });

  it("records a server-derived versioned recommendation with the manager decision and audit", async () => {
    const repository = context();
    const asset = repository.snapshot().assets.find((row) => row.id === "asset-104-beer-cave")!;
    const before = repository.snapshot().lifecycleRecommendations.filter((row) => row.assetId === asset.id).length;
    const form = new FormData();
    form.set("operation", "record-recommendation");
    form.set("userDecision", "investigate");
    form.set("userReason", "Confirm roof-access scope and obtain one comparable quote before committing capital.");
    const response = await updateAssetReplacement(new Request(`https://ops.test/api/ops/equipment/${asset.id}/replacement`, { method: "POST", body: form }), { params: Promise.resolve({ id: asset.id }) });
    expect(response.status).toBe(303);
    const after = repository.snapshot();
    expect(after.lifecycleRecommendations.filter((row) => row.assetId === asset.id)).toHaveLength(before + 1);
    expect(after.lifecycleRecommendations).toContainEqual(expect.objectContaining({ assetId: asset.id, modelVersion: "transparent-rules-v1", userDecision: "investigate", confidence: expect.stringMatching(/low|medium|high/), missingData: expect.any(Array) }));
    expect(after.auditEvents).toContainEqual(expect.objectContaining({ aggregateId: asset.id, eventType: "asset.lifecycle_recommendation_recorded" }));
  });

  it("creates a planning profile through the authorized server route", async () => {
    const repository = context();
    const form = new FormData();
    form.set("operation", "create-profile");
    form.set("code", "DEMO-ICE-MAKER");
    form.set("name", "Demo ice maker group");
    form.set("description", "Functional comparison group created during the demo.");
    form.set("categoryKey", "refrigeration");
    form.set("expectedLifeYears", "12");
    form.set("annualEscalationBps", "300");
    form.set("lowVarianceBps", "1000");
    form.set("highVarianceBps", "2000");
    const response = await updateReplacementProfiles(new Request("https://ops.test/api/ops/replacement-profiles", { method: "POST", body: form }));
    expect(response.status).toBe(303);
    expect(repository.snapshot().replacementProfiles).toContainEqual(expect.objectContaining({ code: "DEMO-ICE-MAKER", active: true }));
    expect(repository.snapshot().auditEvents).toContainEqual(expect.objectContaining({ eventType: "replacement_profile.created" }));
  });

  it("persists an equipment-specific estimate without changing its inherited profile benchmark", async () => {
    const repository = context();
    const fixtureBefore = repository.snapshot();
    const asset = fixtureBefore.assets.find((row) => row.id === "asset-104-beer-cave")!;
    const publishedBefore = fixtureBefore.replacementBenchmarks.filter((row) => row.status === "published").map((row) => row.id).sort();
    const form = new FormData();
    form.set("operation", "set-override");
    form.set("amount", "42500.00");
    form.set("effectiveAt", "2026-08-20");
    form.set("reason", "Roof access and crane scope are unique to this Store.");
    const response = await updateAssetReplacement(new Request(`https://ops.test/api/ops/equipment/${asset.id}/replacement`, { method: "POST", body: form }), { params: Promise.resolve({ id: asset.id }) });
    expect(response.status).toBe(303);
    const after = repository.snapshot();
    expect(after.assetReplacementOverrides).toContainEqual(expect.objectContaining({ assetId: asset.id, amount: { amountMinor: 4_250_000, currency: "USD" }, status: "active" }));
    expect(after.replacementBenchmarks.filter((row) => row.status === "published").map((row) => row.id).sort()).toEqual(publishedBefore);
  });

  it("records the later actual outcome when an approved replacement is completed", async () => {
    const repository = context();
    const assetId = "asset-115-beer-cave";
    const event = repository.snapshot().replacementEvents.find((row) => row.assetId === assetId && row.status === "approved")!;
    const form = new FormData();
    form.set("operation", "complete-replacement");
    form.set("eventId", event.id);
    form.set("finalAmount", "33650.00");
    form.set("installedAt", "2026-08-20");
    form.set("newAssetTag", "BC-115-R2");
    form.set("newAssetName", "Beer cave refrigeration system replacement");
    form.set("manufacturer", "Hillphoenix");
    form.set("model", "BC-R2");
    const response = await updateAssetReplacement(new Request(`https://ops.test/api/ops/equipment/${assetId}/replacement`, { method: "POST", body: form }), { params: Promise.resolve({ id: assetId }) });
    expect(response.status).toBe(303);
    const after = repository.snapshot();
    expect(after.lifecycleRecommendations.find((row) => row.assetId === assetId)).toEqual(expect.objectContaining({ actualOutcome: "replaced", replacementEventId: event.id }));
    expect(after.assets.find((row) => row.id === assetId)?.status).toBe("retired");
    expect(after.assets).toContainEqual(expect.objectContaining({ assetTag: "BC-115-R2", status: "operational" }));
  });
});
