import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildNorthlinePresentationFixture, NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { isFictionalPreview, trustsSitesIdentity } from "@/lib/server/operator-access";
import { resolveAuthenticatedOperatorSession } from "@/lib/server/operator-membership";
import { loadOperatorSession, loadNotificationSettingsModel, loadImportWorkspaceAccess, loadDashboardModel, loadOwnerBriefModel, loadBriefRecordsModel, loadCoverageQualityModel } from "@/app/app/_data/operator-loader";
import { assertStoreInSessionScope, getOpsRequestContext } from "@/lib/server/ops-request-context";
import { POST as createWork } from "@/app/api/ops/work-orders/route";
import { POST as previewRole } from "@/app/api/ops/preview-role/route";
import { POST as previewEdition } from "@/app/api/ops/preview-edition/route";
import { POST as chooseCompany } from "@/app/api/ops/organization/route";
import { GET as exportTrends } from "@/app/api/ops/trends/export/route";
import { tenantFixture } from "@/lib/ops/tenant-fixture";

const boundary = vi.hoisted(() => ({ cookies: new Map<string, string>(), repository: vi.fn(), identity: vi.fn(), snapshot: vi.fn(() => { throw new Error("Setup must not load tenant source records"); }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => boundary.cookies.has(name) ? { value: boundary.cookies.get(name) } : undefined }) }));
vi.mock("@/app/chatgpt-auth", () => ({ getChatGPTUser: () => boundary.identity() }));
vi.mock("@/lib/server/ops-repository-provider", () => ({ getServerOpsRepository: () => boundary.repository(), getServerOpsFixtureSnapshot: () => boundary.snapshot(), getServerOpsReportingAsOf: () => "2026-08-25T16:00:00.000Z" }));

const USER = "sites:identity-a";
const ORG = NORTHLINE_ORGANIZATION_ID;
function fixture() {
  const data = buildNorthlinePresentationFixture();
  data.users.find(row => row.id === "user-northline-facilities")!.id = USER;
  data.memberships.find(row => row.id === "membership-northline-facilities")!.userId = USER;
  return data;
}
function useFixture(data = fixture()) {
  const repository = createOpsFixtureRepository(data);
  boundary.repository.mockReturnValue(repository);
  return repository;
}

