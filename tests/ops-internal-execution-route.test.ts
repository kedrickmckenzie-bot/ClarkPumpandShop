import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import InternalJob from "@/app/app/my-work/[id]/page";
import { createFollowUp } from "@/lib/ops/commands";
import { recordInternalWorkResult, markInternalWorkReady } from "@/lib/ops/internal-execution";
import { POST as resultPost } from "@/app/api/ops/work-orders/[id]/internal-result/route";
import { POST as visitPost } from "@/app/api/ops/internal-visits/route";
import { GET as fileGet } from "@/app/api/ops/work-orders/[id]/files/[fileId]/route";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildShowcaseFixture } from "@/lib/ops/showcase-fixture";
import { dispatchJob, dispatchNow, dispatchOrg, dispatchTech, dispatchManager, dispatchActor, dispatchServices } from "./helpers/internal-dispatch-regression";
import type { OperatorSession } from "@/components/ops/data-contract";
import type { PublicUploadStore } from "@/components/ops-public/server-file-store";

const mocks = vi.hoisted(() => ({ session: vi.fn(), repository: vi.fn(), upload: undefined as PublicUploadStore | undefined, objects: new Map<string, ArrayBuffer>(), puts: 0, fail: false }));
vi.mock("@/app/app/_data/operator-loader", () => ({ loadOperatorSession: mocks.session }));
vi.mock("@/lib/server/ops-repository-provider", () => ({ getServerOpsRepository: mocks.repository }));
vi.mock("@/components/ops-public/server-file-store", async importOriginal => {
  const actual = await importOriginal<typeof import("@/components/ops-public/server-file-store")>();
  return { ...actual, getQuoteUploadStore: () => mocks.upload!, readPrivateUpload: async (key: string) => mocks.objects.get(key) ?? null };
});

