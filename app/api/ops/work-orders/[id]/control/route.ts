import {
  OpsDomainError,
  recordVendorResponse,
  updateWorkOrderControl,
} from "@/lib/ops/commands";
import {
  assertStoreInSessionScope,
  formText,
  getOpsRequestContext,
  opsApiError,
  optionalIsoDate,
} from "@/lib/server/ops-request-context";
import type { VendorResponseKind, WorkOrderPriority, WorkOrderStatus } from "@/lib/ops/types";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

const workOrderStatuses = new Set<WorkOrderStatus>([
  "draft",
  "awaiting_approval",
  "approved",
  "issued",
  "accepted",
  "scheduled",
  "in_progress",
  "waiting_on_vendor",
  "waiting_on_parts",
  "completed_pending_review",
  "closed",
  "cancelled",
]);
const priorities = new Set<WorkOrderPriority>(["emergency", "urgent", "routine", "planned"]);
const vendorResponses = new Set<VendorResponseKind>(["accepted", "declined", "proposed_date", "question"]);
const responseSources = new Map([
  ["phone", "phone"],
  ["email", "email"],
  ["in_person", "in person"],
  ["other", "another documented channel"],
]);

async function recordOutsideResponse(
  context: Awaited<ReturnType<typeof getOpsRequestContext>>,
  workOrderId: string,
  formData: FormData,
) {
  const expectedAssignmentId = formText(formData, "expectedAssignmentId", { required: true, max: 120 });
  const expectedIssuanceId = formText(formData, "expectedIssuanceId", { required: true, max: 120 });
  const expectedIssuanceRevisionText = formText(formData, "expectedIssuanceRevision", { required: true, max: 12 });
  const expectedIssuanceRevision = Number(expectedIssuanceRevisionText);
  if (!Number.isInteger(expectedIssuanceRevision) || expectedIssuanceRevision < 1) {
    throw new OpsDomainError("VALIDATION", "Expected issuance revision is invalid.");
  }

  const organizationId = context.session.organizationId;
  const [expectedAssignment, expectedIssuance, currentAssignment, currentIssuance] = await Promise.all([
    context.repository.getAssignment(organizationId, expectedAssignmentId),
    context.repository.getIssuance(organizationId, expectedIssuanceId),
    context.repository.getActiveAssignment(organizationId, workOrderId),
    context.repository.getLatestIssuanceForWorkOrder(organizationId, workOrderId),
  ]);
  const stale =
    !expectedAssignment ||
    expectedAssignment.kind !== "outside_vendor" ||
    expectedAssignment.workOrderId !== workOrderId ||
    !expectedIssuance ||
    expectedIssuance.workOrderId !== workOrderId ||
    expectedIssuance.assignmentId !== expectedAssignment.id ||
    expectedIssuance.revision !== expectedIssuanceRevision ||
    currentAssignment?.id !== expectedAssignment.id ||
    currentIssuance?.id !== expectedIssuance.id ||
    currentIssuance?.revision !== expectedIssuanceRevision ||
    currentIssuance?.assignmentId !== currentAssignment?.id;
  if (stale) {
    throw new OpsDomainError(
      "CONFLICT",
      "This vendor handoff changed after the page loaded. Refresh the work order before recording the vendor response.",
    );
  }
  const response = formText(formData, "response", { required: true, max: 30 });
  const responseSource = formText(formData, "responseSource", { required: true, max: 30 });
  if (!vendorResponses.has(response as VendorResponseKind) || !responseSources.has(responseSource)) {
    throw new OpsDomainError("VALIDATION", "Choose a supported vendor response and source.");
  }
  const sourceLabel = responseSources.get(responseSource)!;
  const detail = formText(formData, "message", { max: 2_000 });
  const attribution = `Operator-recorded from ${sourceLabel} by ${context.actor.actorName}.`;

  await recordVendorResponse(
    { repository: context.repository },
    {
      organizationId,
      workOrderId,
      assignmentId: expectedAssignment.id,
      issuanceId: expectedIssuance.id,
      response: response as VendorResponseKind,
      responderName: formText(formData, "responderName", { required: true, max: 200 }),
      proposedAt: optionalIsoDate(formText(formData, "proposedAt", { max: 40 })),
      message: detail ? `${attribution} ${detail}` : attribution,
      actor: context.actor,
    },
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getOpsRequestContext(["facilities", "regional"]);
    const { id: workOrderId } = await params;
    const workOrder = await context.repository.getWorkOrder(context.session.organizationId, workOrderId);
    if (!workOrder) throw new OpsDomainError("NOT_FOUND", "Work order was not found in your organization.");
    await assertStoreInSessionScope(context.session, workOrder.storeId);

    const formData = await request.formData();
    const operation = formText(formData, "operation", { max: 30 }) || "update";
    if (operation === "vendor_response") {
      await recordOutsideResponse(context, workOrderId, formData);
      return relativeRedirect303(
        `/app/work-orders/${encodeURIComponent(workOrderId)}?updated=vendor-response#work-control`,
      );
    }
    if (operation !== "update") throw new OpsDomainError("VALIDATION", "Choose a supported work-order operation.");

    const expectedStatus = formText(formData, "expectedStatus", { required: true, max: 40 });
    const status = formText(formData, "status", { required: true, max: 40 });
    const priority = formText(formData, "priority", { required: true, max: 30 });
    if (!workOrderStatuses.has(expectedStatus as WorkOrderStatus) || !workOrderStatuses.has(status as WorkOrderStatus) || !priorities.has(priority as WorkOrderPriority)) {
      throw new OpsDomainError("VALIDATION", "Choose a supported work state and priority.");
    }

    await updateWorkOrderControl(
      { repository: context.repository },
      {
        organizationId: context.session.organizationId,
        workOrderId,
        expectedStatus: expectedStatus as WorkOrderStatus,
        status: status as WorkOrderStatus,
        priority: priority as WorkOrderPriority,
        accountableParty: formText(formData, "accountableParty", { max: 200 }) || undefined,
        nextAction: formText(formData, "nextAction", { max: 500 }) || undefined,
        dueAt: optionalIsoDate(formText(formData, "dueAt", { max: 40 })),
        escalationTo: formText(formData, "escalationTo", { max: 200 }) || undefined,
        note: formText(formData, "note", { required: true, max: 2_000 }),
        actor: context.actor,
      },
    );

    return relativeRedirect303(
      `/app/work-orders/${encodeURIComponent(workOrderId)}?updated=control#work-control`,
    );
  } catch (error) {
    return opsApiError(error);
  }
}
