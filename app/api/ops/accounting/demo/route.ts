import { getOpsRequestContext, formText, opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";
import { importAccountingInvoice } from "@/lib/ops/accounting-import";
import { accountingDemoDelivery } from "@/lib/ops/accounting-demo-adapter";
import { OpsDomainError } from "@/lib/ops/commands";
export async function POST(request: Request) {
  try {
    const context = await getOpsRequestContext(["executive", "facilities", "finance"]);
    const step = formText(await request.formData(), "step", { required: true, max: 30 });
    if (!["new", "replay", "uncertain", "correction", "payment", "void", "credit", "merchandise"].includes(step)) throw new OpsDomainError("VALIDATION", "Choose a demonstration step");
    const result = await importAccountingInvoice({ repository: context.repository }, context.actor, accountingDemoDelivery(step));
    return relativeRedirect303(`/app/invoices/accounting?source=${encodeURIComponent(result.source.id)}&saved=${result.replayed ? "replayed" : "imported"}`);
  } catch (error) { return opsApiError(error); }
}