describe("P2 authenticated result, visit and file boundaries", () => {
  let r: ReturnType<typeof createOpsFixtureRepository>, session: OperatorSession;
  beforeEach(async () => {
    r = createOpsFixtureRepository(buildShowcaseFixture(dispatchNow));
    session = { accessMode: "authenticated", role: "technician", userId: "user-northline-tech-1", membershipId: dispatchTech[0], organizationId: dispatchOrg, organizationName: "Fictional QA", displayName: "Maria Santos", email: "qa@example.test", companywide: true, scopeLabel: "Test scope", permissions: ["ops:write"] };
    mocks.session.mockImplementation(async () => session); mocks.repository.mockResolvedValue(r);
    mocks.objects.clear(); mocks.puts = 0; mocks.fail = false;
    const { createPublicUploadStore } = await import("@/components/ops-public/server-file-store");
    mocks.upload = createPublicUploadStore({ environment: { OPS_OBJECT_STORAGE_PROVIDER: "r2" }, r2Bucket: { async put(key, value) { if (mocks.fail) throw new Error("Injected private storage outage"); mocks.puts++; mocks.objects.set(key, value); } } });
  });
  function request(path: string, form: FormData, origin = "http://localhost") { return new Request(`http://localhost${path}`, { method: "POST", headers: { Origin: origin }, body: form }); }
  async function resultForm(id: string, values: Record<string, string> = {}) {
    const form = new FormData();
    const work = (await r.getWorkOrder(dispatchOrg, id))!, assignment = (await r.getActiveAssignment(dispatchOrg, id))!;
    Object.entries({ action: "result", expectedVersion: String(work.version ?? 0), expectedAssignmentId: assignment.id, submissionKey: crypto.randomUUID(), outcome: "completed", notes: "Latch adjusted", ...values }).forEach(([name, value]) => form.set(name, value));
    return form;
  }
  async function save(id: string, form: FormData, origin?: string) { return resultPost(request(`/api/ops/work-orders/${id}/internal-result`, form, origin), { params: Promise.resolve({ id }) }); }

  it("keeps the safety action visible and completion unavailable in the focused job through parts readiness", async () => {
    const job = await dispatchJob(r, "person");
    const safety = await createFollowUp(dispatchServices(r), { organizationId: dispatchOrg, workOrderId: job.id, actor: dispatchActor(),
      accountableParty: "Facilities coordination", nextAction: "Confirm safe access before work continues", dueAt: "2026-10-04T17:00:00.000Z", escalationTo: "Facilities leadership" });
    await recordInternalWorkResult(dispatchServices(r), { organizationId: dispatchOrg, workOrderId: job.id, actor: dispatchActor(dispatchTech[0]),
      expectedVersion: (await r.getWorkOrder(dispatchOrg, job.id))!.version!, expectedAssignmentId: (await r.getActiveAssignment(dispatchOrg, job.id))!.id,
      key: crypto.randomUUID(), outcome: "parts_required", blocker: "parts", notes: "Replacement latch needed" });
    const checkScreen = async (assigned = true) => {
      const html = renderToStaticMarkup(await InternalJob({ params: Promise.resolve({ id: job.id }) }));
      expect(html).toContain(safety.nextAction);
      expect(html).not.toContain('>Save result<');
      if (assigned) expect(html).toContain('>Flag a problem<');
      else expect(html).toContain("Any technician can take it");
    };
    await checkScreen();
    await markInternalWorkReady(dispatchServices(r), { organizationId: dispatchOrg, workOrderId: job.id, actor: dispatchActor(dispatchManager),
      expectedVersion: (await r.getWorkOrder(dispatchOrg, job.id))!.version!, expectedAssignmentId: (await r.getActiveAssignment(dispatchOrg, job.id))!.id,
      key: crypto.randomUUID(), notes: "Replacement arrived; safe access still needs checking" });
    await checkScreen(false);
  });

  it("rejects a forged completed result for look-and-report work through the actual endpoint", async () => {
    const job = await dispatchJob(r, "person", { holdForVisit: { posture: "look_and_report", deadlineAt: "2026-10-20T18:00:00.000Z" } });
    const before = await r.getWorkOrderDetail({ organizationId: dispatchOrg }, job.id), hold = await r.getWorkOrderVisitHold(dispatchOrg, job.id);
    const response = await save(job.id, await resultForm(job.id));
    expect(response.status).toBe(422);
    expect(await response.text()).toContain("Look-and-report");
    expect(await r.getWorkOrderDetail({ organizationId: dispatchOrg }, job.id)).toEqual(before);
    expect(await r.getWorkOrderVisitHold(dispatchOrg, job.id)).toEqual(hold);
    expect(await r.listWorkResults(dispatchOrg, job.id)).toHaveLength(0);
  });

  it("stores a file once, replays the receipt, opens exact private bytes and rejects changed intent", async () => {
    const job = await dispatchJob(r, "person"), form = await resultForm(job.id);
    form.append("attachments", new File(["synthetic P2 evidence"], "result.txt", { type: "text/plain" }));
    expect((await save(job.id, form)).status).toBe(303);
    expect((await save(job.id, form)).status).toBe(303);
    expect(mocks.puts).toBe(1); expect(await r.listWorkResults(dispatchOrg, job.id)).toHaveLength(1);
    const files = await r.listFilesForEntity(dispatchOrg, "work_order", job.id); expect(files).toHaveLength(1);
    const params = { params: Promise.resolve({ id: job.id, fileId: files[0].id }) };
    const opened = await fileGet(new Request(`http://localhost/api/ops/work-orders/${job.id}/files/${files[0].id}`), params);
    expect(opened.status).toBe(200); expect(await opened.text()).toBe("synthetic P2 evidence"); expect(opened.headers.get("cache-control")).toBe("private, no-store");
    form.set("attachments", new File(["changed P2 evidence"], "result.txt", { type: "text/plain" }));
    expect((await save(job.id, form)).status).toBe(409); expect(mocks.puts).toBe(1);
    session = { ...session, storeIds: ["store-northline-102"], companywide: false };
    expect((await fileGet(new Request("http://localhost/file"), params)).status).toBe(403);
  });

  it("leaves the job untouched after an upload failure and permits a safe retry", async () => {
    const job = await dispatchJob(r, "person"), form = await resultForm(job.id);
    form.append("attachments", new File(["repair evidence"], "result.txt", { type: "text/plain" }));
    mocks.fail = true; expect((await save(job.id, form)).status).toBe(422);
    expect(await r.listWorkResults(dispatchOrg, job.id)).toHaveLength(0); expect((await r.getWorkOrder(dispatchOrg, job.id))?.version).toBe(0);
    mocks.fail = false; expect((await save(job.id, form)).status).toBe(303); expect(await r.listFilesForEntity(dispatchOrg, "work_order", job.id)).toHaveLength(1);
    const other = await dispatchJob(r, "person"); mocks.upload = { async store() { throw new Error("Object storage not configured"); } };
    expect((await save(other.id, await resultForm(other.id))).status).toBe(303);
  });

  it("rejects cross-role, cross-store, read-only, revoked and substituted identities", async () => {
    const job = await dispatchJob(r, "person"), form = await resultForm(job.id);
    expect((await save(job.id, form, "https://elsewhere.example")).status).toBe(403);
    expect((await save(job.id, await resultForm(job.id, { performerName: "Devon Price" }))).status).toBe(403);
    expect((await save(job.id, await resultForm(job.id, { action: "ready" }))).status).toBe(403);
    session = { ...session, permissions: ["ops:read"] }; expect((await save(job.id, form)).status).toBe(403);
    session = { ...session, permissions: ["ops:write"], storeIds: [] }; expect((await save(job.id, form)).status).toBe(403);
    session = { ...session, storeIds: undefined, role: "finance" }; expect((await save(job.id, form)).status).toBe(403);
    session = { ...session, role: "technician" };
    await r.atomicWrite([{ sql: "UPDATE ops_memberships SET status = ? WHERE organization_id = ? AND id = ?", params: ["suspended", dispatchOrg, dispatchTech[0]] }]);
    expect((await save(job.id, form)).status).toBe(403); expect(await r.listWorkResults(dispatchOrg, job.id)).toHaveLength(0);
  });

  it("checks out through the actual endpoint and rejects a stale job version without partial results", async () => {
    const job = await dispatchJob(r, "person"), checkin = await resultForm(job.id, { action: "check_in", workOrderId: job.id, storeId: job.storeId });
    const started = await visitPost(request("/api/ops/internal-visits", checkin)); expect(started.status).toBe(303);
    const visitId = started.headers.get("location")!.split("/").at(-1)!;
    const form = new FormData(); Object.entries({ action: "check_out", visitId, submissionKey: crypto.randomUUID(), [`${job.id}:expectedVersion`]: "0", [`${job.id}:expectedAssignmentId`]: (await r.getActiveAssignment(dispatchOrg, job.id))!.id, [`${job.id}:outcome`]: "completed" }).forEach(([name, value]) => form.set(name, value));
    expect((await visitPost(request("/api/ops/internal-visits", form))).status).toBe(409);
    expect((await r.getVisit(dispatchOrg, visitId))?.status).toBe("active"); expect(await r.listWorkResults(dispatchOrg, job.id)).toHaveLength(0);
    form.set(`${job.id}:expectedVersion`, String((await r.getWorkOrder(dispatchOrg, job.id))!.version));
    expect((await visitPost(request("/api/ops/internal-visits", form))).status).toBe(303);
    expect((await visitPost(request("/api/ops/internal-visits", form))).status).toBe(303); expect(await r.listWorkResults(dispatchOrg, job.id)).toHaveLength(1);
  });

  it("keeps vendor choice manager-only, stale-safe and retryable before separate issuance",async()=>{
    const job=await dispatchJob(r,"person");
    expect((await save(job.id,await resultForm(job.id,{action:"problem",outcome:"quote_required",blocker:"vendor",notes:"Specialist needed"}))).status).toBe(303);
    const form=await resultForm(job.id,{action:"vendor",vendorId:"vendor-northline-summit"});
    expect((await save(job.id,form)).status).toBe(403);
    session={...session,role:"regional",persona:"field_manager",membershipId:dispatchManager,userId:"user-northline-field-manager",displayName:"Chris Delgado"};
    form.set("expectedVersion","0");expect((await save(job.id,form)).status).toBe(409);
    form.set("expectedVersion",String((await r.getWorkOrder(dispatchOrg,job.id))!.version));
    const chosen=await save(job.id,form);expect(chosen.status).toBe(303);expect(chosen.headers.get("location")).toContain("path=direct#issue-work");
    expect((await save(job.id,form)).status).toBe(303);expect((await r.getActiveAssignment(dispatchOrg,job.id))?.kind).toBe("outside_vendor");
    expect(await r.listIssuancesForWorkOrder(dispatchOrg,job.id)).toHaveLength(0);
    session={...session,permissions:["ops:read"]};expect((await save(job.id,form)).status).toBe(403);
  });
});
