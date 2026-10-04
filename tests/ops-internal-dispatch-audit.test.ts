import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { Miniflare } from "miniflare";
import { Pool } from "pg";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InternalAssignmentFields } from "@/components/workspace/internal-assignment-fields";
import { InternalDispatchWorkspace } from "@/components/workspace/internal-dispatch-workspace";
import type { OperatorSession } from "@/components/ops/data-contract";
import { POST as holdEndpoint } from "@/app/api/ops/work-orders/[id]/visit-hold/route";
import { POST as dispatchEndpoint } from "@/app/api/ops/work-orders/[id]/internal-dispatch/route";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { createOpsD1Repository } from "@/lib/ops/d1-repository";
import { createOpsPostgresRepository } from "@/lib/ops/postgres-repository";
import { buildShowcaseFixture } from "@/lib/ops/showcase-fixture";
import { seedOpsRepository } from "@/lib/ops/seed";
import { createNotificationEmailTransport, outboxMessageAsRecord, type TransactionalEmail } from "@/lib/ops/email-delivery";
import { insertDispatchRecord } from "@/lib/ops/internal-dispatch";
import { createFollowUp, placeWorkOrderOnVisitHold } from "@/lib/ops/commands";
import { recordApprovalDecision, requestSubjectApproval } from "@/lib/ops/approval-governance";
import { resolveInternalAccountability } from "@/lib/ops/internal-accountability";
import type { OpsRepository } from "@/lib/ops/repository";
import { dispatchActor, dispatchChange, dispatchJob, dispatchManager, dispatchNow, dispatchOrg, dispatchServices, dispatchTech } from "./helpers/internal-dispatch-regression";

const mocks = vi.hoisted(() => ({ repository: vi.fn(), session: vi.fn() }));
vi.mock("@/app/app/_data/operator-loader", () => ({ loadOperatorSession: mocks.session }));
vi.mock("@/lib/server/ops-repository-provider", () => ({ getServerOpsRepository: mocks.repository }));
const postgresUrl = process.env.OPS_DISPATCH_TEST_DATABASE_URL;

