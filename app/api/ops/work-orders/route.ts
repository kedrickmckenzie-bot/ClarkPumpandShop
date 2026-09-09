import { createWorkOrder, OpsDomainError, reconcileUnmatchedVisit } from "@/lib/ops/commands";
import { localDateTimeToIso } from "@/lib/ops/local-date-time";
import {
  assertStoreInSessionScope,
  formText,
  getOpsRequestContext,
  opsApiError,
  optionalMoneyMinor,
} from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";
import { issueWorkOrderToVendor } from "@/lib/server/work-order-issuance";
import { roleCan } from "@/components/ops/role-policy";
import { createHash, randomUUID } from "node:crypto";

const priorities = new Set(["routine", "urgent", "emergency", "planned"]);
const assignmentKinds = new Set(["internal", "outside_vendor", "bid_request", "hold_for_visit", "choose_later"]);
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
    const context = await getOpsRequestContext(["facilities", "regional", "store_manager"], "create_work_order");
    const formData = await request.formData();
    const submissionKey = formText(formData, "submissionKey", { max: 120 }) || `work-order:${randomUUID()}`;
    const requestHash = createHash("sha256")
      .update([...formData.entries()]
        .filter(([key]) => key !== "submissionKey")
        .map(([key, value]) => `${key}=${typeof value === "string" ? value : `${value.name}:${value.size}`}`)
        .sort()
        .join("\n"))
      .digest("hex");
    const priorSubmission = await context.repository.getIdempotencyKey(context.session.organizationId, submissionKey);
    const storeId = formText(formData, "storeId", { required: true, max: 120 });
    const priority = formText(formData, "priority", { required: true, max: 20 });
    const assignmentKind = formText(formData, "assignmentKind", { required: true, max: 30 });
    const intent = formText(formData, "intent", { max: 30 }) || "save";
    if (!priorities.has(priority) || !assignmentKinds.has(assignmentKind)) {
      throw new OpsDomainError("VALIDATION", "Choose a supported priority and assignment route.");
    }
    if (!intents.has(intent)) throw new OpsDomainError("VALIDATION", "Choose a supported work-order action.");
    if (context.session.role === "store_manager" && priority !== "routine") {
      throw new OpsDomainError("FORBIDDEN", "Store managers can create only routine work. Escalate urgent or emergency issues to facilities.");
    }
    if (intent === "create_and_send" && !roleCan(context.session, "issue_work_order")) {
      throw new OpsDomainError("FORBIDDEN", "Dispatch is not enabled for your role.");
    }
    if (intent === "create_and_send" && assignmentKind !== "outside_vendor") {
      throw new OpsDomainError("VALIDATION", "Create and email is available only when an outside vendor is selected.");
    }
    if (intent === "create_and_send" && formText(formData, "sourceExceptionId", { max: 120 })) {
      throw new OpsDomainError("VALIDATION", "A visit-derived work order must be reviewed before a new service authorization is sent.");
    }
    const store = await assertStoreInSessionScope(context.session, storeId);
    const storeTimeZone = store.timeZone ?? "UTC";
    const dueAtInput = formText(formData, "dueAt", { max: 40 });
    const holdDeadlineInput = formText(formData, "holdDeadlineAt", {
      required: assignmentKind === "hold_for_visit",
      max: 40,
    });

    const vendorId = formText(formData, "vendorId", { max: 120 }) || undefined;
    const internalMembershipId = formText(formData, "internalMembershipId", { max: 120 }) || undefined;
    const sourceExceptionId = formText(formData, "sourceExceptionId", { max: 120 }) || undefined;
    let sourceVisit: Awaited<ReturnType<typeof context.repository.getVisit>> | undefined;
    let sourceException: Awaited<ReturnType<typeof context.repository.getException>> | undefined;
    if (sourceExceptionId) {
      sourceException = await context.repository.getException(context.session.organizationId, sourceExceptionId) ?? undefined;
      if (!sourceException || sourceException.kind !== "no_work_order" || (!priorSubmission && sourceException.status === "resolved") || !sourceException.visitId) {
        throw new OpsDomainError("CONFLICT", "The unmatched-visit review item is no longer available.");
      }
      sourceVisit = await context.repository.getVisit(context.session.organizationId, sourceException.visitId) ?? undefined;
      if (!sourceVisit || (!priorSubmission && sourceVisit.workOrderId) || sourceVisit.storeId !== storeId) {
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
      ? "Send quote requests and compare responses"
      : assignmentKind === "hold_for_visit"
        ? "Wait for a matching vendor visit"
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
        pmOccurrenceId: formText(formData, "pmOccurrenceId", { max: 120 }) || undefined,
        problem: formText(formData, "problem", { required: true, max: 2_000 }),
        authorizedScope: formText(formData, "authorizedScope", { max: 2_000 }) || undefined,
        categoryKey: formText(formData, "categoryKey", { max: 120 }) || undefined,
        assetId: formText(formData, "assetId", { max: 120 }) || undefined,
        componentId: formText(formData, "componentId", { max: 120 }) || undefined,
        priority: priority as "routine" | "urgent" | "emergency" | "planned",
        accountableParty: "Facilities coordinator",
        nextAction,
        dueAt: dueAtInput ? localDateTimeToIso(dueAtInput, storeTimeZone) : undefined,
        escalationTo: "Facilities director",
        nteAmountMinor: optionalMoneyMinor(formText(formData, "nteAmount", { max: 30 })),
        currency: "USD",
        repairEstimateAmountMinor: optionalMoneyMinor(formText(formData, "repairEstimateAmount", { max: 30 })),
        repairEstimateCurrency: "USD",
        estimatedServiceExtensionMonths: optionalPositiveInteger(formText(formData, "estimatedServiceExtensionMonths", { max: 5 })),
        initialAssignment: assignmentKind === "hold_for_visit" ? undefined : {
          kind: initialAssignmentKind as "internal" | "outside_vendor" | "choose_later",
          vendorId: assignmentKind === "outside_vendor" ? vendorId : undefined,
          internalMembershipId: assignmentKind === "internal" ? internalMembershipId : undefined,
        },
        holdForVisit: assignmentKind === "hold_for_visit" ? {
          posture: formText(formData, "holdPosture", { required: true, max: 80 }) as "complete_using_professional_judgment" | "look_and_report",
          deadlineAt: localDateTimeToIso(holdDeadlineInput, storeTimeZone),
          internalReviewThresholdAmountMinor: optionalMoneyMinor(formText(formData, "holdInternalReviewThreshold", { max: 30 })),
          currency: "USD",
        } : undefined,
        idempotency: {
          key: submissionKey,
          command: "create_work_order",
          requestHash,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString(),
        },
        actor: context.actor,
      },
    );
    if (sourceExceptionId && sourceVisit && sourceException?.status !== "resolved") {
      try {
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
      } catch {
        return relativeRedirect303(`/app/work-orders/${encodeURIComponent(result.id)}?view=visits&error=${encodeURIComponent(`${result.number} was created, but the original visit still needs to be linked. The work order was not duplicated; retry from the unmatched-visit review.`)}`);
      }
    }
    if (intent === "create_and_send" && vendorId) {
      if (result.approvalRequest) {
        return relativeRedirect303(`/app/work-orders/${encodeURIComponent(result.id)}?view=service&notice=${encodeURIComponent(`${result.number} was created and routed for approval. It will not be sent until approval is recorded.`)}`);
      }
      const priorIssuance = await context.repository.getLatestIssuanceForWorkOrder(context.session.organizationId, result.id);
      if (priorIssuance) {
        return relativeRedirect303(`/app/work-orders/${encodeURIComponent(result.id)}?view=service&notice=${encodeURIComponent(`${result.number} was already created and sent. The original service authorization remains the source record.`)}`);
      }
      try {
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
      } catch {
        return relativeRedirect303(`/app/work-orders/${encodeURIComponent(result.id)}?view=service&error=${encodeURIComponent(`${result.number} was created, but the vendor handoff was not sent. Review the vendor and send it from this work order; do not create another record.`)}`);
      }
    }
    const destination = sourceExceptionId
      ? `/app/work-orders/${encodeURIComponent(result.id)}?view=visits&notice=${encodeURIComponent(`${result.number} was created after service began and linked to the preserved visit. No prior written authorization was implied.`)}`
      : assignmentKind === "bid_request"
        ? `/app/work-orders/${encodeURIComponent(result.id)}?view=service&updated=bid-request-created#bid-requests`
        : assignmentKind === "hold_for_visit"
          ? `/app/work-orders/${encodeURIComponent(result.id)}?view=service&notice=${encodeURIComponent(`${result.number} is approved to wait for a matching vendor visit.`)}`
        : assignmentKind === "outside_vendor"
          ? `/app/work-orders/${encodeURIComponent(result.id)}?view=service&updated=service-work-created#issue-work`
          : `/app/work-orders/${encodeURIComponent(result.id)}?created=true`;
    return relativeRedirect303(destination);
  } catch (error) {
    return opsApiError(error);
  }
}
