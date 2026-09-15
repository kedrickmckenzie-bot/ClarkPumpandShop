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
import OwnerBriefPage from "@/app/app/brief/page";
import ActionCenterPage from "@/app/app/action-center/page";
import OccurrencePage from "@/app/app/pm/occurrences/[id]/page";
import PreventiveMaintenancePage from "@/app/app/pm/page";
import InvoiceRecordPage from "@/app/app/invoices/[id]/page";
import { loadInvoiceRecord } from "@/app/app/_data/invoice-record-loader";
import { loadProgramModel, loadPmProgramManagementModel } from "@/app/app/_data/operator-loader";
import { loadPmOccurrenceRecord } from "@/app/app/_data/pm-record-loader";
import { loadPmPlanScheduleSetupModel } from "@/app/app/_data/setup-loader";
import { loadListModel, loadReviewSourcesModel, loadReviewSelection } from "@/app/app/_data/operator-loader";

const boundary = vi.hoisted(() => ({ cookies: new Map<string, string>(), repository: vi.fn(), identity: vi.fn(), snapshot: vi.fn((): import("@/lib/ops/types").OpsFixture => { throw new Error("Setup must not load tenant source records"); }) }));
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
  it("loads invoice queue and exact flag sources without snapshots", async () => {
    const data = fixture(); useFixture(data);
    const { default: InvoiceQueuePage } = await import("@/app/app/invoices/page");
    const { loadInvoiceQueue } = await import("@/app/app/_data/invoice-queue-loader");
    for (const view of ["all", "review", "flags", "exposure"]) expect(await InvoiceQueuePage({ searchParams: Promise.resolve({ view }) })).toBeTruthy();
    expect((await loadInvoiceQueue({ view: "invalid", page: "Infinity" })).view).toBe("all");
    const flag = data.invoiceExceptions[0];
    expect((await loadInvoiceRecord(flag.invoiceId, { section: "flags", flag: flag.id })).result.rows.map(r => r.id)).toEqual([flag.id]);
    const grant = data.scopeGrants.find(g => g.membershipId === "membership-northline-facilities")!;
    grant.scopeKind = "store"; grant.scopeId = "store-northline-104"; useFixture(data);
    expect((await loadInvoiceQueue()).canReceive).toBe(false);
    expect((await loadInvoiceQueue()).canReadAccounting).toBe(false);
    const scoped = await loadInvoiceQueue();
    for (const row of scoped.result.rows) expect((await loadInvoiceRecord(row.invoiceId)).result.invoice).not.toBeNull();
    data.memberships.find(m => m.id === "membership-northline-facilities")!.role = "store_manager"; useFixture(data);
    await expect(loadInvoiceQueue()).rejects.toThrow();
    expect(boundary.snapshot).not.toHaveBeenCalled();
  });

  it("loads every invoice section without snapshots and denies store and role conflicts", async () => {
    const data = fixture(); useFixture(data);
    const id = "invoice-summit-107-pm-2026-q3";
    for (const section of ["items", "matches", "evidence", "flags", "history"]) {
      expect(await InvoiceRecordPage({ params: Promise.resolve({ id }), searchParams: Promise.resolve({ section }) })).toBeTruthy();
    }
    expect((await loadInvoiceRecord(id)).canDecide).toBe(false);
    expect((await loadInvoiceRecord(id, { section: "invalid", page: "Infinity" })).section).toBe("items");
    const membership = data.memberships.find(m => m.id === "membership-northline-facilities")!;
    const grant = data.scopeGrants.find(g => g.membershipId === membership.id)!;
    grant.scopeKind = "store"; grant.scopeId = "store-northline-104"; useFixture(data);
    await expect(loadInvoiceRecord(id)).rejects.toThrow();
    membership.role = "finance_reviewer"; grant.scopeId = "store-northline-107"; useFixture(data);
    expect((await loadInvoiceRecord(id)).canDecide).toBe(false);
    grant.scopeKind = "organization"; grant.scopeId = ORG; useFixture(data);
    expect((await loadInvoiceRecord(id)).canDecide).toBe(true);
    data.invoices.find(i => i.id === id)!.submittedByMembershipId = membership.id; useFixture(data);
    expect((await loadInvoiceRecord(id)).canDecide).toBe(false);
    membership.role = "store_manager"; useFixture(data);
    await expect(loadInvoiceRecord(id)).rejects.toThrow();
    expect(boundary.snapshot).not.toHaveBeenCalled();
  });
  it("keeps PM setup and invoice reviews scoped without snapshots", async () => {
    const data = fixture(); useFixture(data);
    const selected = data.stores.find(row => row.storeNumber === "104")!;
    const model = await loadPmProgramManagementModel({ store: selected.id });
    expect(model.plans.every(row => row.storeHref?.endsWith(selected.id))).toBe(true);
    expect(model.summary.enrolledPlans).toBe(data.pmPlans.filter(row => row.active && row.storeId === selected.id).length);
    expect(new URL(model.enrolledPlansHref!, "https://ops.invalid").searchParams.get("store")).toBe(selected.id);
    const review = data.serviceDiscrepancies.find(row => row.factsJson.includes("pm_billed_vs_observed"))!;
    const facts = JSON.parse(review.factsJson); facts.storeId = selected.id; review.factsJson = JSON.stringify(facts); useFixture(data);
    expect((await loadPmProgramManagementModel({})).reconciliations).toEqual([]);
    const grant = data.scopeGrants.find(row => row.membershipId === "membership-northline-facilities")!;
    grant.scopeKind = "store"; grant.scopeId = selected.id; useFixture(data);
    const denied = await loadPmProgramManagementModel({ store: data.stores.find(row => row.id !== selected.id)!.id });
    expect(denied.plans).toEqual([]); expect(denied.summary.enrolledPlans).toBe(0); expect(denied.reconciliations).toEqual([]);
    expect(boundary.snapshot).not.toHaveBeenCalled();
  });
  it("loads the entire PM page and exact invoice evidence without snapshots, then denies invoice-ineligible roles", async()=>{
    const data=fixture();useFixture(data);
    const review=data.serviceDiscrepancies.find(row=>row.factsJson.includes("pm_billed_vs_observed"))!;
    const management=await loadPmProgramManagementModel({});
    expect(management.summary.evidenceReviews).toBe(1);
    expect(management.reconciliations[0]).toMatchObject({invoiceCount:4,visitCount:2,missingCount:2,amountLabel:"$1,700.00",missingAmountLabel:"$850.00"});
    expect(await PreventiveMaintenancePage({searchParams:Promise.resolve({})})).toBeTruthy();
    const invoices=await loadProgramModel("pm",{pmReview:review.id,reviewSource:"invoices"});
    expect(invoices.table?.rows).toHaveLength(4);
    expect(invoices.page.scopeLabel).toContain("Store 107");
    expect((await loadProgramModel("pm",{pmReview:review.id,reviewSource:"invoices",reviewMissing:"yes"})).table?.rows).toHaveLength(2);
    const grant=data.scopeGrants.find(row=>row.membershipId==="membership-northline-facilities")!;grant.scopeKind="store";grant.scopeId="store-northline-104";useFixture(data);
    expect((await loadProgramModel("pm",{pmReview:review.id,reviewSource:"visits"})).state.kind).toBe("empty");
    data.memberships.find(row=>row.id==="membership-northline-facilities")!.role="store_manager";useFixture(data);
    await expect(loadProgramModel("pm",{pmReview:review.id,reviewSource:"invoices"})).rejects.toThrow();
    expect(boundary.snapshot).not.toHaveBeenCalled();
  });
  it("loads the PM schedule and exact comparison pages without snapshots", async () => {
    const params = { store: "store-northline-104", status: "completed", view: "all" };
    const model = await loadProgramModel("pm", params);
    expect(model.page.scopeLabel).toBe("Store 104 · Ridgeview");
    expect(model.table?.rows.length).toBeGreaterThan(0);
    expect(model.table?.rows.every(row => row.cells.find(cell => cell.key === "store")?.value.startsWith("Store 104"))).toBe(true);
    expect(model.metrics.find(metric => metric.id === "completed")?.selected).toBe(true);
    expect(model.metrics.every(metric => new URL(metric.link.href, "https://ops.invalid").searchParams.get("store") === params.store)).toBe(true);
    const costs = await loadProgramModel("pm", { store: params.store, evidence: "reactive-cost" });
    expect(costs.table?.id).toBe("pm-reactive-evidence");
    expect(costs.page.secondaryAction?.label).toBe("Back to PM schedule");
    expect(await PreventiveMaintenancePage({ searchParams: Promise.resolve({ store: params.store, evidence: "cohort-equipment" }) })).toBeTruthy();
    const coverage = await loadProgramModel("pm", { store: params.store, setup: "targets", setupFilter: "gaps" });
    expect(coverage.table?.id).toBe("pm-setup-evidence");
    expect(coverage.page.scopeLabel).toBe("Store 104 · Ridgeview");
    expect(await PreventiveMaintenancePage({ searchParams: Promise.resolve({ store: params.store, setup: "programs" }) })).toBeTruthy();
    expect(boundary.snapshot).not.toHaveBeenCalled();
  });
  it("loads PM occurrence and plan records without snapshots and retains terminal timing", async () => {
    const data = fixture();
    const occurrence = data.pmOccurrences.find(row => row.workOrderId)!;
    useFixture(data);
    expect(await OccurrencePage({ params: Promise.resolve({ id: occurrence.id }), searchParams: Promise.resolve({ returnTo: "/app/brief/records?kind=pm" }) })).toBeTruthy();
    expect((await loadPmPlanScheduleSetupModel(occurrence.planId)).planId).toBe(occurrence.planId);
    occurrence.status = "cancelled"; occurrence.completedAt = undefined; useFixture(data);
    expect((await loadPmOccurrenceRecord(occurrence.id)).status).toBe("cancelled");
    occurrence.status = "completed"; occurrence.completedAt = new Date(Date.parse(occurrence.windowEndsAt) + 86400000).toISOString(); useFixture(data);
    expect((await loadPmOccurrenceRecord(occurrence.id)).status).toBe("completed_late");
    const grant = data.scopeGrants.find(row => row.membershipId === "membership-northline-facilities")!;
    grant.scopeKind = "store"; grant.scopeId = data.stores.find(row => row.id !== occurrence.storeId)!.id; useFixture(data);
    await expect(loadPmOccurrenceRecord(occurrence.id)).rejects.toThrow();
    await expect(loadPmPlanScheduleSetupModel(occurrence.planId)).rejects.toThrow();
    expect(boundary.snapshot).not.toHaveBeenCalled();
  });
  it("loads the complete review queue, filtered metrics and supporting sources without a snapshot", async()=>{
    const model=await loadListModel("action-center",{q:"104",priority:"urgent"});
    expect(model.table.rows.length).toBeGreaterThan(0);
    expect(model.table.rows.every(row=>row.cells.find(cell=>cell.key==="store")?.value.includes("104"))).toBe(true);
    expect(model.metrics?.find(metric=>metric.id==="attention-urgent")?.value).toBe(model.resultSummary.split(" ")[0]);
    const link=new URL(model.table.rows[0].sourceLink!.href,"https://ops.invalid");
    expect((await loadReviewSourcesModel(Object.fromEntries(link.searchParams)))!.rows.length).toBeGreaterThan(0);
    expect(await ActionCenterPage({searchParams:Promise.resolve({lane:"history"})})).toBeTruthy();
    expect((await loadReviewSelection({q:"no matching record"},[model.table.rows[0].id])).table.rows).toEqual([]);
    const storeQueue=await loadListModel("action-center",{store:"store-northline-104"});
    expect(storeQueue.page.scopeLabel).toBe("Store 104 · Ridgeview");
    expect(storeQueue.search?.preservedParameters).toContainEqual({name:"store",value:"store-northline-104"});
    const lastOnPage=(await loadListModel("action-center",{})).table.rows.at(-1)!;
    const nextIds=new URL(lastOnPage.href,"https://ops.invalid").searchParams.get("reviewAfter")!.split(",");
    expect(nextIds.length).toBe(25);
    const selection=await loadReviewSelection({},nextIds);
    expect(selection.table.rows.some(row=>row.id===nextIds[0])).toBe(true);
    expect(boundary.snapshot).not.toHaveBeenCalled();
  });
  it("renders the actual owner brief with both summaries without requesting a tenant snapshot", async () => {
    expect(await OwnerBriefPage({ searchParams: Promise.resolve({}) })).toBeTruthy();
    expect(boundary.snapshot).not.toHaveBeenCalled();
  });
  it("loads scoped integrity counts without a snapshot for a location-scoped facilities membership", async () => {
    const data = fixture();
    const grant = data.scopeGrants.find(row => row.membershipId === "membership-northline-facilities")!;
    grant.scopeKind = "store"; grant.scopeId = data.stores[0].id;
    useFixture(data);
    expect((await loadOwnerBriefModel())!.sources.stores.totalCount).toBe(1);
    expect((await loadCoverageQualityModel())!.counts.closed_work).toBe(data.workOrders.filter(row => row.storeId === data.stores[0].id && ["resolved", "closed"].includes(row.status)).length);
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
    expect((await loadCoverageQualityModel())!.scopeLabel).toContain("5 stores");
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
    boundary.snapshot.mockReset().mockImplementation(() => { throw new Error("Setup must not load tenant source records"); });
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