for (const adapter of ["fixture", "D1", "PostgreSQL"] as const) describe.skipIf(adapter === "PostgreSQL" && !postgresUrl)(`P1 audit corrections on ${adapter}`, () => {
  let repository: OpsRepository;
  let runtime: Miniflare | undefined;
  let pool: Pool | undefined;
  let databaseName: string | undefined;
  beforeAll(async () => {
    const fixture = buildShowcaseFixture(dispatchNow);
    fixture.outboxMessages = [];
    if (adapter === "fixture") repository = createOpsFixtureRepository(fixture);
    if (adapter === "D1") {
      runtime = new Miniflare({ modules: true, script: "export default {fetch(){return new Response('ok')}}", d1Databases: ["DB"] });
      const db = await runtime.getD1Database("DB");
      for (const file of readdirSync("drizzle").filter(f => /^\d.*\.sql$/.test(f)).sort()) {
        for (const sql of readFileSync(`drizzle/${file}`, "utf8").split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean)) await db.prepare(sql).run();
      }
      repository = createOpsD1Repository(db as unknown as D1Database);
    }
    if (adapter === "PostgreSQL") {
      const parsed = new URL(postgresUrl!);
      if (!["127.0.0.1", "localhost"].includes(parsed.hostname) || !/^\/dispatch_.*test$/.test(parsed.pathname)) throw new Error("Use an isolated localhost dispatch_*test database.");
      const admin = new Pool({ connectionString: postgresUrl });
      databaseName = `dispatch_${crypto.randomUUID().replaceAll("-", "")}_test`;
      try { await admin.query(`CREATE DATABASE ${databaseName}`); } finally { await admin.end(); }
      parsed.pathname = `/${databaseName}`;
      pool = new Pool({ connectionString: parsed.toString() });
      for (const file of readdirSync("drizzle-postgres").filter(f => /^\d.*\.sql$/.test(f)).sort()) {
        for (const sql of readFileSync(`drizzle-postgres/${file}`, "utf8").split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean)) await pool.query(sql);
      }
      repository = createOpsPostgresRepository(pool);
    }
    if (adapter !== "fixture") await seedOpsRepository(repository, fixture);
    mocks.repository.mockImplementation(async () => repository);
    mocks.session.mockResolvedValue({ accessMode: "authenticated", role: "facilities", userId: "user-northline-facilities", membershipId: "membership-northline-facilities", organizationId: dispatchOrg, organizationName: "Fictional demo", displayName: "Jordan Lee", email: "qa@example.test", scopeLabel: "Company", companywide: true, permissions: ["ops:write"] });
  }, 120000);
  afterAll(async () => {
    await runtime?.dispose();
    await pool?.end();
    if (databaseName) {
      const cleanup = new Pool({ connectionString: postgresUrl });
      try { await cleanup.query(`DROP DATABASE ${databaseName}`); } finally { await cleanup.end(); }
    }
  });
  beforeEach(async () => {
    // The worker read is intentionally capped at 100. Isolate each case's outbox
    // so earlier cases cannot hide the new notice beyond that page boundary.
    await repository.atomicWrite([{ sql: "UPDATE ops_outbox_messages SET status = ? WHERE organization_id = ? AND status = ?", params: ["delivered", dispatchOrg, "pending"] }]);
  });

  async function notices(workId: string) {
    return (await repository.listDueOutboxMessages("9999-01-01T00:00:00.000Z", 10000)).filter(m => m.aggregateId === workId && m.topic === "ops.internal_dispatch.notification");
  }
  async function delivery() {
    for (const role of ["internal_technician", "field_manager"] as const) await repository.upsertNotificationRule({ organizationId: dispatchOrg, id: crypto.randomUUID(), eventKey: "internal_dispatch_changed", recipientRole: role, emailEnabled: true, occurredAt: dispatchNow });
    const sent = new Map<string, TransactionalEmail>();
    const transport = createNotificationEmailTransport({ repository, baseUrl: "https://example.test", sink: () => {}, provider: { name: "fake", async send(email) { sent.set(email.idempotencyKey, email); return { messageId: email.idempotencyKey }; } } });
    return { sent, transport };
  }

  it.each(["return", "assign"] as const)("R1 preserves the required follow-up when %s is attempted", async action => {
    const job = await dispatchJob(repository, "person");
    const followUp = await createFollowUp(dispatchServices(repository), {
      organizationId: dispatchOrg, workOrderId: job.id, actor: dispatchActor(),
      accountableParty: "Facilities coordination", nextAction: "Confirm safe access before work continues",
      dueAt: "2026-10-04T14:00:00.000Z", escalationTo: "Facilities leadership",
    });
    const before = await repository.getWorkOrderDetail({ organizationId: dispatchOrg }, job.id);
    const tasks = await repository.listWorkflowTasksForWorkOrder(dispatchOrg, job.id);
    const outbox = await repository.listDueOutboxMessages("9999-01-01T00:00:00.000Z", 10000);
    expect(tasks.find(t => t.sourceFollowUpId === followUp.id)).toMatchObject({ status: "open", requiredForProgress: true });
    await expect(dispatchChange(repository, job.id, action, action === "return" ? dispatchTech[0] : undefined,
      action === "assign" ? { target: "person", membershipId: dispatchTech[1] } : {})).rejects.toMatchObject({ code: "CONFLICT" });
    if (action === "assign") {
      const form = new FormData();
      Object.entries({ action, internalTarget: "person", internalMembershipId: dispatchTech[1], expectedVersion: String((await repository.getWorkOrder(dispatchOrg, job.id))!.version ?? 0),
        expectedAssignmentId: job.initialAssignment!.id, submissionKey: crypto.randomUUID() }).forEach(([k, v]) => form.set(k, v));
      const response = await dispatchEndpoint(new Request(`http://localhost/api/ops/work-orders/${job.id}/internal-dispatch`, { method: "POST", headers: { Origin: "http://localhost" }, body: form }), { params: Promise.resolve({ id: job.id }) });
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ error: expect.stringContaining("follow-up") });
    }
    expect(await repository.getWorkOrderDetail({ organizationId: dispatchOrg }, job.id)).toEqual(before);
    expect(await repository.listWorkflowTasksForWorkOrder(dispatchOrg, job.id)).toEqual(tasks);
    expect(await repository.listDueOutboxMessages("9999-01-01T00:00:00.000Z", 10000)).toEqual(outbox);
  });

  it.each(["person", "pool", "awaiting_allocation"] as const)("R2 resumes the approved internal %s action and its targeted notice", async target => {
    const job = await dispatchJob(repository, target, { actor: dispatchActor(dispatchManager), nteAmountMinor: 625000, categoryKey: "refrigeration" });
    const assignment = (await repository.getActiveAssignment(dispatchOrg, job.id))!;
    const request = (await repository.listApprovalRequestsForSubject(dispatchOrg, "work_order", job.id))[0];
    expect(job.status).toBe("awaiting_approval");
    expect(await notices(job.id)).toHaveLength(0);
    const input = { organizationId: dispatchOrg, approvalRequestId: request.id, decision: "approved" as const,
      deciderMembershipId: "membership-northline-facilities", actor: dispatchActor() };
    await recordApprovalDecision(dispatchServices(repository), input);
    const work = (await repository.getWorkOrder(dispatchOrg, job.id))!;
    const title = target === "person" ? "Begin internal work" : target === "pool" ? "Arrange team pickup" : "Arrange internal work";
    expect(work).toMatchObject({ status: "approved", nextAction: title, dueAt: job.dueAt, internalAccountableId: dispatchManager });
    expect((await repository.listWorkflowTasksForWorkOrder(dispatchOrg, job.id)).filter(t => ["open", "in_progress"].includes(t.status))).toEqual([
      expect.objectContaining({ title, assigneeId: target === "person" ? dispatchTech[0] : dispatchManager, dueAt: job.dueAt }),
    ]);
    expect(await repository.getActiveAssignment(dispatchOrg, job.id)).toEqual(assignment);
    const messages = await notices(job.id);
    expect(messages).toHaveLength(target === "pool" ? 0 : 1);
    if (target !== "pool") {
      expect(JSON.parse(messages[0].payloadJson)).toMatchObject({ assignmentId: assignment.id,
        recipientMembershipIds: [target === "person" ? dispatchTech[0] : dispatchManager], notifyCoordinationTeam: false });
      const { sent, transport } = await delivery();
      await transport.deliver(outboxMessageAsRecord(messages[0]));
      await transport.deliver(outboxMessageAsRecord(messages[0]));
      const recipient = (await repository.getMembership(dispatchOrg, target === "person" ? dispatchTech[0] : dispatchManager))!;
      expect([...sent.values()]).toEqual([expect.objectContaining({ to: (await repository.getUserInOrganization(dispatchOrg, recipient.userId))!.email })]);
    }
    await expect(recordApprovalDecision(dispatchServices(repository), input)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await notices(job.id)).toEqual(messages);
    expect(await repository.listApprovalDecisionsForRequest(dispatchOrg, request.id)).toHaveLength(1);
  });

  it("R1 renders the required follow-up in both queues without offering assignment changes", async () => {
    const job = await dispatchJob(repository, "person");
    await createFollowUp(dispatchServices(repository), { organizationId: dispatchOrg, workOrderId: job.id, actor: dispatchActor(),
      accountableParty: "Facilities coordination", nextAction: "Confirm safe access before work continues", dueAt: "2026-10-04T14:00:00.000Z", escalationTo: "Facilities leadership" });
    const page = await repository.listWorkOrders({ organizationId: dispatchOrg }, { search: job.problem });
    expect(page.items.map(row => row.id)).toEqual([job.id]);
    const manager = await mocks.session() as OperatorSession;
    const technician: OperatorSession = { ...manager, role: "technician", membershipId: dispatchTech[0], displayName: "Maria Santos" };
    for (const session of [manager, technician]) {
      const markup = renderToStaticMarkup(createElement(InternalDispatchWorkspace, { session, page, technician: session === technician, view: session === technician ? "mine" : "all", search: "" }));
      expect(markup).not.toContain(">Return to team<");
      expect(markup).not.toContain(">Reassign<");
      expect(markup).not.toContain(">Ready to work<");
      expect(markup).toContain("Confirm safe access before work continues");
    }
  });

  it.each(["suspended", "scope revoked"] as const)("R3 submits reassignment fields with %s manager access and uses the visible fallback", async revocation => {
    for (const target of ["person", "pool"] as const) {
      const job = await dispatchJob(repository, "person");
      const grants = await repository.listScopeGrantsForMembership(dispatchOrg, dispatchManager);
      const restore = revocation === "suspended"
        ? [{ sql: "UPDATE ops_memberships SET status = ? WHERE organization_id = ? AND id = ?", params: ["active", dispatchOrg, dispatchManager] }]
        : grants.map(g => ({ sql: "UPDATE ops_scope_grants SET permission = ? WHERE organization_id = ? AND id = ?", params: [g.permission, dispatchOrg, g.id] }));
      try {
        await repository.atomicWrite(revocation === "suspended"
          ? [{ sql: "UPDATE ops_memberships SET status = ? WHERE organization_id = ? AND id = ?", params: ["suspended", dispatchOrg, dispatchManager] }]
          : grants.map(g => ({ sql: "UPDATE ops_scope_grants SET permission = ? WHERE organization_id = ? AND id = ?", params: ["ops:read", dispatchOrg, g.id] })));
        const markup = renderToStaticMarkup(createElement(InternalAssignmentFields, { storeId: job.storeId, defaultTarget: target,
          defaultPerson: { id: dispatchTech[1], name: "Devon Brooks" }, defaultManager: { id: dispatchManager, name: "Chris Delgado" } }));
        const form = new FormData();
        // Use the actual rendered named inputs, including any stale hidden manager.
        for (const match of markup.matchAll(/<input\b[^>]*name="([^"]+)"[^>]*value="([^"]*)"[^>]*>/g)) form.set(match[1], match[2]);
        Object.entries({ action: "assign", internalTarget: target, expectedVersion: String(job.version ?? 0),
          expectedAssignmentId: job.initialAssignment!.id, submissionKey: crypto.randomUUID() }).forEach(([k, v]) => form.set(k, v));
        const response = await dispatchEndpoint(new Request(`http://localhost/api/ops/work-orders/${job.id}/internal-dispatch`, { method: "POST", headers: { Origin: "http://localhost" }, body: form }), { params: Promise.resolve({ id: job.id }) });
        expect(response.status).toBe(303);
        expect(form.has("managerId")).toBe(false);
        expect(markup).toContain("Facilities coordination");
        expect((await repository.getWorkOrder(dispatchOrg, job.id))).toMatchObject({ internalAccountableType: "team", internalAccountableId: "facilities-coordination", internalAccountableParty: "Facilities coordination" });
        expect((await repository.getActiveAssignment(dispatchOrg, job.id))).toMatchObject({ internalTarget: target });
        await expect(dispatchChange(repository, job.id, "assign", undefined, { target: "awaiting_allocation", managerId: dispatchManager })).rejects.toMatchObject({ code: "FORBIDDEN" });
      } finally { await repository.atomicWrite(restore); }
    }
  });

  it("R2 rolls back approval, action and notification together and safely retries", async () => {
    const job = await dispatchJob(repository, "person", { actor: dispatchActor(dispatchManager), nteAmountMinor: 625000 });
    const request = (await repository.listApprovalRequestsForSubject(dispatchOrg, "work_order", job.id))[0];
    const input = { organizationId: dispatchOrg, approvalRequestId: request.id, decision: "approved" as const, deciderMembershipId: "membership-northline-facilities", actor: dispatchActor() };
    const before = await repository.getWorkOrderDetail({ organizationId: dispatchOrg }, job.id);
    const tasks = await repository.listWorkflowTasksForWorkOrder(dispatchOrg, job.id);
    const outbox = await repository.listDueOutboxMessages("9999-01-01T00:00:00.000Z", 10000);
    const broken = new Proxy(repository, { get(target, property) {
      if (property === "atomicWrite") return (statements: Parameters<OpsRepository["atomicWrite"]>[0]) => target.atomicWrite([...statements,
        insertDispatchRecord("ops_work_order_assignments", { id: crypto.randomUUID(), organization_id: dispatchOrg, work_order_id: job.id, kind: "internal", internal_target: "person", status: "pending", assigned_at: dispatchNow })]);
      const value = Reflect.get(target, property); return typeof value === "function" ? value.bind(target) : value;
    } });
    await expect(recordApprovalDecision(dispatchServices(broken), input)).rejects.toThrow();
    expect(await repository.getWorkOrderDetail({ organizationId: dispatchOrg }, job.id)).toEqual(before);
    expect(await repository.listWorkflowTasksForWorkOrder(dispatchOrg, job.id)).toEqual(tasks);
    expect(await repository.listApprovalDecisionsForRequest(dispatchOrg, request.id)).toEqual([]);
    expect(await repository.listDueOutboxMessages("9999-01-01T00:00:00.000Z", 10000)).toEqual(outbox);
    await recordApprovalDecision(dispatchServices(repository), input);
    expect((await repository.getWorkOrder(dispatchOrg, job.id))?.nextAction).toBe("Begin internal work");
    expect(await notices(job.id)).toHaveLength(1);
  });

  it("R2 resumes an escalated approval without completing a separate required follow-up", async () => {
    const job = await dispatchJob(repository, "pool", { actor: dispatchActor(dispatchManager), nteAmountMinor: 625000 });
    const first = (await repository.listApprovalRequestsForSubject(dispatchOrg, "work_order", job.id))[0];
    const escalated = await recordApprovalDecision(dispatchServices(repository), { organizationId: dispatchOrg, approvalRequestId: first.id,
      decision: "escalated", deciderMembershipId: "membership-northline-facilities", actor: dispatchActor(), reason: "Independent executive review required" });
    expect((await repository.getWorkOrder(dispatchOrg, job.id))?.status).toBe("awaiting_approval");
    expect(await notices(job.id)).toEqual([]);
    const followUp = await createFollowUp(dispatchServices(repository), { organizationId: dispatchOrg, workOrderId: job.id, actor: dispatchActor(),
      accountableParty: "Facilities coordination", nextAction: "Confirm safe access before work continues", dueAt: "2026-10-04T14:00:00.000Z", escalationTo: "Facilities leadership" });
    const requiredTask = (await repository.listWorkflowTasksForWorkOrder(dispatchOrg, job.id)).find(t => t.sourceFollowUpId === followUp.id)!;
    await recordApprovalDecision(dispatchServices(repository), { organizationId: dispatchOrg, approvalRequestId: escalated.escalatedRequest!.id,
      decision: "approved", deciderMembershipId: "membership-northline-executive", actor: dispatchActor("membership-northline-executive") });
    const tasks = await repository.listWorkflowTasksForWorkOrder(dispatchOrg, job.id);
    expect(tasks.find(t => t.id === requiredTask.id)).toEqual(requiredTask);
    expect(tasks.filter(t => t.status === "open").map(t => t.title)).toContain("Arrange team pickup");
    expect(tasks.some(t => t.status === "open" && t.title === "Issue service authorization")).toBe(false);
    expect((await repository.getWorkOrderDetail({ organizationId: dispatchOrg }, job.id))?.followUps.find(f => f.id === followUp.id)?.status).toBe("open");
    expect(await notices(job.id)).toEqual([]);
  });

  it.each(["technician", "manager"] as const)("R2 falls back to coordination when the %s loses access before approval", async revoked => {
    const job = await dispatchJob(repository, revoked === "technician" ? "person" : "awaiting_allocation", { actor: dispatchActor(dispatchManager), nteAmountMinor: 625000 });
    const request = (await repository.listApprovalRequestsForSubject(dispatchOrg, "work_order", job.id))[0];
    const memberId = revoked === "technician" ? dispatchTech[0] : dispatchManager;
    const grants = await repository.listScopeGrantsForMembership(dispatchOrg, memberId);
    try {
      await repository.atomicWrite(grants.map(g => ({ sql: "UPDATE ops_scope_grants SET permission = ? WHERE organization_id = ? AND id = ?", params: ["ops:read", dispatchOrg, g.id] })));
      await recordApprovalDecision(dispatchServices(repository), { organizationId: dispatchOrg, approvalRequestId: request.id,
        decision: "approved", deciderMembershipId: "membership-northline-facilities", actor: dispatchActor() });
      const work = (await repository.getWorkOrder(dispatchOrg, job.id))!;
      expect(work).toMatchObject({ status: "approved", nextAction: "Arrange internal work", internalAccountableId: revoked === "technician" ? dispatchManager : "facilities-coordination" });
      const active = (await repository.getActiveAssignment(dispatchOrg, job.id))!;
      expect(active.internalTarget).toBe("awaiting_allocation");
      if (revoked === "technician") {
        expect(active).toMatchObject({ supersedesAssignmentId: job.initialAssignment!.id });
        expect(active.internalMembershipId).toBeUndefined();
        expect((await repository.getAssignment(dispatchOrg, job.initialAssignment!.id))?.status).toBe("superseded");
      }
      const messages = await notices(job.id);
      expect(messages).toHaveLength(1);
      expect(JSON.parse(messages[0].payloadJson)).toMatchObject({ assignmentId: active.id,
        recipientMembershipIds: revoked === "technician" ? [dispatchManager] : [], notifyCoordinationTeam: revoked === "manager" });
      const { sent, transport } = await delivery();
      await repository.upsertNotificationRule({ organizationId: dispatchOrg, id: crypto.randomUUID(), eventKey: "internal_dispatch_changed", recipientRole: "facilities_admin", emailEnabled: true, occurredAt: dispatchNow });
      await transport.deliver(outboxMessageAsRecord(messages[0]));
      const expectedIds = revoked === "technician" ? ["user-northline-field-manager"] : ["user-northline-facilities", "user-northline-facilities-approver"];
      const expectedEmails = await Promise.all(expectedIds.map(async id => (await repository.getUserInOrganization(dispatchOrg, id))!.email));
      expect([...sent.values()].map(email => email.to).sort()).toEqual(expectedEmails.sort());
      await dispatchChange(repository, job.id, "assign", undefined, { target: "person", membershipId: dispatchTech[1] });
      expect((await repository.getActiveAssignment(dispatchOrg, job.id))?.internalMembershipId).toBe(dispatchTech[1]);
    } finally { await repository.atomicWrite(grants.map(g => ({ sql: "UPDATE ops_scope_grants SET permission = ? WHERE organization_id = ? AND id = ?", params: [g.permission, dispatchOrg, g.id] }))); }
  });

  it("R2 rejects recipient access lost between precheck and commit without a partial approval", async () => {
    const job = await dispatchJob(repository, "person", { actor: dispatchActor(dispatchManager), nteAmountMinor: 625000 });
    const request = (await repository.listApprovalRequestsForSubject(dispatchOrg, "work_order", job.id))[0];
    const grants = await repository.listScopeGrantsForMembership(dispatchOrg, dispatchTech[0]);
    const before = await repository.getWorkOrderDetail({ organizationId: dispatchOrg }, job.id);
    const tasks = await repository.listWorkflowTasksForWorkOrder(dispatchOrg, job.id);
    const outbox = await repository.listDueOutboxMessages("9999-01-01T00:00:00.000Z", 10000);
    const raced = new Proxy(repository, { get(target, property) {
      if (property === "atomicWrite") return async (statements: Parameters<OpsRepository["atomicWrite"]>[0]) => {
        await target.atomicWrite(grants.map(g => ({ sql: "UPDATE ops_scope_grants SET permission = ? WHERE organization_id = ? AND id = ?", params: ["ops:read", dispatchOrg, g.id] })));
        return target.atomicWrite(statements);
      };
      const value = Reflect.get(target, property); return typeof value === "function" ? value.bind(target) : value;
    } });
    try {
      await expect(recordApprovalDecision(dispatchServices(raced), { organizationId: dispatchOrg, approvalRequestId: request.id,
        decision: "approved", deciderMembershipId: "membership-northline-facilities", actor: dispatchActor() })).rejects.toThrow();
      expect(await repository.getWorkOrderDetail({ organizationId: dispatchOrg }, job.id)).toEqual(before);
      expect(await repository.listWorkflowTasksForWorkOrder(dispatchOrg, job.id)).toEqual(tasks);
      expect(await repository.listApprovalDecisionsForRequest(dispatchOrg, request.id)).toEqual([]);
      expect(await repository.listDueOutboxMessages("9999-01-01T00:00:00.000Z", 10000)).toEqual(outbox);
    } finally { await repository.atomicWrite(grants.map(g => ({ sql: "UPDATE ops_scope_grants SET permission = ? WHERE organization_id = ? AND id = ?", params: [g.permission, dispatchOrg, g.id] }))); }
  });

  it.each(["technician", "manager"] as const)("R2 replaces only the old dispatch task when reapproval loses its %s", async revoked => {
    const job = await dispatchJob(repository, revoked === "technician" ? "person" : "awaiting_allocation");
    const oldTask = (await repository.listWorkflowTasksForWorkOrder(dispatchOrg, job.id)).find(t => t.status === "open")!;
    const request = await requestSubjectApproval(dispatchServices(repository), { organizationId: dispatchOrg, subjectType: "work_order", subjectId: job.id,
      amountMinor: 625000, actor: dispatchActor(dispatchManager), reason: "Revised authorization needs approval" });
    const grants = await repository.listScopeGrantsForMembership(dispatchOrg, revoked === "technician" ? dispatchTech[0] : dispatchManager);
    try {
      await repository.atomicWrite(grants.map(g => ({ sql: "UPDATE ops_scope_grants SET permission = ? WHERE organization_id = ? AND id = ?", params: ["ops:read", dispatchOrg, g.id] })));
      await recordApprovalDecision(dispatchServices(repository), { organizationId: dispatchOrg, approvalRequestId: request.id,
        decision: "approved", deciderMembershipId: "membership-northline-facilities", actor: dispatchActor() });
      const tasks = await repository.listWorkflowTasksForWorkOrder(dispatchOrg, job.id);
      expect(tasks.find(t => t.id === oldTask.id)?.status).toBe("completed");
      expect(tasks.filter(t => t.status === "open")).toEqual([expect.objectContaining({ title: "Arrange internal work", assigneeId: revoked === "technician" ? dispatchManager : "facilities-coordination" })]);
      expect((await repository.getWorkOrder(dispatchOrg, job.id))).toMatchObject({ nextAction: "Arrange internal work", accountableParty: revoked === "technician" ? "Chris Delgado" : "Facilities coordination" });
    } finally { await repository.atomicWrite(grants.map(g => ({ sql: "UPDATE ops_scope_grants SET permission = ? WHERE organization_id = ? AND id = ?", params: [g.permission, dispatchOrg, g.id] }))); }
  });

  it("rejects inspection hold and dispatch endpoints without changing source records", async () => {
    const workId = "showcase-work-walk-101";
    const before = await repository.getWorkOrderDetail({ organizationId: dispatchOrg }, workId);
    const tasks = await repository.listWorkflowTasksForWorkOrder(dispatchOrg, workId);
    const inspection = await repository.inspectionForWork(dispatchOrg, workId);
    const outbox = await repository.listDueOutboxMessages("9999-01-01T00:00:00.000Z", 10000);
    const form = new FormData();
    Object.entries({ operation: "place", posture: "look_and_report", deadlineAt: "2026-10-25T14:00" }).forEach(([k, v]) => form.set(k, v));
    const response = await holdEndpoint(new Request(`http://localhost/api/ops/work-orders/${workId}/visit-hold`, { method: "POST", headers: { Origin: "http://localhost" }, body: form }), { params: Promise.resolve({ id: workId }) });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("inspection record") });
    const assignment = await repository.getActiveAssignment(dispatchOrg, workId);
    const assignForm = new FormData();
    Object.entries({ action: "assign", internalTarget: "pool", expectedVersion: String((await repository.getWorkOrder(dispatchOrg, workId))?.version ?? 0), expectedAssignmentId: assignment!.id, submissionKey: crypto.randomUUID() }).forEach(([k, v]) => assignForm.set(k, v));
    expect((await dispatchEndpoint(new Request(`http://localhost/api/ops/work-orders/${workId}/internal-dispatch`, { method: "POST", headers: { Origin: "http://localhost" }, body: assignForm }), { params: Promise.resolve({ id: workId }) })).status).toBe(409);
    expect(await repository.getWorkOrderDetail({ organizationId: dispatchOrg }, workId)).toEqual(before);
    expect(await repository.listWorkflowTasksForWorkOrder(dispatchOrg, workId)).toEqual(tasks);
    expect(await repository.inspectionForWork(dispatchOrg, workId)).toEqual(inspection);
    expect(await repository.getWorkOrderVisitHold(dispatchOrg, workId)).toBeNull();
    expect(await repository.listDueOutboxMessages("9999-01-01T00:00:00.000Z", 10000)).toEqual(outbox);
    await expect(dispatchJob(repository, "pool", { inspectionScheduleId: inspection!.scheduleId, holdForVisit: { posture: "look_and_report", deadlineAt: "2026-10-25T18:00:00.000Z" } })).rejects.toMatchObject({ code: "CONFLICT" });
    // Corrective repair work keeps ordinary dispatch/hold eligibility.
    const repair = await dispatchJob(repository);
    await repository.atomicWrite([{ sql: "UPDATE ops_inspections SET corrective_work_order_id = ? WHERE organization_id = ? AND id = ?", params: [repair.id, dispatchOrg, inspection!.id] }]);
    expect((await repository.inspectionForWork(dispatchOrg, repair.id))?.correctiveWorkOrderId).toBe(repair.id);
    await dispatchChange(repository, repair.id, "assign", undefined, { target: "person", membershipId: dispatchTech[0] });
    await placeWorkOrderOnVisitHold(dispatchServices(repository), { organizationId: dispatchOrg, workOrderId: repair.id, posture: "look_and_report", deadlineAt: "2026-10-25T18:00:00.000Z", actor: dispatchActor() });
    expect((await repository.getWorkOrderVisitHold(dispatchOrg, repair.id))?.status).toBe("active");
  });

  it("preserves division-only responsibility and delivers only to current writable recipients", async () => {
    const store = (await repository.getStore(dispatchOrg, "store-northline-101"))!;
    expect(store.divisionId).toBeTruthy();
    const grants = (await Promise.all([dispatchManager, ...dispatchTech].map(id => repository.listScopeGrantsForMembership(dispatchOrg, id)))).flat();
    const restore = grants.map(g => ({ sql: "UPDATE ops_scope_grants SET scope_kind = ?, scope_id = ?, permission = ? WHERE organization_id = ? AND id = ?", params: [g.scopeKind, g.scopeId, g.permission, dispatchOrg, g.id] }));
    try {
      await repository.atomicWrite(grants.map(g => ({ sql: "UPDATE ops_scope_grants SET scope_kind = ?, scope_id = ?, permission = ? WHERE organization_id = ? AND id = ?", params: ["division", store.divisionId, "ops:write", dispatchOrg, g.id] })));
      const { sent, transport } = await delivery();
      const job = await dispatchJob(repository, "pool", { priority: "urgent" });
      await dispatchChange(repository, job.id, "claim", dispatchTech[0]);
      expect((await repository.getWorkOrder(dispatchOrg, job.id))?.internalAccountableId).toBe(dispatchManager);
      await dispatchChange(repository, job.id, "return", dispatchTech[0]);
      const returned = (await notices(job.id)).find(m => !JSON.parse(m.payloadJson).initialAssignment)!;
      await transport.deliver(outboxMessageAsRecord(returned));
      expect([...sent.values()]).toEqual([expect.objectContaining({ to: (await repository.getUserInOrganization(dispatchOrg, "user-northline-field-manager"))!.email })]);
      await repository.atomicWrite(grants.filter(g => g.membershipId === dispatchManager).map(g => ({ sql: "UPDATE ops_scope_grants SET permission = ? WHERE organization_id = ? AND id = ?", params: ["ops:read", dispatchOrg, g.id] })));
      const next = (await repository.getWorkOrder(dispatchOrg, job.id))!;
      expect(await resolveInternalAccountability(repository, next)).toMatchObject({ assigneeType: "team", assigneeName: "Facilities coordination" });
      const deniedSent = (await delivery());
      await deniedSent.transport.deliver(outboxMessageAsRecord(returned));
      expect(deniedSent.sent.size).toBe(0);
      await expect(dispatchChange(repository, job.id, "assign", dispatchManager, { target: "person", membershipId: dispatchTech[1] })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await repository.atomicWrite(grants.filter(g => g.membershipId === dispatchManager).map(g => ({ sql: "UPDATE ops_scope_grants SET permission = ? WHERE organization_id = ? AND id = ?", params: ["ops:write", dispatchOrg, g.id] })));
      await dispatchChange(repository, job.id, "assign", dispatchManager, { target: "person", membershipId: dispatchTech[1] });
      expect((await repository.getWorkOrder(dispatchOrg, job.id))?.internalAccountableId).toBe(dispatchManager);
      const active = await repository.getActiveAssignment(dispatchOrg, job.id);
      const reassigned = (await notices(job.id)).find(m => JSON.parse(m.payloadJson).assignmentId === active!.id)!;
      const techDelivery = await delivery();
      await techDelivery.transport.deliver(outboxMessageAsRecord(reassigned));
      const technician = (await repository.getMembership(dispatchOrg, dispatchTech[1]))!;
      const technicianUser = (await repository.getUserInOrganization(dispatchOrg, technician.userId))!;
      expect([...techDelivery.sent.values()]).toEqual([expect.objectContaining({ to: technicianUser.email })]);
      await repository.atomicWrite(grants.filter(g => g.membershipId === dispatchTech[1]).map(g => ({ sql: "UPDATE ops_scope_grants SET scope_id = ? WHERE organization_id = ? AND id = ?", params: ["revoked-division", dispatchOrg, g.id] })));
      await expect(dispatchChange(repository, job.id, "return", dispatchTech[1])).rejects.toMatchObject({ code: "FORBIDDEN" });
      const revoked = await delivery();
      await revoked.transport.deliver(outboxMessageAsRecord(reassigned));
      expect(revoked.sent.size).toBe(0);
      await transport.deliver(outboxMessageAsRecord(returned));
      expect(sent.size).toBe(1); // obsolete return never sends a second owner notice
    } finally { await repository.atomicWrite(restore); }
  });

  it("notifies initial technicians/managers atomically, without pool broadcast or retry duplicates", async () => {
    const { sent, transport } = await delivery();
    const extra = { problem: `Initial notice ${crypto.randomUUID()}`, initialAssignment: { kind: "internal" as const, internalTarget: "person" as const, internalMembershipId: dispatchTech[0] }, idempotency: { key: crypto.randomUUID(), command: "create_work_order", requestHash: "a".repeat(64), expiresAt: "2027-01-01T00:00:00.000Z" } };
    const job = await dispatchJob(repository, "person", extra);
    const retry = await dispatchJob(repository, "person", extra);
    expect(retry.id).toBe(job.id);
    const messages = await notices(job.id);
    expect(messages).toHaveLength(1);
    await transport.deliver(outboxMessageAsRecord(messages[0]));
    await transport.deliver(outboxMessageAsRecord(messages[0]));
    expect(sent.size).toBe(1);
    const manager = await dispatchJob(repository, "awaiting_allocation");
    expect(await notices(manager.id)).toHaveLength(1);
    await transport.deliver(outboxMessageAsRecord((await notices(manager.id))[0]));
    expect(sent.size).toBe(2);
    const legacy = await dispatchJob(repository, "person", { initialAssignment: { kind: "internal", internalMembershipId: dispatchTech[0] } });
    expect(await notices(legacy.id)).toHaveLength(1);
    await transport.deliver(outboxMessageAsRecord((await notices(legacy.id))[0]));
    expect(sent.size).toBe(3);
    const poolJob = await dispatchJob(repository, "pool", { initialAssignment: { kind: "internal", internalTarget: "pool" } });
    expect(await notices(poolJob.id)).toHaveLength(0);
    const pending = await dispatchJob(repository, "person", { nteAmountMinor: 625000, categoryKey: "refrigeration" });
    expect(pending.status).toBe("awaiting_approval");
    expect(await notices(pending.id)).toHaveLength(0);
    const key = crypto.randomUUID();
    const broken = new Proxy(repository, { get(target, property) {
      if (property === "atomicWrite") return (statements: Parameters<OpsRepository["atomicWrite"]>[0]) => target.atomicWrite([...statements, insertDispatchRecord("ops_work_order_assignments", { id: crypto.randomUUID(), organization_id: dispatchOrg, work_order_id: job.id, kind: "internal", internal_target: "person", status: "pending", assigned_at: dispatchNow })]);
      const value = Reflect.get(target, property); return typeof value === "function" ? value.bind(target) : value;
    } });
    const before = await repository.listDueOutboxMessages("9999-01-01T00:00:00.000Z", 10000);
    const rollbackProblem = `Creation rollback ${crypto.randomUUID()}`;
    await expect(dispatchJob(broken, "person", { problem: rollbackProblem, idempotency: { ...extra.idempotency, key } })).rejects.toThrow();
    expect((await repository.listWorkOrders({ organizationId: dispatchOrg }, { search: rollbackProblem })).items).toEqual([]);
    expect(await repository.getIdempotencyKey(dispatchOrg, key)).toBeNull();
    expect(await repository.listDueOutboxMessages("9999-01-01T00:00:00.000Z", 10000)).toEqual(before);
  }, 30000);
});
