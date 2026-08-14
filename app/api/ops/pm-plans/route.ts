import { OpsDomainError } from "@/lib/ops/commands";
import { createPmPlanWithFirstOccurrence } from "@/lib/ops/setup-commands";
import {
  assertStoreInSessionScope,
  formText,
  getOpsRequestContext,
  opsApiError,
  optionalIsoDate,
} from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

function wholeNumber(value: string, label: string) {
  const number = Number(value);
  if (!Number.isInteger(number)) throw new OpsDomainError("VALIDATION", `${label} must be a whole number.`);
  return number;
}

export async function POST(request: Request) {
  try {
    const context = await getOpsRequestContext(["facilities", "regional", "store_manager"]);
    const formData = await request.formData();
    const storeId = formText(formData, "storeId", { required: true, max: 120 });
    await assertStoreInSessionScope(context.session, storeId);
    const assetId = formText(formData, "assetId", { max: 120 }) || undefined;
    if (assetId) {
      const asset = await context.repository.getAsset(context.session.organizationId, assetId);
      if (!asset || asset.storeId !== storeId) {
        throw new OpsDomainError("VALIDATION", "Choose equipment assigned to the selected store.");
      }
    }
    const firstDueAt = optionalIsoDate(formText(formData, "firstDueAt", { required: true, max: 40 }));
    if (!firstDueAt) throw new OpsDomainError("VALIDATION", "First due date is required.");
    const result = await createPmPlanWithFirstOccurrence(
      { repository: context.repository },
      {
        organizationId: context.session.organizationId,
        name: formText(formData, "name", { required: true, max: 180 }),
        storeId,
        assetId,
        categoryKey: formText(formData, "categoryKey", { max: 80 }) || undefined,
        cadenceDays: wholeNumber(
          formText(formData, "cadenceDays", { required: true, max: 5 }),
          "Cadence",
        ),
        completionWindowDays: wholeNumber(
          formText(formData, "completionWindowDays", { required: true, max: 4 }),
          "Completion window",
        ),
        firstDueAt,
        actor: context.actor,
      },
    );
    const target = new URLSearchParams({
      store: storeId,
      occurrence: result.firstOccurrence.id,
      created: "true",
    });
    return relativeRedirect303(`/app/pm?${target.toString()}`);
  } catch (error) {
    return opsApiError(error);
  }
}
