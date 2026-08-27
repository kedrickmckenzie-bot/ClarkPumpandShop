import { createWorkOrder, OpsDomainError, reconcileUnmatchedVisit } from "@/lib/ops/commands";
import {
  assertStoreInSessionScope,
  formText,
  getOpsRequestContext,
  opsApiError,
  optionalIsoDate,
  optionalMoneyMinor,
} from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";
import { issueWorkOrderToVendor } from "@/lib/server/work-order-issuance";

const priorities = new Set(["routine", "urgent", "emergency", "planned"]);
const assignmentKinds = new Set(["internal", "outside_vendor", "bid_request", "choose_later"]);
const intents = new Set(["save", "create_and_send"]);

function optionalPositiveInteger(value: string) {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new OpsDomainError("VALIDATION", "Expected service gained must be a positive whole number of months.");
  }
  return parsed;
}

export async function POST(request: Request) {
  try {
    const context = await getOpsRequestContext(["facilities", "regional"]);
    const formData = await request.formData();
    const storeId = formText(formData, "storeId", { required: true, max: 120 });
    const priority = formText(formData, "priority", { required: true, max: 20 });
    const assignmentKind = formText(formData, "assignmentKind", { required: true, max: 30 });
    const intent = formText(formData, "intent", { max: 30 }) || "save";
    if (!priorities.has(priority) || !assignmentKinds.has(assignmentKind)) {
      throw new OpsDomainError("VALIDATION", "Choose a supported priority and assignment route.");
    }
    if (!intents.has(intent)) throw new OpsDomainError("VALIDATION", "Choose a supported work-order action.");
    if (intent === "create_and_send" && assignmentKind !== "outside_vendor") {
      throw new OpsDomainError("VALIDATION", "Create and email is available only when an outside vendor is selected.");
    }
    if (intent === "create_and_send" && formText(formData, "sourceExceptionId", { max: 120 })) {
      throw new OpsDomainError("VALIDATION", "A visit-derived work order must be reviewed before a new service authorization is sent.");
    }
    await assertStoreInSessionScope(context.session, storeId);

    const vendorId = formText(formData, "vendorId", { max: 120 }) || undefined;
    const internalMembershipId = formText(formData, "internalMembershipId", { max: 120 }) || undefined;
    const sourceExceptionId = formText(formData, "sourceExceptionId", { max: 120 }) || undefined;
    let sourceVisit: Awaited<ReturnType<typeof context.repository.getVisit>> | undefined;
    if (sourceExceptionId) {
      const sourceException = await context.repository.getException(context.session.organizationId, sourceExceptionId);
      if (!sourceException || sourceException.kind !== "no_work_order" || sourceException.status === "resolved" || !sourceException.visitId) {
        throw new OpsDomainError("CONFLICT", "The unmatched-visit review item is no longer available.");
      }
      sourceVisit = await context.repository.getVisit(context.session.organizationId, sourceException.visitId) ?? undefined;
      if (!sourceVisit || sourceVisit.workOrderId || sourceVisit.storeId !== storeId) {
        throw new OpsDomainError("CONFLICT", "The visit is already linked or does not belong to the selected store.");
      }
      if (sourceVisit.providerKind === "outside_vendor" && (assignmentKind !== "outside_vendor" || vendorId !== sourceVisit.vendorId)) {
        throw new OpsDomainError("VALIDATION", "Work created from this visit must stay assigned to the vendor who checked in.");
      }
      if (sourceVisit.providerKind === "internal" && (assignmentKind !== "internal" || internalMembershipId !== sourceVisit.internalMembershipId)) {
        throw new OpsDomainError("VALIDATION", "Work created from this visit must stay assigned to the internal technician who checked in.");
      }
    }
    if (assignmentKind === "outside_vendor") {
      if (!vendorId || !(await context.repository.getVendor(context.session.organizationId, vendorId))) {
        throw new OpsDomainError("VALIDATION", "Choose an approved outside vendor.");
      }
    }
    if (assignmentKind === "internal") {
      if (!internalMembershipId || !(await context.repository.getMembership(context.session.organizationId, internalMembershipId))) {
        throw new OpsDomainError("VALIDATION", "Choose an internal maintenance assignee.");
      }
    }
    const initialAssignmentKind = assignmentKind === "bid_request" ? "choose_later" : assignmentKind;
    const nextAction = assignmentKind === "bid_request"
      ? "Send bid requests and compare responses"
      : assignmentKind === "outside_vendor"
        ? "Generate and send service authorization"
        : assignmentKind === "internal"
          ? "Begin internal maintenance work"
          : "Choose service path";

    const result = await createWorkOrder(
      { repository: context.repository },
      {
        organizationId: context.session.organizationId,
        storeId,
        requestId: formText(formData, "requestId", { max: 120 }) || undefined,
        problem: formText(formData, "problem", { required: true, max: 2_000 }),
        authorizedScope: formText(formData, "authorizedScope", { max: 2_000 }) || undefined,
        categoryKey: formText(formData, "categoryKey", { max: 120 }) || undefined,
        assetId: formText(formData, "assetId", { max: 120 }) || undefined,
        componentId: formText(formData, "componentId", { max: 120 }) || undefined,
        priority: priority as "routine" | "urgent" | "emergency" | "planned",
        accountableParty: "Facilities coordinator",
        nextAction,
        dueAt: optionalIsoDate(formText(formData, "dueAt", { max: 40 })),
        escalationTo: "Facilities director",
        nteAmountMinor: optionalMoneyMinor(formText(formData, "nteAmount", { max: 30 })),
        currency: "USD",
        repairEstimateAmountMinor: optionalMoneyMinor(formText(formData, "repairEstimateAmount", { max: 30 })),
        repairEstimateCurrency: "USD",
        estimatedServiceExtensionMonths: optionalPositiveInteger(formText(formData, "estimatedServiceExtensionMonths", { max: 5 })),
        initialAssignment: {
          kind: initialAssignmentKind as "internal" | "outside_vendor" | "choose_later",
          vendorId: assignmentKind === "outside_vendor" ? vendorId : undefined,
          internalMembershipId: assignmentKind === "internal" ? internalMembershipId : undefined,
        },
        actor: context.actor,
      },
    );
    if (sourceExceptionId && sourceVisit) {
      await reconcileUnmatchedVisit(
        { repository: context.repository },
        {
          organizationId: context.session.organizationId,
          exceptionId: sourceExceptionId,
          workOrderId: result.id,
          note: `Created ${result.number} from the preserved unmatched visit by ${sourceVisit.technicianName} (${sourceVisit.providerName}).`,
          actor: context.actor,
        },
      );
    }
    if (intent === "create_and_send" && vendorId) {
      if (result.approvalRequest) {
        return relativeRedirect303(`/app/work-orders/${encodeURIComponent(result.id)}?view=service&notice=${encodeURIComponent(`${result.number} was created and routed for approval. It will not be sent until approval is recorded.`)}`);
      }
      const issued = await issueWorkOrderToVendor({
        repository: context.repository,
        organizationId: context.session.organizationId,
        organizationName: context.session.organizationName,
        workOrderId: result.id,
        vendorId,
        expectedRevision: 0,
        channel: "email",
        actor: context.actor,
      });
      return relativeRedirect303(`/app/work-orders/${encodeURIComponent(result.id)}?view=service&notice=${encodeURIComponent(issued.notice)}`);
    }
    const destination = sourceExceptionId
      ? `/app/work-orders/${encodeURIComponent(result.id)}?view=visits&notice=${encodeURIComponent(`${result.number} was created after service began and linked to the preserved visit. No prior written authorization was implied.`)}`
      : assignmentKind === "bid_request"
        ? `/app/work-orders/${encodeURIComponent(result.id)}?view=service&updated=bid-request-created#bid-requests`
        : assignmentKind === "outside_vendor"
          ? `/app/work-orders/${encodeURIComponent(result.id)}?view=service&updated=service-work-created#issue-work`
          : `/app/work-orders/${encodeURIComponent(result.id)}?created=true`;
    return relativeRedirect303(destination);
  } catch (error) {
    return opsApiError(error);
  }
}
