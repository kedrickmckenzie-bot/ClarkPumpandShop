import { OpsDomainError, placeWorkOrderOnVisitHold, releaseWorkOrderVisitHold } from "@/lib/ops/commands";
import { localDateTimeToIso } from "@/lib/ops/local-date-time";
import type { HeldWorkPosture } from "@/lib/ops/types";
import {
  assertStoreInSessionScope,
  formText,
  getOpsRequestContext,
  opsApiError,
  optionalMoneyMinor,
} from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

const postures = new Set<HeldWorkPosture>([
  "complete_using_professional_judgment",
  "look_and_report",
]);

function safeReturnTo(value: string, workOrderId: string) {
  const fallback = `/app/work-orders/${encodeURIComponent(workOrderId)}?view=service#future-visit-hold`;
  if (!value.startsWith("/app/work-orders") || value.startsWith("//")) return fallback;
  return value;
}

function withNotice(destination: string, notice: string) {
  const target = new URL(destination, "https://operations.invalid");
  target.searchParams.set("notice", notice);
  return `${target.pathname}${target.search}${target.hash}`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getOpsRequestContext(["facilities", "regional"]);
    const { id: workOrderId } = await params;
    const workOrder = await context.repository.getWorkOrder(context.session.organizationId, workOrderId);
    if (!workOrder) throw new OpsDomainError("NOT_FOUND", "Work order was not found.");
    const store = await assertStoreInSessionScope(context.session, workOrder.storeId);
    const formData = await request.formData();
    const operation = formText(formData, "operation", { required: true, max: 30 });
    const returnTo = safeReturnTo(formText(formData, "returnTo", { max: 1_000 }), workOrderId);

    if (operation === "release") {
      await releaseWorkOrderVisitHold(
        { repository: context.repository },
        { organizationId: context.session.organizationId, workOrderId, actor: context.actor },
      );
      return relativeRedirect303(withNotice(
        returnTo,
        "This work is no longer set aside. Choose the next service path when ready.",
      ));
    }
    if (operation !== "place") throw new OpsDomainError("VALIDATION", "Choose a supported held-work action.");

    const posture = formText(formData, "posture", { required: true, max: 80 }) as HeldWorkPosture;
    if (!postures.has(posture)) throw new OpsDomainError("VALIDATION", "Choose what the vendor may do onsite.");
    const localDeadline = formText(formData, "deadlineAt", { required: true, max: 40 });
    const deadlineAt = localDateTimeToIso(localDeadline, store.timeZone ?? "UTC");
    await placeWorkOrderOnVisitHold(
      { repository: context.repository },
      {
        organizationId: context.session.organizationId,
        workOrderId,
        posture,
        deadlineAt,
        internalReviewThresholdAmountMinor: optionalMoneyMinor(
          formText(formData, "internalReviewThreshold", { max: 30 }),
        ),
        currency: "USD",
        actor: context.actor,
      },
    );
    return relativeRedirect303(withNotice(
      returnTo,
      "Approved-for-later instructions saved.",
    ));
  } catch (error) {
    return opsApiError(error);
  }
}
