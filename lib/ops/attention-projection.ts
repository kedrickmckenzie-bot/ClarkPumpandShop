import { workflowTaskHref } from "./workflow-task-destination";
import { WARRANTY_REVIEW_TITLE, warrantyTaskHref } from "./warranty-review";
import type {
  ExceptionKind,
  OpsFixture,
  OpsId,
  OrganizationRole,
  WorkflowTask,
} from "./types";

export type AttentionSourceKind = "workflow_task" | "follow_up" | "exception" | "vendor_reminder" | "held_work" | "quote_round" | "inspection_review";
export type AttentionLane = "mine" | "team" | "waiting" | "upcoming" | "history";
export type AttentionGroup = "work_vendor" | "completion" | "service_record" | "financial" | "vendor_relationship";

export interface AttentionProjectionItem {
  id: OpsId;
  sourceKind: AttentionSourceKind;
  /** Every durable record represented by the row. Used to prove grouping without losing identity. */
  sourceIds: OpsId[];
  completedAt?: string;
  workOrderId?: OpsId;
  serviceRequestId?: OpsId;
  vendorId?: OpsId;
  storeId?: OpsId;
  title: string;
  reason: string;
  owner: string;
  dueAt?: string;
  priority: "critical" | "high" | "normal" | "low";
  lane: AttentionLane;
  group: AttentionGroup;
  linkHref: string;
  /** Workflow task type, when the row is a task; used to name the row's action. */
  taskType?: WorkflowTask["taskType"];
}

const financialTaskTypes = new Set<WorkflowTask["taskType"]>([
  "resolve_invoice_exception",
  "respond_service_discrepancy",
]);

const completionTaskTypes = new Set<WorkflowTask["taskType"]>([
  "record_service_outcome",
  "verify_repair",
  "close_verified_work",
]);

const vendorTaskTypes = new Set<WorkflowTask["taskType"]>([
  "vendor_response_required",
  "submit_quote",
  "choose_service_provider",
  "schedule_service",
  "schedule_return_visit",
]);

const financeExceptionKinds = new Set<ExceptionKind>(["unmatched_invoice", "amount_above_authorization"]);

function laneForTask(task: WorkflowTask, input: AttentionProjectionInput): AttentionLane {
  if (task.taskType === "verify_repair" && task.assigneeType === "vendor") return input.role === "store_manager" ? "mine" : "team";
  if (task.assigneeType === "vendor") return "waiting";
  if (task.assigneeType === "user") return task.assigneeId === input.membershipId ? "mine" : "team";
  if (task.assigneeType === "role") return task.assigneeRole === input.role ? "mine" : "waiting";
  return "team";
}

function groupForTask(task: WorkflowTask): AttentionGroup {
  if (financialTaskTypes.has(task.taskType)) return "financial";
  if (completionTaskTypes.has(task.taskType)) return "completion";
  if (vendorTaskTypes.has(task.taskType)) return "work_vendor";
  return "work_vendor";
}

function isTaskVisible(task: WorkflowTask, role: OrganizationRole): boolean {
  const financial = financialTaskTypes.has(task.taskType);
  if (role === "finance_reviewer") return financial;
  if (role === "vendor_user" || role === "store_employee" || role === "internal_technician") return false;
  return !financial || role === "executive" || role === "facilities_admin";
}

function urgency(priority: AttentionProjectionItem["priority"]): number {
  return { critical: 0, high: 1, normal: 2, low: 3 }[priority];
}

export interface AttentionProjectionInput {
  fixture: OpsFixture;
  organizationId: OpsId;
  storeIds: ReadonlySet<OpsId>;
  includeCompanywide: boolean;
  role: OrganizationRole;
  membershipId?: OpsId;
  asOf: string;
  history?: boolean;
}

/** Who reviews recorded inspection results (matches the approval rule in compliance). Executives see them as team work. */
export const INSPECTION_REVIEW_ROLES = new Set<OrganizationRole>(["facilities_admin", "regional_manager", "executive"]);
/** Tasks on an inspection's job that mean "review the result"; their queue rows open the inspection. */
export const INSPECTION_RESULT_TASK_TYPES = ["record_service_outcome", "verify_repair", "close_verified_work"] as const;
export const INSPECTION_REVIEW_REASON = "Results were recorded. Review the findings and paperwork, then approve or send back.";
/** The SQL query appends the schedule name to `inspectionReviewTitle("")`, so the name stays last. */
export function inspectionReviewTitle(name: string) { return `Review inspection results: ${name}`; }
export function inspectionReviewLane(role: OrganizationRole): AttentionLane { return role === "executive" ? "team" : "mine"; }
/** The inspection's own due date, at noon UTC so the calendar day never shifts. */
export function inspectionReviewDueAt(dueDate: string) { return `${dueDate.slice(0, 10)}T12:00:00.000Z`; }

