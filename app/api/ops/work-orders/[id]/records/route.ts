import { OpsDomainError } from "@/lib/ops/commands";
import { recordWorkOrderCost, updateWorkOrderClassification } from "@/lib/ops/work-recording-commands";
import {
  assertStoreInSessionScope,
  formText,
  getOpsRequestContext,
  opsApiError,
  optionalMoneyMinor,
} from "@/lib/server/ops-request-context";
import type { CostLineKind } from "@/lib/ops/types";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

const costKinds = new Set<CostLineKind>(["labor", "parts", "travel", "materials", "other"]);

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getOpsRequestContext(["facilities", "regional", "finance"]);
    const { id: workOrderId } = await params;
    const workOrder = await context.repository.getWorkOrder(context.session.organizationId, workOrderId);
    if (!workOrder) throw new OpsDomainError("NOT_FOUND", "Work order was not found in your organization.");
    await assertStoreInSessionScope(context.session, workOrder.storeId);
    const formData = await request.formData();
    const operation = formText(formData, "operation", { required: true, max: 30 });
    const submissionKey = formText(formData, "submissionKey", { required: true, max: 120 });
    const expiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString();

    if (operation === "classification") {
      if (context.session.role !== "facilities" && context.session.role !== "regional") {
        throw new OpsDomainError("FORBIDDEN", "Your current role cannot change work-order classification.");
      }
      const categoryKey = formText(formData, "categoryKey", { max: 120 }) || undefined;
      const assetId = formText(formData, "assetId", { max: 120 }) || undefined;
      const componentId = formText(formData, "componentId", { max: 120 }) || undefined;
      const note = formText(formData, "note", { required: true, max: 2_000 });
      await updateWorkOrderClassification(
        { repository: context.repository },
        {
          organizationId: context.session.organizationId,
          workOrderId,
          categoryKey,
          assetId,
          componentId,
          note,
          idempotency: {
            key: submissionKey,
            requestHash: await sha256Hex(JSON.stringify({ operation, workOrderId, categoryKey, assetId, componentId, note })),
            expiresAt,
          },
          actor: context.actor,
        },
      );
    } else if (operation === "cost") {
      const kind = formText(formData, "kind", { required: true, max: 30 });
      if (!costKinds.has(kind as CostLineKind)) throw new OpsDomainError("VALIDATION", "Choose a supported cost type.");
      const amountMinor = optionalMoneyMinor(formText(formData, "amount", { required: true, max: 30 }));
      if (amountMinor === undefined) throw new OpsDomainError("VALIDATION", "Recorded work cost is required.");
      const description = formText(formData, "description", { required: true, max: 500 });
      const serviceDate = formText(formData, "serviceDate", { required: true, max: 10 });
      await recordWorkOrderCost(
        { repository: context.repository },
        {
          organizationId: context.session.organizationId,
          workOrderId,
          kind: kind as CostLineKind,
          description,
          amountMinor,
          currency: "USD",
          serviceDate,
          idempotency: {
            key: submissionKey,
            requestHash: await sha256Hex(JSON.stringify({ operation, workOrderId, kind, description, amountMinor, currency: "USD", serviceDate })),
            expiresAt,
          },
          actor: context.actor,
        },
      );
    } else {
      throw new OpsDomainError("VALIDATION", "Choose a supported work-record operation.");
    }

    return relativeRedirect303(
      `/app/work-orders/${encodeURIComponent(workOrderId)}?view=cost&updated=${encodeURIComponent(operation)}#work-records`,
    );
  } catch (error) {
    return opsApiError(error);
  }
}
