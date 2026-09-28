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
    const context = await getOpsRequestContext(["facilities", "regional", "finance"], undefined, request);
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
      const kind = formText(formData, "kind", { max: 30 }) || "other";
      if (!costKinds.has(kind as CostLineKind)) throw new OpsDomainError("VALIDATION", "Choose a supported cost type.");
      const amountMinor = optionalMoneyMinor(formText(formData, "amount", { required: true, max: 30 }));
      if (amountMinor === undefined) throw new OpsDomainError("VALIDATION", "Recorded work cost is required.");
      const providerType = formText(formData,"providerType",{max:20}) || undefined;
      if (providerType && !["internal","vendor"].includes(providerType)) throw new OpsDomainError("VALIDATION","Choose internal expense or vendor cost.");
      const vendorId = providerType === "vendor" ? formText(formData,"vendorId",{max:160}) || undefined : undefined;
      const additionalExpense = formData.get("additionalExpense") === "yes";
      let breakdown: Array<{kind:CostLineKind;amountMinor:number;description?:string}> = [...costKinds].flatMap(kind => { const value = formText(formData,`breakdown_${kind}`,{max:30}); if(!value)return [];const amountMinor=optionalMoneyMinor(value);if(amountMinor===undefined || amountMinor<=0)throw new OpsDomainError("VALIDATION","Breakdown amounts must be greater than zero.");return [{kind,amountMinor}]; });
      const lineCountText = formText(formData,"lineCount",{max:3});
      if (lineCountText) {
        const count=Number(lineCountText);
        if(providerType!=="vendor" || !Number.isInteger(count) || count<1 || count>100) throw new OpsDomainError("VALIDATION","Add between 1 and 100 vendor line items.");
        breakdown=Array.from({length:count},(_,index)=>{
          const description=formText(formData,`lineDescription_${index}`,{required:true,max:500});
          const amountMinor=optionalMoneyMinor(formText(formData,`lineAmount_${index}`,{required:true,max:30}));
          if(amountMinor===undefined || amountMinor<=0) throw new OpsDomainError("VALIDATION","Each line item needs an amount greater than zero.");
          return {kind:"other",description,amountMinor};
        });
      }
      const description = formText(formData, "description", { max: 500 }) || (providerType === "internal" ? "Internal expense" : "Vendor cost");
      const serviceDate = formText(formData, "serviceDate", { required: true, max: 10 });
      await recordWorkOrderCost(
        { repository: context.repository },
        {
          organizationId: context.session.organizationId,
          workOrderId,
          providerType: providerType as "internal" | "vendor" | undefined, vendorId, additionalExpense, breakdown,
          kind: kind as CostLineKind,
          description,
          amountMinor,
          currency: "USD",
          serviceDate,
          idempotency: {
            key: submissionKey,
            requestHash: await sha256Hex(JSON.stringify({ operation, workOrderId, kind, description, amountMinor, currency: "USD", serviceDate, providerType, vendorId, additionalExpense, breakdown })),
            expiresAt,
          },
          actor: context.actor,
        },
      );
    } else {
      throw new OpsDomainError("VALIDATION", "Choose a supported work-record operation.");
    }

    return relativeRedirect303(
      `/app/work-orders/${encodeURIComponent(workOrderId)}?view=${operation === "classification" ? "equipment" : "cost"}&updated=${encodeURIComponent(operation)}#work-records`,
    );
  } catch (error) {
    return opsApiError(error);
  }
}