describe("production identity and organization selection", () => {
  it("does not load the companywide integrity companion for a location-scoped facilities membership", async () => {
    const data = fixture();
    const grant = data.scopeGrants.find(row => row.membershipId === "membership-northline-facilities")!;
    grant.scopeKind = "store"; grant.scopeId = data.stores[0].id;
    useFixture(data);
    expect((await loadOwnerBriefModel())!.sources.stores.totalCount).toBe(1);
    expect(await loadCoverageQualityModel()).toBeNull();
    expect(boundary.snapshot).not.toHaveBeenCalled();
  });
  it("keeps the regional brief and its source pages inside the membership scope without a snapshot", async () => {
    const data = buildNorthlinePresentationFixture();
    data.users.find(row => row.id === "user-northline-regional-1")!.id = USER;
    data.memberships.find(row => row.id === "membership-northline-regional-1")!.userId = USER;
    useFixture(data);
    const brief = await loadOwnerBriefModel();
    expect(brief!.sources.stores.totalCount).toBe(5);
    expect(brief!.sources.stores.items.every(row => data.stores.some(store => store.id === row.id && store.regionId === "region-northline-north"))).toBe(true);
    const otherStore = data.stores.find(row => row.regionId !== "region-northline-north")!;
    const records = await loadBriefRecordsModel({ kind: "recorded_cost", store: otherStore.id });
    expect(records.table.rows).toEqual([]);
    expect(await loadCoverageQualityModel()).toBeNull();
    expect(boundary.snapshot).not.toHaveBeenCalled();
  });
  it("loads the actual manager home without requesting a tenant snapshot", async () => {
    const model = await loadDashboardModel();
    expect(model.metrics.find(row => row.id === "open-exceptions")?.value).toBe("61");
    expect(model.spotlight?.facts.find(row => row.label === "Approved replacement")?.value).toBe("$32,800.00");
    expect(boundary.snapshot).not.toHaveBeenCalled();
  });
  it("loads access-only setup pages without loading tenant source records", async () => {
    expect(await loadImportWorkspaceAccess()).toMatchObject({ organizationName: "Clark Pump and Shop" });
    expect(await loadNotificationSettingsModel()).toMatchObject({ organizationName: "Clark Pump and Shop", rules: expect.any(Array) });
    expect(boundary.snapshot).not.toHaveBeenCalled();
  });
  beforeEach(() => {
    vi.stubEnv("OPS_ACCESS_MODE", "authenticated");
    vi.stubEnv("OPS_IDENTITY_PROVIDER", "sites");
    vi.stubEnv("OPS_ORGANIZATION_ID", ORG);
    vi.stubEnv("OPS_RUNTIME", "");
    vi.stubEnv("RENDER", "");
    boundary.cookies.clear();
    boundary.identity.mockResolvedValue({ userId: "identity-a", email: "untrusted-display@example.test", displayName: "Untrusted display" });
    useFixture();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("defaults deployed runtimes to membership access and never trusts Sites claims on Render", () => {
    expect(isFictionalPreview({ NODE_ENV: "production" })).toBe(false);
    expect(isFictionalPreview({ NODE_ENV: "production", OPS_ACCESS_MODE: "preview" })).toBe(true);
    expect(isFictionalPreview({ NODE_ENV: "development", DATABASE_URL: "postgres://configured" })).toBe(false);
    expect(isFictionalPreview({ NODE_ENV: "development", OPS_ACCESS_MODE: "unknown" })).toBe(false);
    expect(trustsSitesIdentity({ OPS_IDENTITY_PROVIDER: "sites", OPS_RUNTIME: "render" })).toBe(false);
  });

  it("ignores role and edition cookies and uses the exact user's active membership", async () => {
    boundary.cookies.set("ops-preview-role", "executive"); boundary.cookies.set("ops-preview-edition", "accountability");
    const session = await loadOperatorSession();
    expect(session).toMatchObject({ accessMode: "authenticated", userId: USER, role: "facilities", demoEdition: "complete", displayName: "Jordan Lee", membershipId: "membership-northline-facilities" });
    const context = await getOpsRequestContext(["facilities"]);
    expect(context.actor).toMatchObject({ actorId: session.membershipId, actorName: "Jordan Lee", organizationId: ORG });
  });

  it("rejects missing identity on reads, mutations and exports", async () => {
    boundary.identity.mockResolvedValue(null);
    await expect(loadOperatorSession()).rejects.toMatchObject({ reason: "sign_in" });
    expect((await createWork(new Request("https://operations.test/api/ops/work-orders", { method: "POST", body: new FormData() }))).status).toBe(401);
    expect((await exportTrends(new Request("https://operations.test/api/ops/trends/export"))).status).toBe(401);
  });

  it("does not link identities by email or fall back to a demo user", async () => {
    boundary.identity.mockResolvedValue({ userId: "another-subject", email: "jordan.lee@clark-demo.example" });
    await expect(loadOperatorSession()).rejects.toMatchObject({ reason: "membership" });
    vi.stubEnv("OPS_RUNTIME", "render");
    await expect(loadOperatorSession()).rejects.toMatchObject({ reason: "configuration" });
  });

  it.each(["suspended_user", "suspended_membership", "removed_scope", "ambiguous_membership"])("fails closed for %s", async kind => {
    const data = fixture();
    const member = data.memberships.find(row => row.userId === USER)!;
    if (kind === "suspended_user") data.users.find(row => row.id === USER)!.status = "suspended";
    if (kind === "suspended_membership") member.status = "suspended";
    if (kind === "removed_scope") data.scopeGrants = data.scopeGrants.filter(row => row.membershipId !== member.id);
    if (kind === "ambiguous_membership") data.memberships.push({ ...member, id: "second-active-membership", role: "executive" });
    useFixture(data);
    await expect(loadOperatorSession()).rejects.toMatchObject({ reason: "membership" });
  });

  it("isolates a second company and its one-store membership", async () => {
    const data = fixture();
    data.organizations.push({ ...data.organizations[0], id: "org-b", name: "Company B", slug: "company-b" });
    data.stores.push({ ...data.stores[0], id: "store-b", organizationId: "org-b", regionId: undefined, divisionId: undefined });
    data.memberships.push({ ...data.memberships[0], id: "membership-b", organizationId: "org-b", userId: USER, role: "store_manager" });
    data.scopeGrants.push({ ...data.scopeGrants[0], id: "grant-b", organizationId: "org-b", membershipId: "membership-b", scopeKind: "store", scopeId: "store-b" });
    const repository = useFixture(data);
    boundary.cookies.set("ops-organization", "org-b");
    const session = await loadOperatorSession();
    expect(session).toMatchObject({ organizationId: "org-b", role: "store_manager", storeIds: ["store-b"] });
    await expect(assertStoreInSessionScope(session, "store-northline-101")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await repository.searchStores(session, "", { limit: 25 })).items.map(row => row.id)).toEqual(["store-b"]);
    expect(tenantFixture(data, "org-b").workOrders).toEqual([]);
    expect(tenantFixture(data, "org-b").users.map(row => row.id)).toEqual([USER]);
    boundary.cookies.set("ops-organization", "ungranted-company");
    await expect(loadOperatorSession()).rejects.toMatchObject({ reason: "membership" });
  });

  it("resolves division grants and denies a foreign division without broadening scope", async () => {
    const data = fixture(); const grant = data.scopeGrants.find(row => row.membershipId === "membership-northline-facilities")!;
    grant.scopeKind = "division"; grant.scopeId = data.divisions[0].id;
    expect((await resolveAuthenticatedOperatorSession(useFixture(data), { userId: USER, organizationId: ORG })).storeIds).toHaveLength(15);
    grant.scopeId = "foreign-division";
    await expect(resolveAuthenticatedOperatorSession(useFixture(data), { userId: USER, organizationId: ORG })).rejects.toMatchObject({ reason: "membership" });
  });

  it("rejects preview mutations and unauthorized company changes", async () => {
    const request = () => new Request("https://operations.test/api/ops/preview-role", { method: "POST", body: new FormData() });
    expect((await previewRole(request())).status).toBe(403);
    expect((await previewEdition(request())).status).toBe(403);
    const body = new FormData(); body.set("organizationId", "foreign-company");
    const response = await chooseCompany(new Request("https://operations.test/api/ops/organization", { method: "POST", body }));
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("location")).toBe("/access?reason=membership");
    expect((await chooseCompany(new Request("https://operations.test/api/ops/organization", { method: "POST", headers: { origin: "https://foreign.test" }, body }))).status).toBe(403);
  });

  it("blocks cross-site writes and keeps read-only accounts read-only", async () => {
    const body = new FormData(); body.set("storeId", "store-northline-101"); body.set("problem", "Unauthorized change");
    const request = (headers = {}) => new Request("https://operations.test/api/ops/work-orders", { method: "POST", headers, body });
    expect((await createWork(request({ origin: "https://foreign.test" }))).status).toBe(403);
    expect((await createWork(request({ "sec-fetch-site": "cross-site" }))).status).toBe(403);
    const data = fixture();
    data.scopeGrants.find(row => row.membershipId === "membership-northline-facilities")!.permission = "ops:read";
    const repository = useFixture(data); const before = repository.snapshot().workOrders.length;
    expect((await loadOperatorSession()).effectiveCapabilities).toEqual([]);
    expect((await createWork(request())).status).toBe(403);
    expect(repository.snapshot().workOrders).toHaveLength(before);
  });

  it("does not combine company read access with a narrower write grant", async () => {
    const data = fixture(); const grant = data.scopeGrants.find(row => row.membershipId === "membership-northline-facilities")!;
    grant.permission = "ops:read";
    data.scopeGrants.push({ ...grant, id: "narrow-write", permission: "ops:write", scopeKind: "store", scopeId: "store-northline-104" });
    useFixture(data);
    expect((await loadOperatorSession()).effectiveCapabilities).toEqual([]);
    await expect(getOpsRequestContext(["facilities"], undefined, new Request("https://operations.test/api/ops/work-orders", { method: "POST" }))).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("denies company setup from a store-only grant and rejects explicitly empty scopes", async () => {
    const data = fixture(); const grant = data.scopeGrants.find(row => row.membershipId === "membership-northline-facilities")!;
    grant.scopeKind = "store"; grant.scopeId = "store-northline-104"; useFixture(data);
    const session = await loadOperatorSession();
    await expect(getOpsRequestContext(["facilities"], undefined, new Request("https://operations.test/api/ops/stores", { method: "POST" }), true)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(assertStoreInSessionScope(session, "store-northline-101")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(assertStoreInSessionScope({ ...session, storeIds: [] }, "store-northline-104")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
