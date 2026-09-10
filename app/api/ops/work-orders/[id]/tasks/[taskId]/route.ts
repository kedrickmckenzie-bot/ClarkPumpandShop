import { OpsDomainError } from "@/lib/ops/commands";
import {
  cancelWorkflowTask,
  completeWorkflowTask,
  escalateWorkflowTask,
  pauseWorkflowTaskSla,
  resumeWorkflowTaskSla,
  startWorkflowTask,
} from "@/lib/ops/workflow-task-commands";
import type {
  WorkflowTaskSlaClock,
  WorkflowTaskSlaOwnerType,
  WorkflowTaskSlaPauseReason,
} from "@/lib/ops/types";
import {
  assertStoreInSessionScope,
  formText,
  getOpsRequestContext,
  opsApiError,
  optionalIsoDate,
} from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

const pauseReasons = new Set<WorkflowTaskSlaPauseReason>([
  "awaiting_vendor", "awaiting_parts", "awaiting_approval", "awaiting_store_access",
  "awaiting_customer", "weather_or_site_condition", "scheduled_future_event",
  "external_dependency", "other",
]);
const ownerTypes = new Set<WorkflowTaskSlaOwnerType>([
  "membership", "team", "vendor", "store", "external_party", "system",
]);
const slaClocks = new Set<WorkflowTaskSlaClock>([
  "intake_review", "approval", "vendor_response", "scheduling", "arrival",
  "operational_restoration", "completion", "verification",
]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> },
) {
  try {
    const context = await getOpsRequestContext(["facilities", "regional"]);
    const { id: workOrderId, taskId } = await params;
    const organizationId = context.session.organizationId;
    const [workOrder, task] = await Promise.all([
      context.repository.getWorkOrder(organizationId, workOrderId),
      context.repository.getWorkflowTask(organizationId, taskId),
    ]);
    if (!workOrder || !task || task.workOrderId !== workOrder.id) {
      throw new OpsDomainError("NOT_FOUND", "Workflow Task was not found on this work order in your organization.");
    }
    await assertStoreInSessionScope(context.session, workOrder.storeId);

    const formData = await request.formData();
    const operation = formText(formData, "operation", { required: true, max: 20 });
    const expectedStatus = formText(formData, "expectedStatus", { max: 20 });
    if (expectedStatus && expectedStatus !== task.status) {
      throw new OpsDomainError("CONFLICT", "This Workflow Task changed after the page loaded. Refresh before acting.");
    }
    const input = { organizationId, workflowTaskId: task.id, actor: context.actor };

    if (operation === "start") {
      await startWorkflowTask({ repository: context.repository }, input);
    } else if (operation === "complete" || operation === "cancel") {
      const resolutionNote = formText(formData, "resolutionNote", { required: true, max: 2_000 });
      const command = operation === "complete" ? completeWorkflowTask : cancelWorkflowTask;
      await command({ repository: context.repository }, { ...input, resolutionNote });
    } else if (operation === "pause") {
      const reasonCode = formText(formData, "reasonCode", { required: true, max: 80 }) as WorkflowTaskSlaPauseReason;
      const ownerType = formText(formData, "ownerType", { required: true, max: 40 }) as WorkflowTaskSlaOwnerType;
      const affectedClocks = formData.getAll("affectedClocks")
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim() as WorkflowTaskSlaClock);
      if (!pauseReasons.has(reasonCode) || !ownerTypes.has(ownerType) || !affectedClocks.length || affectedClocks.some((clock) => !slaClocks.has(clock))) {
        throw new OpsDomainError("VALIDATION", "Choose a hold reason, responsible owner, and the deadline being paused.");
      }
      await pauseWorkflowTaskSla(
        { repository: context.repository },
        {
          ...input,
          reasonCode,
          reasonDetail: formText(formData, "reasonDetail", { required: true, max: 2_000 }),
          ownerType,
          ownerId: formText(formData, "ownerId", { max: 120 }) || undefined,
          ownerName: formText(formData, "ownerName", { required: true, max: 200 }),
          affectedClocks,
          expectedResumeAt: optionalIsoDate(formText(formData, "expectedResumeAt", { max: 40 })),
        },
      );
    } else if (operation === "resume") {
      await resumeWorkflowTaskSla(
        { repository: context.repository },
        {
          ...input,
          pauseId: formText(formData, "expectedPauseId", { max: 120 }) || undefined,
          note: formText(formData, "note", { max: 2_000 }) || undefined,
        },
      );
    } else if (operation === "escalate") {
      await escalateWorkflowTask(
        { repository: context.repository },
        {
          ...input,
          escalationDestination: formText(formData, "escalationDestination", { required: true, max: 200 }),
          reason: formText(formData, "reason", { required: true, max: 2_000 }),
        },
      );
    } else {
      throw new OpsDomainError("VALIDATION", "Choose start, complete, cancel, pause, resume, or escalate.");
    }

    return relativeRedirect303(
      `/app/work-orders/${encodeURIComponent(workOrder.id)}?view=activity&updated=workflow-task-${operation}#workflow-tasks`,
    );
  } catch (error) {
    return opsApiError(error);
  }
}
