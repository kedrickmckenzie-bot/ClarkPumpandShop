import { OpsDomainError } from "@/lib/ops/commands";
import { createWorkflowTask } from "@/lib/ops/workflow-task-commands";
import type {
  OrganizationRole,
  WorkflowTaskAssigneeType,
  WorkflowTaskPriority,
  WorkflowTaskSlaClock,
  WorkflowTaskType,
} from "@/lib/ops/types";
import { domainLabel } from "@/lib/product/domain-label";
import {
  assertStoreInSessionScope,
  formText,
  getOpsRequestContext,
  opsApiError,
  optionalIsoDate,
} from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

const taskTypes = new Set<WorkflowTaskType>([
  "review_issue", "approve_quote", "vendor_response_required", "confirm_store_access",
  "choose_service_provider", "schedule_service", "record_service_outcome",
  "schedule_return_visit", "verify_repair", "other",
]);
const priorities = new Set<WorkflowTaskPriority>(["critical", "high", "normal", "low"]);
const assigneeTypes = new Set<WorkflowTaskAssigneeType>(["user", "team", "vendor", "role"]);
const roles = new Set<OrganizationRole>([
  "executive", "facilities_admin", "regional_manager", "store_manager", "store_employee",
  "internal_technician", "finance_reviewer", "vendor_user", "support",
]);
const slaClocks = new Set<WorkflowTaskSlaClock>([
  "intake_review", "approval", "vendor_response", "scheduling", "arrival",
  "operational_restoration", "completion", "verification",
]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getOpsRequestContext(["facilities", "regional"]);
    const { id: workOrderId } = await params;
    const organizationId = context.session.organizationId;
    const workOrder = await context.repository.getWorkOrder(organizationId, workOrderId);
    if (!workOrder) throw new OpsDomainError("NOT_FOUND", "Work order was not found in your organization.");
    await assertStoreInSessionScope(context.session, workOrder.storeId);

    const formData = await request.formData();
    const taskType = formText(formData, "taskType", { required: true, max: 80 }) as WorkflowTaskType;
    const priority = formText(formData, "priority", { required: true, max: 20 }) as WorkflowTaskPriority;
    const assigneeType = formText(formData, "assigneeType", { required: true, max: 20 }) as WorkflowTaskAssigneeType;
    if (!taskTypes.has(taskType) || !priorities.has(priority) || !assigneeTypes.has(assigneeType)) {
      throw new OpsDomainError("VALIDATION", "Choose a supported Workflow Task type, priority, and assignee type.");
    }

    let assigneeId: string | undefined;
    let assigneeRole: OrganizationRole | undefined;
    let assigneeName: string;
    if (assigneeType === "role") {
      assigneeRole = formText(formData, "assigneeRole", { required: true, max: 80 }) as OrganizationRole;
      if (!roles.has(assigneeRole)) throw new OpsDomainError("VALIDATION", "Choose a supported organization role.");
      assigneeName = domainLabel(assigneeRole);
    } else {
      assigneeId = formText(formData, "assigneeId", { required: true, max: 120 });
      if (assigneeType === "user") {
        if (!context.session.membershipId || assigneeId !== context.session.membershipId) {
          throw new OpsDomainError("FORBIDDEN", "This operator surface can assign a user task only to your active membership.");
        }
        assigneeName = context.session.displayName;
      } else if (assigneeType === "vendor") {
        const vendor = await context.repository.getVendor(organizationId, assigneeId);
        if (!vendor || vendor.status === "inactive") throw new OpsDomainError("NOT_FOUND", "Assigned vendor was not found in your organization.");
        assigneeName = vendor.name;
      } else {
        assigneeName = formText(formData, "assigneeName", { required: true, max: 200 });
      }
    }

    const dueAt = optionalIsoDate(formText(formData, "dueAt", { max: 40 }));
    const noSlaReason = formText(formData, "noSlaReason", { max: 1_000 }) || undefined;
    if (Boolean(dueAt) === Boolean(noSlaReason)) {
      throw new OpsDomainError("VALIDATION", "Provide a due time or an explicit no-SLA policy reason.");
    }
    const rawSlaClock = formText(formData, "applicableSlaClock", { max: 80 });
    const applicableSlaClock = rawSlaClock ? rawSlaClock as WorkflowTaskSlaClock : undefined;
    if (applicableSlaClock && !slaClocks.has(applicableSlaClock)) {
      throw new OpsDomainError("VALIDATION", "Choose a supported reactive-work SLA clock.");
    }

    await createWorkflowTask(
      { repository: context.repository },
      {
        organizationId,
        workOrderId: workOrder.id,
        taskType,
        title: formText(formData, "title", { required: true, max: 240 }),
        reason: formText(formData, "reason", { required: true, max: 2_000 }),
        assigneeType,
        assigneeId,
        assigneeRole,
        assigneeName,
        priority,
        blocking: formText(formData, "blocking", { max: 8 }) === "true",
        requiredForProgress: formText(formData, "requiredForProgress", { max: 8 }) === "true",
        dueAt,
        noSlaReason,
        applicableSlaClock,
        completionCriteria: formText(formData, "completionCriteria", { required: true, max: 2_000 }),
        escalationDestination: formText(formData, "escalationDestination", { required: true, max: 200 }),
        actor: context.actor,
      },
    );

    return relativeRedirect303(
      `/app/work-orders/${encodeURIComponent(workOrder.id)}?view=activity&updated=workflow-task-created#workflow-tasks`,
    );
  } catch (error) {
    return opsApiError(error);
  }
}
