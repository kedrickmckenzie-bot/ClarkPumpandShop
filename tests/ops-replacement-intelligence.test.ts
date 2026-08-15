import { describe, expect, it } from "vitest";
import type { OpsCommandServices } from "@/lib/ops/commands";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import { resolveAssetReplacementEstimate } from "@/lib/ops/replacement-intelligence";
import { approveReplacementFromSelectedQuote, completeReplacement, createReplacementProfile, publishManualReplacementBenchmark } from "@/lib/ops/replacement-commands";
import { selectEstimate } from "@/lib/ops/estimate-commands";

const actor = { organizationId: NORTHLINE_ORGANIZATION_ID, actorType: "user" as const, actorId: "membership-northline-facilities", actorName: "Jordan Lee" };

function harness(now = "2026-08-15T12:00:00.000Z") {
  const repository = createOpsFixtureRepository(buildNorthlinePresentationFixture());
  let sequence = 0;
  const services: OpsCommandServices = { repository, clock: { now: () => now }, ids: { next: (prefix) => `${prefix}-test-${String(++sequence).padStart(3, "0")}` } };
  return { repository, services };
}

describe("replacement intelligence", () => {
  it("uses a dated functional benchmark across manufacturers while preserving an equipment override", () => {
    const fixture = buildNorthlinePresentationFixture();
    const store101 = fixture.assets.find((asset) => asset.id === "asset-101-beer-cave")!;
    const store104 = fixture.assets.find((asset) => asset.id === "asset-104-beer-cave")!;
    const peer = resolveAssetReplacementEstimate(fixture, store101, fixture.asOf);
    const override = resolveAssetReplacementEstimate(fixture, store104, fixture.asOf);

    expect(peer).toMatchObject({ source: "profile_benchmark", benchmarkId: "replacement-benchmark-beer-cave-2026-quote", freshness: "current" });
    expect(peer.amount?.amountMinor).toBeGreaterThanOrEqual(3_280_000);
    expect(peer.explanation).toContain("Medium beer cave refrigeration system benchmark");
    expect(override).toMatchObject({ source: "asset_override", amount: { amountMinor: 3_480_000, currency: "USD" } });
    expect(store101.manufacturer).not.toBe(store104.manufacturer);
  });

  it("publishes one new profile benchmark and dynamically refreshes all mapped peers", async () => {
    const { repository, services } = harness();
    const before = repository.snapshot();
    const asset = before.assets.find((row) => row.id === "asset-101-rtu-1")!;
    const prior = resolveAssetReplacementEstimate(before, asset, before.asOf);
    const benchmark = await publishManualReplacementBenchmark(services, { organizationId: NORTHLINE_ORGANIZATION_ID, profileId: "replacement-profile-rtu-5ton", equipmentAmountMinor: 2_000_000, installationAmountMinor: 750_000, otherAmountMinor: 100_000, currency: "USD", effectiveAt: "2026-08-14T00:00:00.000Z", notes: "Budget quote reviewed with the HVAC contractor.", actor });
    const after = repository.snapshot();
    const refreshed = resolveAssetReplacementEstimate(after, asset, after.asOf);

    expect(benchmark.totalAmount.amountMinor).toBe(2_850_000);
    expect(after.replacementBenchmarks.filter((row) => row.profileId === benchmark.profileId && row.status === "published")).toHaveLength(1);
    expect(refreshed.amount!.amountMinor).toBeGreaterThan(prior.amount!.amountMinor);
    expect(after.assets.filter((row) => row.replacementProfileId === benchmark.profileId)).toHaveLength(15);
    expect(after.auditEvents).toContainEqual(expect.objectContaining({ aggregateId: benchmark.profileId, eventType: "replacement_benchmark.published" }));
  });

  it("allows a broad planning group without a technical onboarding questionnaire", async () => {
    const { services } = harness();
    const profile = await createReplacementProfile(services, { organizationId: NORTHLINE_ORGANIZATION_ID, code: "REF-GENERAL", name: "General refrigeration replacement", description: "Broad starting group refined only when real replacement evidence shows a meaningful difference.", categoryKey: "refrigeration", matchKeys: [], attributes: {}, expectedLifeYears: 15, actor });

    expect(profile.matchKeys).toEqual(["profile_code"]);
    expect(profile.attributes).toEqual({ profile_code: "ref_general" });
  });

  it("records a selected replacement quote as capital evidence without creating a service assignment", async () => {
    const fixture = buildNorthlinePresentationFixture();
    fixture.replacementEvents = [];
    fixture.replacementBenchmarks = fixture.replacementBenchmarks.filter((row) => row.id !== "replacement-benchmark-beer-cave-2026-quote");
    const legacy = fixture.replacementBenchmarks.find((row) => row.id === "replacement-benchmark-beer-cave-2024")!;
    legacy.status = "published";
    legacy.supersededAt = undefined;
    const repository = createOpsFixtureRepository(fixture);
    let sequence = 0;
    const services: OpsCommandServices = { repository, clock: { now: () => "2026-08-15T12:00:00.000Z" }, ids: { next: (prefix) => `${prefix}-approval-${++sequence}` } };
    const assignmentCount = fixture.assignments.length;
    const result = await approveReplacementFromSelectedQuote(services, { organizationId: NORTHLINE_ORGANIZATION_ID, workOrderId: "wo-northline-115", profileId: "replacement-profile-beer-cave-medium", equipmentAmountMinor: 2_310_000, installationAmountMinor: 820_000, otherAmountMinor: 150_000, currency: "USD", effectiveAt: "2026-08-08T16:20:00.000Z", notes: "Selected full replacement quote.", actor });
    const after = repository.snapshot();

    expect(result.event.status).toBe("approved");
    expect(result.affectedAssetCount).toBe(15);
    expect(after.assignments).toHaveLength(assignmentCount);
    expect(after.replacementBenchmarks.filter((row) => row.profileId === result.benchmark!.profileId && row.status === "published")).toEqual([expect.objectContaining({ id: result.benchmark!.id, sourceType: "approved_quote" })]);
    expect(after.outboxMessages).toContainEqual(expect.objectContaining({ aggregateId: "asset-115-beer-cave", topic: "ops.asset.replacement_approved" }));
  });

  it("can keep a vendor replacement quote local to one equipment record without changing the group", async () => {
    const fixture = buildNorthlinePresentationFixture();
    fixture.replacementEvents = [];
    fixture.replacementBenchmarks = fixture.replacementBenchmarks.filter((row) => row.id !== "replacement-benchmark-beer-cave-2026-quote");
    const legacy = fixture.replacementBenchmarks.find((row) => row.id === "replacement-benchmark-beer-cave-2024")!;
    legacy.status = "published";
    legacy.supersededAt = undefined;
    const repository = createOpsFixtureRepository(fixture);
    const result = await approveReplacementFromSelectedQuote({ repository, clock: { now: () => "2026-08-15T12:00:00.000Z" }, ids: { next: (prefix) => `${prefix}-local` } }, { organizationId: NORTHLINE_ORGANIZATION_ID, workOrderId: "wo-northline-115", profileId: "replacement-profile-beer-cave-medium", equipmentAmountMinor: 2_310_000, installationAmountMinor: 820_000, otherAmountMinor: 150_000, currency: "USD", effectiveAt: "2026-08-08T16:20:00.000Z", planningApplication: "asset_only", actor });
    const after = repository.snapshot();

    expect(result).toMatchObject({ benchmark: undefined, affectedAssetCount: 1 });
    expect(after.replacementBenchmarks.find((row) => row.id === legacy.id)).toMatchObject({ status: "published" });
    expect(after.assetReplacementOverrides).toContainEqual(expect.objectContaining({ assetId: "asset-115-beer-cave", amount: { amountMinor: 3_280_000, currency: "USD" }, status: "active" }));
  });

  it("selects a replacement quote without turning it into a service assignment", async () => {
    const fixture = buildNorthlinePresentationFixture();
    const request = fixture.estimateRequests.find((row) => row.id === "estimate-request-105-cedar")!;
    request.decisionKind = "replacement_quote";
    const repository = createOpsFixtureRepository(fixture);
    const assignmentCount = fixture.assignments.length;
    let sequence = 0;
    const result = await selectEstimate({ repository, clock: { now: () => "2026-08-14T12:00:00.000Z" }, ids: { next: (prefix) => `${prefix}-capital-select-${++sequence}` } }, { organizationId: NORTHLINE_ORGANIZATION_ID, estimateRequestId: request.id, proposalId: "estimate-proposal-105-cedar-r1", expectedRevision: 1, note: "Advance this quote to capital review.", actor });

    expect(result.assignment).toBeUndefined();
    expect(repository.snapshot().assignments).toHaveLength(assignmentCount);
    expect(await repository.getWorkOrder(NORTHLINE_ORGANIZATION_ID, "wo-northline-105-price-check")).toMatchObject({ status: "awaiting_approval", nextAction: "Review replacement quote and record capital decision" });
  });

  it("retires the old record, creates a linked successor, and replaces quote evidence with final installed cost", async () => {
    const { repository, services } = harness("2026-09-20T18:00:00.000Z");
    const result = await completeReplacement(services, { organizationId: NORTHLINE_ORGANIZATION_ID, assetId: "asset-115-beer-cave", eventId: "replacement-event-115-approved", finalAmountMinor: 3_415_000, currency: "USD", newAssetTag: "115-REF-02", newAssetName: "Beer cave condensing unit", manufacturer: "Heatcraft", model: "PRO3", serialNumber: "HC-115-2026", supplier: "Regional Equipment Supply", installedAt: "2026-09-18T00:00:00.000Z", warrantyEndsAt: "2031-09-18T00:00:00.000Z", actor });
    const after = repository.snapshot();
    const event = after.replacementEvents.find((row) => row.id === "replacement-event-115-approved");

    expect(result.retiredAsset).toMatchObject({ status: "retired", replacedByAssetId: result.replacementAsset.id });
    expect(result.replacementAsset).toMatchObject({ storeId: "store-northline-115", replacementProfileId: "replacement-profile-beer-cave-medium", status: "operational" });
    expect(event).toMatchObject({ status: "completed", replacementAssetId: result.replacementAsset.id, finalAmount: { amountMinor: 3_415_000, currency: "USD" } });
    expect(after.replacementBenchmarks.filter((row) => row.profileId === result.benchmark!.profileId && row.status === "published")).toEqual([expect.objectContaining({ sourceType: "final_cost", totalAmount: { amountMinor: 3_415_000, currency: "USD" } })]);
  });
});
