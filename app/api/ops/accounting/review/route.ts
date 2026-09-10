import { z } from "zod";
import { getOpsRequestContext, formText, opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";
import { reviewAccountingInvoice } from "@/lib/ops/accounting-import";
const splitsSchema = z.array(z.object({ lineId: z.string().min(1).max(160), workOrderId: z.string().min(1).max(180), amount: z.string().regex(/^\d+(?:\.\d{1,2})?$/) })).max(800);
export async function POST(request: Request) {
  try {
    const context = await getOpsRequestContext(["executive", "facilities", "finance"]);
    const form = await request.formData();
    const sourceId = formText(form, "sourceId", { required: true, max: 180 });
    const splits = splitsSchema.parse(JSON.parse(formText(form, "splits", { required: true, max: 100000 }))).map((split) => ({ lineId: split.lineId, workOrderId: split.workOrderId, amountMinor: Math.round(Number(split.amount) * 100) }));
    await reviewAccountingInvoice({ repository: context.repository }, context.actor, { sourceId, expectedVersion: Number(formText(form, "expectedVersion", { required: true, max: 16 })), vendorId: formText(form, "vendorId", { required: true, max: 160 }), existingInvoiceId: formText(form, "existingInvoiceId", { max: 160 }) || undefined, confirmDistinctInvoice: form.get("confirmDistinctInvoice") === "true", splits, reason: formText(form, "reason", { required: true, max: 2000 }) });
    return relativeRedirect303(`/app/invoices/accounting?source=${encodeURIComponent(sourceId)}&saved=reviewed`);
  } catch (error) { return opsApiError(error); }
}