export function quoteRoundCopy(requested: number, submitted: number, missed: number) {
  return {
    title: submitted ? "Review the vendor quote round" : missed ? "Follow up on overdue quote requests" : "Wait for requested vendor quotes",
    reason: submitted
      ? `${submitted} of ${requested} ${requested === 1 ? "quote is" : "quotes are"} ready. Compare price, scope, and timing before choosing.`
      : missed
        ? `${missed} ${missed === 1 ? "quote has" : "quotes have"} passed the response deadline. Follow up with the vendor.`
        : `Waiting for ${requested} vendor ${requested === 1 ? "quote" : "quotes"}. No action is due yet.`,
  };
}

/**
 * Produces the complete scoped queue population. Callers may filter and paginate
 * the returned rows, but must not cap its inputs first.
 */
export function projectAttentionItems(input: AttentionProjectionInput): AttentionProjectionItem[] {
  const { fixture, organizationId, storeIds, includeCompanywide } = input;
  const workById = new Map(
    fixture.workOrders
      .filter((work) => work.organizationId === organizationId && storeIds.has(work.storeId))
      .map((work) => [work.id, work]),
  );
  const requestById = new Map(
    fixture.requests
      .filter((request) => request.organizationId === organizationId && storeIds.has(request.storeId))
      .map((request) => [request.id, request]),
  );
  const representedFollowUps = new Set<OpsId>();

  const taskItems = fixture.workflowTasks
    .filter((task) => task.organizationId === organizationId && (input.history ? ["completed", "cancelled"] : ["open", "in_progress"]).includes(task.status))
    .filter((task) => (task.workOrderId ? workById.has(task.workOrderId) : Boolean(task.serviceRequestId && requestById.has(task.serviceRequestId))))
    .filter((task) => isTaskVisible(task, input.role))
    .filter((task) => input.history || task.taskType !== "choose_service_provider" || !(fixture.workOrderVisitHolds ?? []).some(hold => hold.organizationId === organizationId && hold.workOrderId === task.workOrderId && hold.status === "active"))
    .map<AttentionProjectionItem>((task) => {
      if (task.sourceFollowUpId) representedFollowUps.add(task.sourceFollowUpId);
      const work = task.workOrderId ? workById.get(task.workOrderId) : undefined;
      const request = task.serviceRequestId ? requestById.get(task.serviceRequestId) : undefined;
      const follow = fixture.followUps.find(row=>row.organizationId===organizationId && row.id===task.sourceFollowUpId && row.workOrderId===task.workOrderId);
      const approval = fixture.approvalRequests.find(row=>row.organizationId===organizationId && row.id===task.sourceApprovalRequestId && row.storeId===(work?.storeId??request?.storeId) && (row.subjectType==="work_order" ? row.subjectId===task.workOrderId : row.subjectId===task.serviceRequestId));
      const sourceIds = [task.id, follow?.id, approval?.id].filter((id): id is string => Boolean(id));
      return {
        id: task.id,
        sourceKind: "workflow_task",
        sourceIds,
        workOrderId: task.workOrderId,
        serviceRequestId: task.serviceRequestId,
        storeId: work?.storeId ?? request?.storeId,
        title: task.taskType === "review_warranty" ? WARRANTY_REVIEW_TITLE : task.title,
        reason: task.reason,
        owner: task.taskType === "verify_repair" && task.assigneeType === "vendor" ? "Store team" : task.assigneeName,
        dueAt: task.dueAt,
        priority: task.priority,
        lane: input.history ? "history" : laneForTask(task, input),
        completedAt: task.completedAt ?? task.cancelledAt,
        group: groupForTask(task),
        linkHref: warrantyTaskHref(fixture, task) ?? workflowTaskHref(task),
        taskType: task.taskType,
      };
    });

  const followUpItems = fixture.followUps
    .filter((followUp) => followUp.organizationId === organizationId && followUp.status === "open" && workById.has(followUp.workOrderId))
    .filter((followUp) => !representedFollowUps.has(followUp.id))
    .map<AttentionProjectionItem>((followUp) => ({
      id: followUp.id,
      sourceKind: "follow_up",
      sourceIds: [followUp.id],
      workOrderId: followUp.workOrderId,
      storeId: workById.get(followUp.workOrderId)?.storeId,
      title: followUp.nextAction,
      reason: followUp.sourceVisitId
        ? "Required by the latest recorded service outcome."
        : "A manager-created follow-up remains open.",
      owner: followUp.accountableParty,
      dueAt: followUp.dueAt,
      priority: Date.parse(followUp.dueAt) <= Date.parse(input.asOf) ? "critical" : "normal",
      lane: "team",
      group: "completion",
      linkHref: `/app/action-center/${encodeURIComponent(followUp.id)}`,
    }));

  const exceptionItems = fixture.exceptions
    .filter((exception) => exception.organizationId === organizationId && exception.status !== "resolved")
    .filter((exception) => exception.storeId ? storeIds.has(exception.storeId) : includeCompanywide)
    .filter((exception) => input.role === "finance_reviewer" ? financeExceptionKinds.has(exception.kind) : !financeExceptionKinds.has(exception.kind) || input.role === "executive" || input.role === "facilities_admin")
    .map<AttentionProjectionItem>((exception) => ({
      id: exception.id,
      sourceKind: "exception",
      sourceIds: [exception.id],
      workOrderId: exception.workOrderId,
      vendorId: exception.vendorId,
      storeId: exception.storeId,
      title: exception.summary,
      reason: exception.kind,
      owner: financeExceptionKinds.has(exception.kind) ? "Finance review" : "Facilities coordinator",
      dueAt: exception.detectedAt,
      priority: exception.severity === "urgent" ? "critical" : "high",
      lane: input.role === "finance_reviewer" ? "mine" : "team",
      group: financeExceptionKinds.has(exception.kind) ? "financial" : "service_record",
      linkHref: `/app/action-center/${encodeURIComponent(exception.id)}`,
    }));

  const vendorReminderItems = includeCompanywide && input.role !== "finance_reviewer"
    ? fixture.vendorReminders
        .filter((reminder) => reminder.organizationId === organizationId && reminder.status === "open")
        .map<AttentionProjectionItem>((reminder) => ({
          id: reminder.id,
          sourceKind: "vendor_reminder",
          sourceIds: [reminder.id],
          vendorId: reminder.vendorId,
          title: reminder.title,
          reason: reminder.note ?? "Vendor relationship follow-up is still open.",
          owner: reminder.accountableParty,
          dueAt: reminder.dueAt,
          priority: Date.parse(reminder.dueAt) <= Date.parse(input.asOf) ? "critical" : "normal",
          lane: "team",
          group: "vendor_relationship",
          linkHref: `/app/vendors/${encodeURIComponent(reminder.vendorId)}#vendor-reminders`,
        }))
    : [];

  const quoteRoundItems: AttentionProjectionItem[] = [];
  if (input.role !== "finance_reviewer") {
    const requestsByWork = new Map<OpsId, typeof fixture.estimateRequests>();
    for (const request of fixture.estimateRequests ?? []) {
      if (request.organizationId !== organizationId || !workById.has(request.workOrderId) || request.status === "selected") continue;
      if (!["requested", "opened", "submitted"].includes(request.status)) continue;
      const rows = requestsByWork.get(request.workOrderId) ?? [];
      rows.push(request);
      requestsByWork.set(request.workOrderId, rows);
    }
    for (const [workOrderId, requests] of requestsByWork) {
      const submitted = requests.filter((request) => request.status === "submitted");
      const missed = requests.filter((request) => request.dueAt && Date.parse(request.dueAt) <= Date.parse(input.asOf));
      const dueAt = requests.map((request) => request.dueAt).filter((value): value is string => Boolean(value)).sort((a,b)=>Date.parse(a)-Date.parse(b))[0];
      const proposalIds = fixture.estimateProposals
        .filter((proposal) => proposal.organizationId === organizationId && requests.some((request) => request.id === proposal.requestId && request.workOrderId === proposal.workOrderId && request.vendorId === proposal.vendorId))
        .map((proposal) => proposal.id);
      const work = workById.get(workOrderId)!;
      quoteRoundItems.push({
        id: `quote-round-${workOrderId}`,
        sourceKind: "quote_round",
        sourceIds: [...requests.map((request) => request.id), ...proposalIds],
        workOrderId,
        storeId: work.storeId,
        ...quoteRoundCopy(requests.length, submitted.length, missed.length),
        owner: work.accountableParty,
        dueAt,
        priority: missed.length ? "critical" : submitted.length ? "high" : "normal",
        lane: submitted.length || missed.length ? "team" : "waiting",
        group: "work_vendor",
        linkHref: `/app/work-orders/${encodeURIComponent(workOrderId)}?view=service&path=bids#bid-requests`,
      });
    }
  }

  const heldWorkItems = input.role !== "finance_reviewer"
    ? (fixture.workOrderVisitHolds ?? [])
        .filter((hold) => hold.organizationId === organizationId && hold.status === "active" && workById.has(hold.workOrderId))
        .map<AttentionProjectionItem>((hold) => ({
          id: hold.id,
          sourceKind: "held_work",
          sourceIds: [hold.id],
          workOrderId: hold.workOrderId,
          storeId: workById.get(hold.workOrderId)?.storeId,
          title: "Reconsider approved held work",
          reason: "The review date for work waiting on a suitable visit is approaching or overdue.",
          owner: "Facilities coordinator",
          dueAt: hold.deadlineAt,
          priority: Date.parse(hold.deadlineAt) <= Date.parse(input.asOf) ? "critical" : "low",
          lane: Date.parse(hold.deadlineAt) <= Date.parse(input.asOf) ? (input.role === "facilities_admin" ? "mine" : "team") : "upcoming",
          group: "work_vendor",
          linkHref: `/app/work-orders/${encodeURIComponent(hold.workOrderId)}?view=service#visit-hold`,
        }))
    : [];

  // Recorded inspection results wait for a maintenance reviewer, who approves or sends them back on the inspection.
  const inspectionItems = INSPECTION_REVIEW_ROLES.has(input.role)
    ? (fixture.inspections ?? [])
        .filter((inspection) => inspection.organizationId === organizationId && inspection.status === "performed" && storeIds.has(inspection.storeId))
        // One row per inspection: an open result-review task on its job already opens the inspection.
        .filter((inspection) => !inspection.workOrderId || !taskItems.some((task) => task.workOrderId === inspection.workOrderId && INSPECTION_RESULT_TASK_TYPES.includes(task.taskType as never)))
        .map<AttentionProjectionItem>((inspection) => {
          const schedule = (fixture.complianceSchedules ?? []).find((row) => row.organizationId === organizationId && row.id === inspection.scheduleId);
          const dueAt = inspectionReviewDueAt(inspection.dueDate);
          return {
            id: inspection.id,
            sourceKind: "inspection_review",
            sourceIds: [inspection.id],
            storeId: inspection.storeId,
            title: inspectionReviewTitle(schedule?.name ?? "Inspection"),
            reason: INSPECTION_REVIEW_REASON,
            owner: "Maintenance reviewer",
            dueAt,
            priority: Date.parse(dueAt) <= Date.parse(input.asOf) ? "high" : "normal",
            lane: inspectionReviewLane(input.role),
            group: "completion",
            linkHref: `/app/compliance/${encodeURIComponent(inspection.id)}`,
          };
        })
    : [];

  if (input.history) return taskItems.sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "") || a.id.localeCompare(b.id));

  return [...taskItems, ...followUpItems, ...exceptionItems, ...vendorReminderItems, ...quoteRoundItems, ...heldWorkItems, ...inspectionItems]
    .sort((left, right) => {
      const leftOverdue = left.dueAt && Date.parse(left.dueAt) <= Date.parse(input.asOf) ? 0 : 1;
      const rightOverdue = right.dueAt && Date.parse(right.dueAt) <= Date.parse(input.asOf) ? 0 : 1;
      return leftOverdue - rightOverdue
        || urgency(left.priority) - urgency(right.priority)
        || Date.parse(left.dueAt ?? "9999-12-31") - Date.parse(right.dueAt ?? "9999-12-31")
        || left.id.localeCompare(right.id);
    });
}
