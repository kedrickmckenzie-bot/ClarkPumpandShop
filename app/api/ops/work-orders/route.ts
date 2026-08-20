import { createWorkOrder, OpsDomainError } from "@/lib/ops/commands";
import {
  assertStoreInSessionScope,
  formText,
  getOpsRequestContext,
  opsApiError,
  optionalIsoDate,
  optionalMoneyMinor,
} from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

const priorities = new Set(["routine", "urgent", "emergency", "planned"]);
const assignmentKinds = new Set(["internal", "outside_vendor", "bid_request", "choose_later"]);

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
    if (!priorities.has(priority) || !assignmentKinds.has(assignmentKind)) {
      throw new OpsDomainError("VALIDATION", "Choose a supported priority and assignment route.");
    }
    await assertStoreInSessionScope(context.session, storeId);

    const vendorId = formText(formData, "vendorId", { max: 120 }) || undefined;
    const internalMembershipId = formText(formData, "internalMembershipId", { max: 120 }) || undefined;
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
    const destination = assignmentKind === "bid_request"
      ? `/app/work-orders/${encodeURIComponent(result.id)}?view=service&updated=bid-request-created#bid-requests`
      : assignmentKind === "outside_vendor"
        ? `/app/work-orders/${encodeURIComponent(result.id)}?view=service&updated=service-work-created#issue-work`
        : `/app/work-orders/${encodeURIComponent(result.id)}?created=true`;
    return relativeRedirect303(destination);
  } catch (error) {
    return opsApiError(error);
  }
}
