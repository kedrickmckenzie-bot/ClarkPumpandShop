import { OpsDomainError } from "@/lib/ops/errors";
import { poundsToOz, type RefrigerantChargeSource, type RefrigerantLeakStatus, type RefrigerantSystemUse } from "@/lib/ops/refrigerant";
import { recordRefrigerantEvent, setAssetRefrigerant } from "@/lib/ops/refrigerant-commands";
import { internalDispatchScope } from "@/lib/server/internal-dispatch-context";
import { formText, getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

function pounds(value: string, label: string) {
  try { return poundsToOz(value, label); }
  catch (error) { throw new OpsDomainError("VALIDATION", error instanceof Error ? error.message : `${label} must be a number of pounds.`); }
}

/** Refrigerant details and records for one piece of equipment. Every save is a new record; nothing is overwritten. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, repository, actor } = await getOpsRequestContext(["facilities", "regional", "technician", "store_manager"], undefined, request);
    const { id } = await params;
    const scope = session.role === "technician" ? await internalDispatchScope(repository, session) : session;
    if (!await repository.getAssetDetail(scope, id)) throw new OpsDomainError("NOT_FOUND", "Equipment not found.");
    const data = await request.formData();
    const kind = formText(data, "action", { required: true, max: 20 });
    const requestedReturn = formText(data, "returnTo", { max: 300 }) ?? "";
    const back = /^\/app\/[A-Za-z0-9/_%.-]*(\?[A-Za-z0-9=&_%.-]*)?$/u.test(requestedReturn) ? requestedReturn : `/app/equipment/${encodeURIComponent(id)}`;
    const svc = { repository };
    if (kind === "facts") {
      await setAssetRefrigerant(svc, {
        organizationId: session.organizationId, assetId: id, actor,
        refrigerant: formText(data, "refrigerant", { required: true, max: 20 }) ?? "",
        fullChargeOz: pounds(formText(data, "fullChargeLb", { max: 12 }) ?? "", "Full charge"),
        systemUse: (formText(data, "systemUse", { required: true, max: 40 }) ?? "") as RefrigerantSystemUse,
        chargeSource: (formText(data, "chargeSource", { max: 20 }) || undefined) as RefrigerantChargeSource | undefined,
        expectedVersion: Number(formText(data, "expectedVersion", { required: true, max: 12 })),
      });
    } else if (kind === "service" || kind === "check") {
      if (session.role === "store_manager") throw new OpsDomainError("FORBIDDEN", "Ask your maintenance team to record refrigerant work.");
      const key = formText(data, "submissionKey", { required: true, max: 80 }) ?? "";
      const added = kind === "service" ? pounds(formText(data, "addedLb", { required: true, max: 12 }) ?? "", "Refrigerant added") : undefined;
      await recordRefrigerantEvent(svc, {
        organizationId: session.organizationId, assetId: id, actor,
        eventId: `refrigerant-${key}`,
        kind: kind === "service" ? "service" : "verification",
        workOrderId: formText(data, "workOrderId", { max: 120 }) || undefined,
        occurredOn: formText(data, "occurredOn", { required: true, max: 10 }) ?? "",
        addedOz: added,
        leakStatus: kind === "service" ? formText(data, "leakStatus", { required: true, max: 30 }) as RefrigerantLeakStatus : undefined,
        verificationStage: kind === "check" ? formText(data, "stage", { required: true, max: 20 }) as "initial" | "follow_up" : undefined,
        verificationResult: kind === "check" ? formText(data, "result", { required: true, max: 10 }) as "passed" | "failed" : undefined,
        technicianName: formText(data, "technicianName", { required: true, max: 120 }) ?? "",
        technicianCert: formText(data, "technicianCert", { max: 40 }) || undefined,
        notes: formText(data, "notes", { max: 1000 }) || undefined,
        source: session.role === "technician" ? "internal" : "office",
      });
    } else throw new OpsDomainError("VALIDATION", "Unknown refrigerant action.");
    const [path, hash] = back.split("#");
    return relativeRedirect303(`${path}${path.includes("?") ? "&" : "?"}saved=refrigerant#${hash || "refrigerant"}`);
  } catch (error) { return opsApiError(error); }
}
