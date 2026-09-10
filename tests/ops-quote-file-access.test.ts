import { beforeEach, describe, expect, it, vi } from "vitest";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import { OpsDomainError } from "@/lib/ops/commands";

const mocks = vi.hoisted(() => ({ context: vi.fn(), scope: vi.fn(), bytes: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/ops-request-context", () => ({ getOpsRequestContext: mocks.context, assertStoreInSessionScope: mocks.scope, opsApiError: (error: OpsDomainError) => Response.json({ error: error.message }, { status: error.code === "FORBIDDEN" ? 403 : 404 }) }));
vi.mock("@/components/ops-public/server-file-store", () => ({ readPrivateUpload: mocks.bytes }));
import { GET } from "@/app/api/ops/work-orders/[id]/quotes/[requestId]/[proposalId]/files/[fileId]/route";

describe("quote file permission and exact-version boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const fixture = buildNorthlinePresentationFixture();
    fixture.files.push({ id: "quote-file-test", organizationId: NORTHLINE_ORGANIZATION_ID, storageKey: "private/quote", originalName: "Quote one.pdf", contentType: "application/pdf", byteLength: 10, sha256: "a".repeat(64), status: "available", createdAt: fixture.asOf });
    fixture.entityFiles.push({ id: "quote-file-link", organizationId: NORTHLINE_ORGANIZATION_ID, entityType: "estimate_proposal", entityId: "estimate-proposal-105-summit-r1", fileId: "quote-file-test", purpose: "service_document", visibility: "vendor_shared", createdAt: fixture.asOf });
    mocks.context.mockResolvedValue({ session: { organizationId: NORTHLINE_ORGANIZATION_ID }, repository: createOpsFixtureRepository(fixture) });
    mocks.scope.mockResolvedValue(undefined);
    mocks.bytes.mockResolvedValue(new TextEncoder().encode("%PDF-1.4 test").buffer);
  });
  const params = { id: "wo-northline-105-price-check", requestId: "estimate-request-105-summit", proposalId: "estimate-proposal-105-summit-r1", fileId: "quote-file-test" };
  const get = (overrides = {}) => GET(new Request("https://ops.test/file"), { params: Promise.resolve({ ...params, ...overrides }) });

  it("serves the exact revision privately after work/store authorization", async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-disposition")).toContain("Quote%20one.pdf");
    expect(await response.text()).toContain("%PDF");
    expect(mocks.scope).toHaveBeenCalledWith(expect.anything(), "store-northline-105");
  });
  it("never reads bytes for another proposal, work order, or denied store", async () => {
    expect((await get({ proposalId: "estimate-proposal-105-cedar-r1" })).status).toBe(404);
    expect((await get({ id: "wo-northline-104" })).status).toBe(404);
    mocks.scope.mockRejectedValue(new OpsDomainError("FORBIDDEN", "Outside your stores"));
    expect((await get()).status).toBe(403);
    expect(mocks.bytes).not.toHaveBeenCalled();
  });
});
