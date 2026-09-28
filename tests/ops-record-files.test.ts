import { beforeEach, expect, it, vi } from "vitest";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import type { OperatorSession } from "@/components/ops/data-contract";
import { OpsDomainError } from "@/lib/ops/errors";
const mocks = vi.hoisted(() => ({ context: vi.fn(), bytes: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/ops-request-context", () => ({ getOpsRequestContext: mocks.context, opsApiError: (error: OpsDomainError) => Response.json({ error: error.message }, { status: error.code === "FORBIDDEN" ? 403 : 404 }) }));
vi.mock("@/components/ops-public/server-file-store", () => ({ readPrivateUpload: mocks.bytes }));
import { GET } from "@/app/api/ops/records/[kind]/[id]/files/[fileId]/route";
let session: OperatorSession;
beforeEach(() => {
  vi.clearAllMocks();
  session = { organizationId: NORTHLINE_ORGANIZATION_ID, organizationName: "Example", role: "facilities", userId: "u", displayName: "Manager", email: "manager@example.test", scopeLabel: "Company", accessMode: "preview" };
  const fixture = buildNorthlinePresentationFixture();
  fixture.files.find(file => file.id === "file-109-unmatched-invoice")!.status = "available";
  mocks.context.mockImplementation(async () => ({ session, repository: createOpsFixtureRepository(fixture) }));
  mocks.bytes.mockResolvedValue(new TextEncoder().encode("%PDF invoice proof").buffer);
});
const get = (overrides = {}, suffix = "") => GET(new Request(`https://ops.test/file${suffix}`), { params: Promise.resolve({ kind: "invoice", id: "invoice-northline-109", fileId: "file-109-unmatched-invoice", ...overrides }) });
it("opens invoice evidence inline and allows an explicit download", async () => {
  const response = await get();
  expect(response.status).toBe(200);
  expect(await response.text()).toBe("%PDF invoice proof");
  expect(response.headers.get("content-disposition")).toContain("inline;");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect((await get({}, "?download=1")).headers.get("content-disposition")).toContain("attachment;");
});
it("denies foreign records, unrelated files and scoped access to unmatched invoices before reading bytes", async () => {
  expect((await get({ fileId: "file-104-service-report" })).status).toBe(404);
  expect((await get({ id: "other-invoice" })).status).toBe(404);
  session.storeIds = ["store-northline-109"];
  expect((await get()).status).toBe(404);
  session.storeIds = undefined; session.organizationId = "another-organization";
  expect((await get()).status).toBe(404);
  expect(mocks.bytes).not.toHaveBeenCalled();
});
it("enforces the store boundary for visit evidence", async () => {
  session.storeIds = ["store-northline-109"];
  expect((await get({ kind: "visit", id: "visit-northline-104-2", fileId: "file-104-compressor-before" })).status).toBe(404);
  expect(mocks.bytes).not.toHaveBeenCalled();
});
it("reports missing object bytes without returning a fake document", async () => {
  mocks.bytes.mockResolvedValue(null);
  const response = await get();
  expect(response.status).toBe(404);
  expect(await response.text()).toContain("upload it again");
});
