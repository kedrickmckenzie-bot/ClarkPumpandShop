import { OpsDomainError } from "@/lib/ops/errors";
import { addSpendTotal, SpendTotalOverlapError, withdrawSpendTotal } from "@/lib/ops/spend-totals";
import { formText, getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

const PAGE = "/app/spend/totals";

/** Enters or withdraws a maintenance spend total from accounting. Facilities and finance only; every change is audited. */
export async function POST(request: Request) {
  try {
    const { session, repository, actor } = await getOpsRequestContext(["facilities", "finance"], undefined, request, true);
    const form = await request.formData();
    const action = formText(form, "action", { required: true, max: 10 });
    const svc = { repository };
    if (action === "add") {
      const from = formText(form, "periodStart", { required: true, max: 10 }), to = formText(form, "periodEnd", { required: true, max: 10 });
      const kind = formText(form, "kind", { required: true, max: 10 });
      const raw = formText(form, "amount", { required: true, max: 20 }).replace(/[$,\s]/gu, "");
      const amount = Number(raw);
      if (!raw || !Number.isFinite(amount)) throw new OpsDomainError("VALIDATION", "Enter the amount in dollars, like 48,250.00.");
      try {
        await addSpendTotal(svc, { organizationId: session.organizationId, periodStart: from, periodEnd: to, kind, amountMinor: Math.round(amount * 100), note: formText(form, "note", { max: 500 }) || undefined, actor, key: formText(form, "key", { required: true, max: 80 }) });
      } catch (error) {
        if (!(error instanceof SpendTotalOverlapError)) throw error;
        // Show the new entry beside the saved one it overlaps, with the form filled in again.
        const back = new URLSearchParams({ overlap: error.overlapping.map((entry) => entry.id).join(","), from, to, kind, amount: raw });
        return relativeRedirect303(`${PAGE}?${back}#enter`);
      }
      return relativeRedirect303(`${PAGE}?notice=${encodeURIComponent("Saved.")}`);
    }
    if (action === "withdraw") {
      await withdrawSpendTotal(svc, { organizationId: session.organizationId, id: formText(form, "id", { required: true, max: 160 }), reason: formText(form, "reason", { required: true, max: 300 }), actor });
      return relativeRedirect303(`${PAGE}?notice=${encodeURIComponent("Withdrawn. It stays on record and no longer counts.")}`);
    }
    throw new OpsDomainError("VALIDATION", "Unknown action.");
  } catch (error) { return opsApiError(error); }
}
