import { OpsDomainError } from "@/lib/ops/commands";
import { createMaintenanceProgramAndEnrollEquipment } from "@/lib/ops/setup-commands";
import { formText, getOpsRequestContext, opsApiError, optionalIsoDate } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

function wholeNumber(value: string, label: string) {
  const number = Number(value);
  if (!Number.isInteger(number)) throw new OpsDomainError("VALIDATION", `${label} must be a whole number.`);
  return number;
}

export async function POST(request: Request) {
  try {
    const context = await getOpsRequestContext(["executive", "facilities"]);
    const formData = await request.formData();
    const equipmentTemplateIds = formData.getAll("equipmentTemplateId")
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean);
    const firstDueAt = optionalIsoDate(formText(formData, "firstDueAt", { required: true, max: 40 }));
    if (!firstDueAt) throw new OpsDomainError("VALIDATION", "First company due date is required.");
    const result = await createMaintenanceProgramAndEnrollEquipment(
      { repository: context.repository },
      {
        organizationId: context.session.organizationId,
        name: formText(formData, "name", { required: true, max: 180 }),
        applicableEquipmentTemplateIds: equipmentTemplateIds,
        cadenceDays: wholeNumber(formText(formData, "cadenceDays", { required: true, max: 5 }), "Cadence"),
        completionWindowDays: wholeNumber(formText(formData, "completionWindowDays", { required: true, max: 4 }), "Completion window"),
        firstDueAt,
        actor: context.actor,
      },
    );
    return relativeRedirect303(`/app/pm?program=${encodeURIComponent(result.program.id)}&created=true`);
  } catch (error) {
    return opsApiError(error);
  }
}
