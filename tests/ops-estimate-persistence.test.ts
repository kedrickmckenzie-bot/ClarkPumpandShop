import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  NORTHLINE_AS_OF,
  NORTHLINE_ORGANIZATION_ID,
  buildNorthlinePresentationFixture,
} from "@/lib/ops/fixtures";
import { createNorthlineFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildOpsSeedStatements } from "@/lib/ops/seed";

const priceCheckWorkOrderId = "wo-northline-105-price-check";
const summitRequestId = "estimate-request-105-summit";

describe("vendor estimate persistence foundation", () => {
  it("keeps two comparable vendor proposals on one Store 105 work order and outside recorded cost", () => {
    const fixture = buildNorthlinePresentationFixture();
    const workOrders = fixture.workOrders.filter((row) => row.id === priceCheckWorkOrderId);
    const requests = fixture.estimateRequests.filter((row) => row.workOrderId === priceCheckWorkOrderId);
    const proposals = fixture.estimateProposals.filter((row) => row.workOrderId === priceCheckWorkOrderId);

    expect(fixture.stores).toHaveLength(15);
    expect(fixture.vendors).toHaveLength(5);
    expect(workOrders).toHaveLength(1);
    expect(requests).toHaveLength(2);
    expect(new Set(requests.map((row) => row.vendorId))).toEqual(new Set([
      "vendor-northline-summit",
      "vendor-northline-cedar",
    ]));
    expect(proposals.map((row) => row.amount.amountMinor).sort((a, b) => a - b)).toEqual([
      178_000,
      245_000,
    ]);
    expect(fixture.costLines.filter((row) => row.workOrderId === priceCheckWorkOrderId)).toEqual([]);
  });

  it("serves tenant-bounded request lists and the newest immutable proposal revision", async () => {
    const repository = createNorthlineFixtureRepository();

    await expect(repository.listEstimateRequestsForWorkOrder(
      NORTHLINE_ORGANIZATION_ID,
      priceCheckWorkOrderId,
    )).resolves.toHaveLength(2);
    await expect(repository.getEstimateRequest("org-other", summitRequestId)).resolves.toBeNull();
    await expect(repository.getLatestEstimateProposal(
      NORTHLINE_ORGANIZATION_ID,
      summitRequestId,
    )).resolves.toMatchObject({ revision: 1, amount: { amountMinor: 245_000 } });

    await repository.atomicWrite([{
      sql: "INSERT INTO ops_vendor_estimate_proposals (id, organization_id, request_id, work_order_id, vendor_id, revision, amount_minor, currency, scope, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      params: [
        "estimate-proposal-105-summit-r2",
        NORTHLINE_ORGANIZATION_ID,
        summitRequestId,
        priceCheckWorkOrderId,
        "vendor-northline-summit",
        2,
        238_000,
        "USD",
        "Revised like-for-like fan motor replacement after confirming the motor part number.",
        "2026-08-10T17:00:00.000Z",
      ],
    }]);
    await expect(repository.getLatestEstimateProposal(
      NORTHLINE_ORGANIZATION_ID,
      summitRequestId,
    )).resolves.toMatchObject({ revision: 2, amount: { amountMinor: 238_000 } });

    await expect(repository.atomicWrite([{
      sql: "INSERT INTO ops_vendor_estimate_proposals (id, organization_id, request_id, work_order_id, vendor_id, revision, amount_minor, currency, scope, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      params: [
        "estimate-proposal-105-summit-r2-collision",
        NORTHLINE_ORGANIZATION_ID,
        summitRequestId,
        priceCheckWorkOrderId,
        "vendor-northline-summit",
        2,
        237_000,
        "USD",
        "Conflicting revision must fail.",
        "2026-08-10T17:01:00.000Z",
      ],
    }])).rejects.toThrow(/duplicate vendor-estimate proposal revision/i);
  });

  it("binds a public estimate capability to token, request, tenant, vendor, expiry, and unused state", async () => {
    const repository = createNorthlineFixtureRepository();
    const tokenHash = "f".repeat(64);
    await repository.atomicWrite([{
      sql: "INSERT INTO ops_public_tokens (id, organization_id, purpose, subject_type, subject_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      params: ["public-token-estimate-summit", NORTHLINE_ORGANIZATION_ID, "vendor_estimate", "work_order_estimate_request", summitRequestId, tokenHash, "2026-08-30T18:00:00.000Z", NORTHLINE_AS_OF],
    }]);

    await expect(repository.getEstimateRequestByPublicToken({
      tokenHash,
      purpose: "vendor_estimate",
      now: NORTHLINE_AS_OF,
      vendorId: "vendor-northline-summit",
    })).resolves.toMatchObject({
      request: { id: summitRequestId, vendorId: "vendor-northline-summit" },
      tokenId: "public-token-estimate-summit",
    });
    await expect(repository.getEstimateRequestByPublicToken({
      tokenHash,
      purpose: "vendor_estimate",
      now: NORTHLINE_AS_OF,
    })).resolves.toMatchObject({
      request: { id: summitRequestId, vendorId: "vendor-northline-summit" },
    });
    await expect(repository.getEstimateRequestByPublicToken({
      tokenHash,
      purpose: "vendor_estimate",
      now: NORTHLINE_AS_OF,
      vendorId: "vendor-northline-cedar",
    })).resolves.toBeNull();
    await expect(repository.getEstimateRequestByPublicToken({
      tokenHash,
      purpose: "vendor_estimate",
      now: "2026-08-31T18:00:00.000Z",
      vendorId: "vendor-northline-summit",
    })).resolves.toBeNull();

    await repository.atomicWrite([{
      sql: "UPDATE ops_public_tokens SET used_at = ? WHERE organization_id = ? AND id = ?",
      params: ["2026-08-25T18:01:00.000Z", NORTHLINE_ORGANIZATION_ID, "public-token-estimate-summit"],
    }]);
    await expect(repository.getEstimateRequestByPublicToken({
      tokenHash,
      purpose: "vendor_estimate",
      now: NORTHLINE_AS_OF,
      vendorId: "vendor-northline-summit",
    })).resolves.toBeNull();
  });

  it("serializes estimate evidence into dedicated tables before any cost rows", () => {
    const fixture = buildNorthlinePresentationFixture();
    const statements = buildOpsSeedStatements(fixture);
    const requestIndex = statements.findIndex((row) => row.sql.includes("ops_work_order_estimate_requests"));
    const proposalIndex = statements.findIndex((row) => row.sql.includes("ops_vendor_estimate_proposals"));
    const costIndex = statements.findIndex((row) => row.sql.includes("ops_cost_lines"));

    expect(requestIndex).toBeGreaterThan(-1);
    expect(proposalIndex).toBeGreaterThan(requestIndex);
    expect(costIndex).toBeGreaterThan(proposalIndex);
    expect(statements.filter((row) => row.sql.includes("ops_vendor_estimate_proposals"))).toHaveLength(fixture.estimateProposals.length);
    expect(statements.filter((row) => row.sql.includes("ops_cost_lines") && row.params.includes(priceCheckWorkOrderId))).toEqual([]);
  });

  it("ships database constraints for estimate selection, proposal context, and expanded outcomes", () => {
    const postgres = readFileSync("drizzle-postgres/0004_work_order_estimates.sql", "utf8");
    const d1 = readFileSync("drizzle/0010_work_order_estimates.sql", "utf8");

    for (const migration of [postgres, d1]) {
      expect(migration).toContain("uidx_ops_estimate_requests_org_work_vendor_active");
      expect(migration).toContain("uidx_ops_estimate_requests_org_work_selected");
      expect(migration).toMatch(/u(?:idx|q)_ops_estimate_proposals_org_request_revision/);
    }
    expect(postgres).toContain("fk_ops_estimate_proposals_request_context");
    expect(d1).toContain("FOREIGN KEY (`organization_id`,`request_id`,`work_order_id`,`vendor_id`)");
    expect(postgres).toContain("'opened'");
    expect(postgres).toContain("'unable_to_reproduce'");
    expect(postgres).toContain("'no_issue_found'");
  });
});
