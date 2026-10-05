import {
  assignWorkOrder,
  createWorkOrder,
  reviewServiceRequest,
  placeWorkOrderOnVisitHold,
  updateWorkOrderControl,
  type OpsCommandServices,
} from "./commands";
import {
  changeInternalDispatch,
  dispatchAccessAssertion,
  dispatchIdentity,
  internalManagerRoles,
} from "./internal-dispatch";
import { resultAudit } from "./internal-execution";
import { OpsDomainError } from "./errors";
import type { ActorContext, WorkOrder } from "./types";
import type { OpsRepository, OpsStatement } from "./repository";

export interface ReviewRouteInput {
  organizationId: string;
  actor: ActorContext;
  id: string;
  kind: "request" | "work";
  expectedVersion: number;
  decision: "internal" | "outside_vendor" | "next_visit" | "not_needed";
  priority: WorkOrder["priority"];
  technicianNotes?: string;
  estimatedMinutes?: number;
  confirmationDelay?: WorkOrder["confirmationDelay"];
  vendorId?: string;
  reason?: string;
  holdDeadlineAt?: string;
  key: string;
}
/** Review routes through the existing commands; preparation and the route commit together. */
export async function routeReviewItem(
  svc: OpsCommandServices,
  input: ReviewRouteInput,
) {
  const r = svc.repository,
    org = input.organizationId,
    now = svc.clock?.now() ?? new Date().toISOString();
  const source =
    input.kind === "request"
      ? await r.getRequest(org, input.id)
      : await r.getWorkOrder(org, input.id);
  if (!source) throw new OpsDomainError("NOT_FOUND", "Review item not found.");
  if (
    input.actor.organizationId !== org ||
    input.actor.actorType !== "user" ||
    !input.actor.actorId
  )
    throw new OpsDomainError("FORBIDDEN", "Sign in to review work.");
  await dispatchIdentity(
    r,
    org,
    input.actor.actorId,
    source.storeId,
    internalManagerRoles,
  );
  if (
    !Number.isSafeInteger(input.expectedVersion) ||
    (source.version ?? 0) !== input.expectedVersion
  )
    throw new OpsDomainError(
      "CONFLICT",
      "This item changed. Refresh before routing it.",
    );
  if (
    !["internal", "outside_vendor", "next_visit", "not_needed"].includes(
      input.decision,
    ) ||
    !["routine", "planned", "urgent", "emergency"].includes(input.priority)
  )
    throw new OpsDomainError("VALIDATION", "Choose a decision and urgency.");
  if (
    (input.technicianNotes?.length ?? 0) > 3000 ||
    (input.reason?.length ?? 0) > 1000
  )
    throw new OpsDomainError(
      "VALIDATION",
      "Keep notes under 3,000 characters and the reason under 1,000.",
    );
  if (
    input.estimatedMinutes !== undefined &&
    (!Number.isSafeInteger(input.estimatedMinutes) ||
      input.estimatedMinutes < 1 ||
      input.estimatedMinutes > 1440)
  )
    throw new OpsDomainError(
      "VALIDATION",
      "Enter an estimate from 1 to 1,440 minutes, or leave it unknown.",
    );
  if (
    input.confirmationDelay &&
    !["next_morning", "four_hours"].includes(input.confirmationDelay)
  )
    throw new OpsDomainError("VALIDATION", "Choose a confirmation time.");
  const ids = svc.ids ?? {
    next: (prefix: string) => `${prefix}-${crypto.randomUUID()}`,
  };
  const access = dispatchAccessAssertion(
    org,
    input.actor.actorId,
    source.storeId,
    internalManagerRoles,
    now,
  );
  if (input.kind === "request") {
    const report = await r.getRequest(org, input.id);
    if (
      !report ||
      report.convertedWorkOrderId ||
      report.linkedWorkOrderId ||
      report.status === "closed"
    )
      throw new OpsDomainError(
        "CONFLICT",
        "Open the existing job to continue this report.",
      );
    if (input.decision === "not_needed") {
      if (!input.reason?.trim())
        throw new OpsDomainError(
          "VALIDATION",
          "Explain why work is not needed.",
        );
      const repository = new Proxy(r, {
        get(target, key) {
          if (key === "getRequest")
            return (organizationId: string, id: string) =>
              organizationId === org && id === report.id
                ? Promise.resolve(report)
                : target.getRequest(organizationId, id);
          if (key === "atomicWrite")
            return (statements: readonly OpsStatement[]) =>
              target.atomicWrite([access, ...statements]);
          const value = Reflect.get(target, key);
          return typeof value === "function" ? value.bind(target) : value;
        },
      }) as OpsRepository;
      if (!["submitted", "under_review"].includes(report.status))
        throw new OpsDomainError(
          "CONFLICT",
          "Open the report to review its current state.",
        );
      await reviewServiceRequest(
        { ...svc, repository },
        {
          organizationId: org,
          requestId: report.id,
          expectedStatus: report.status as "submitted" | "under_review",
          decision: "close",
          note: input.reason,
          actor: input.actor,
        },
      );
      return {
        id: report.id,
        href: "/app/action-center",
        message: "Saved · Report closed as not needed",
      };
    }
    const result = await createWorkOrder(svc, {
      organizationId: org,
      storeId: report.storeId,
      requestId: report.id,
      expectedRequestVersion: input.expectedVersion,
      problem: report.problem,
      priority: input.priority,
      technicianNotes: input.technicianNotes,
      estimatedMinutes: input.estimatedMinutes,
      confirmationDelay: input.confirmationDelay,
      accountableParty: "Facilities coordinator",
      nextAction:
        input.decision === "outside_vendor"
          ? "Issue service authorization"
          : "Assign a technician",
      escalationTo: "Facilities manager",
      actor: input.actor,
      initialAssignment:
        input.decision === "outside_vendor"
          ? { kind: "outside_vendor", vendorId: input.vendorId }
          : { kind: "internal", internalTarget: "pool" },
      holdForVisit:
        input.decision === "next_visit"
          ? {
              posture: "complete_using_professional_judgment",
              deadlineAt: input.holdDeadlineAt ?? "",
            }
          : undefined,
    });
    return {
      id: result.id,
      href:
        input.decision !== "internal"
          ? `/app/work-orders/${encodeURIComponent(result.id)}?view=service`
          : `/app/dispatch?view=plan`,
      message: "Saved · Work routed",
    };
  }
  const work = source as WorkOrder;
  if (input.decision === "not_needed")
    input = {
      ...input,
      technicianNotes: work.technicianNotes,
      estimatedMinutes: work.estimatedMinutes,
      confirmationDelay: work.confirmationDelay,
    };
  const projected = {
    ...work,
    priority: input.priority,
    technicianNotes: input.technicianNotes,
    estimatedMinutes: input.estimatedMinutes,
    confirmationDelay: input.confirmationDelay,
  };
  const preparation: OpsStatement[] = [
    access,
    {
      sql: "UPDATE ops_work_orders SET priority = ?, technician_notes = ?, estimated_minutes = ?, confirmation_delay = ? WHERE organization_id = ? AND id = ?",
      params: [
        input.priority,
        input.technicianNotes ?? null,
        input.estimatedMinutes ?? null,
        input.confirmationDelay ?? null,
        org,
        work.id,
      ],
    },
    ...resultAudit(work, input.actor, now, ids, "work_order.review_routed", {
      decision: input.decision,
      priority: input.priority,
      technicianNotes: input.technicianNotes,
      estimatedMinutes: input.estimatedMinutes,
      confirmationDelay: input.confirmationDelay,
      reason: input.reason,
    }),
  ];
  const repository = new Proxy(r, {
    get(target, key) {
      if (key === "getWorkOrder")
        return async (organizationId: string, id: string) =>
          organizationId === org && id === work.id
            ? projected
            : target.getWorkOrder(organizationId, id);
      if (key === "atomicWrite")
        return (statements: readonly OpsStatement[]) =>
          target.atomicWrite([...preparation, ...statements]);
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as OpsRepository;
  const services = { ...svc, repository, clock: { now: () => now }, ids };
  if (input.decision === "not_needed") {
    if (!input.reason?.trim())
      throw new OpsDomainError("VALIDATION", "Explain why work is not needed.");
    await updateWorkOrderControl(services, {
      organizationId: org,
      workOrderId: work.id,
      expectedVersion: input.expectedVersion,
      expectedStatus: work.status,
      status: "cancelled",
      note: input.reason,
      actor: input.actor,
    });
  } else if (input.decision === "outside_vendor")
    await assignWorkOrder(services, {
      organizationId: org,
      workOrderId: work.id,
      kind: "outside_vendor",
      vendorId: input.vendorId,
      actor: input.actor,
    });
  else if (input.decision === "next_visit") {
    const assignment = await r.getActiveAssignment(org, work.id);
    if (assignment?.kind === "internal")
      await placeWorkOrderOnVisitHold(services, {
        organizationId: org,
        workOrderId: work.id,
        posture: "complete_using_professional_judgment",
        deadlineAt: input.holdDeadlineAt ?? "",
        actor: input.actor,
      });
    else
      await changeInternalDispatch(
        services,
        {
          organizationId: org,
          workOrderId: work.id,
          expectedVersion: input.expectedVersion,
          expectedAssignmentId: assignment?.id ?? null,
          action: "assign",
          target: "pool",
          key: input.key,
          actor: input.actor,
        },
        {
          intent: JSON.stringify({
            review: "next_visit",
            deadline: input.holdDeadlineAt,
          }),
          async prepare(observed, assigned, tasks) {
            const statements: OpsStatement[] = [];
            const heldRepository = new Proxy(repository, {
              get(target, key) {
                if (key === "getActiveAssignment")
                  return (organizationId: string, id: string) =>
                    organizationId === org && id === work.id
                      ? Promise.resolve(assigned)
                      : target.getActiveAssignment(organizationId, id);
                if (key === "listWorkflowTasksForWorkOrder")
                  return (organizationId: string, id: string) =>
                    organizationId === org && id === work.id
                      ? Promise.resolve([...tasks])
                      : target.listWorkflowTasksForWorkOrder(
                          organizationId,
                          id,
                        );
                const value = Reflect.get(target, key);
                return typeof value === "function" ? value.bind(target) : value;
              },
            }) as OpsRepository;
            await placeWorkOrderOnVisitHold(
              { ...services, repository: heldRepository },
              {
                organizationId: org,
                workOrderId: observed.id,
                posture: "complete_using_professional_judgment",
                deadlineAt: input.holdDeadlineAt ?? "",
                actor: input.actor,
              },
              { append: (batch) => statements.push(...batch) },
            );
            return statements;
          },
        },
      );
  } else {
    const assignment = await r.getActiveAssignment(org, work.id);
    await changeInternalDispatch(services, {
      organizationId: org,
      workOrderId: work.id,
      expectedVersion: input.expectedVersion,
      expectedAssignmentId: assignment?.id ?? null,
      action: "assign",
      target: "pool",
      key: input.key,
      actor: input.actor,
    });
  }
  return {
    id: work.id,
    href:
      input.decision === "outside_vendor"
        ? `/app/work-orders/${encodeURIComponent(work.id)}?view=service`
        : input.decision === "internal"
          ? "/app/dispatch?view=plan"
          : "/app/action-center",
    message: "Saved · Work routed",
  };
}
