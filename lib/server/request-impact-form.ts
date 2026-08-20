import "server-only";

import type {
  ComplianceImpact,
  ImpactAnswer,
  ImpactConfidence,
  ImpactSafetyConcern,
  ImpactSource,
  ProductInventoryRisk,
  RevenueFunctionImpact,
  StoreOperatingState,
} from "@/lib/ops/types";
import type { RequestImpactAssessmentDraft } from "@/lib/ops/request-impact-assessment";
import { OpsDomainError } from "@/lib/ops/commands";
import { formText, optionalMoneyMinor } from "./ops-request-context";

const operatingStates = new Set<StoreOperatingState>(["open", "partially_operational", "unable_to_operate", "unknown"]);
const safetyConcerns = new Set<ImpactSafetyConcern>(["none_reported", "potential", "immediate", "unknown"]);
const inventoryRisks = new Set<ProductInventoryRisk>(["none_reported", "at_risk", "loss_reported", "unknown"]);
const answers = new Set<ImpactAnswer>(["yes", "no", "unknown"]);
const complianceImpacts = new Set<ComplianceImpact>(["none_reported", "potential", "confirmed", "unknown"]);
const revenueFunctions = new Set<RevenueFunctionImpact>(["fuel", "foodservice", "refrigerated_merchandise", "beverages", "lottery", "car_wash", "other"]);
const confidences = new Set<ImpactConfidence>(["low", "medium", "high"]);

function enumValue<T extends string>(value: string, allowed: ReadonlySet<T>, label: string): T {
  if (!allowed.has(value as T)) throw new OpsDomainError("VALIDATION", `Choose a supported ${label}.`);
  return value as T;
}

function optionalWholeNumber(value: string, label: string) {
  if (!value) return undefined;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new OpsDomainError("VALIDATION", `${label} must be a non-negative whole number.`);
  return number;
}

function optionalCapacityBps(value: string) {
  if (!value) return undefined;
  const percent = Number(value);
  const basisPoints = Math.round(percent * 100);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100 || Math.abs(percent * 100 - basisPoints) > Number.EPSILON * 100) {
    throw new OpsDomainError("VALIDATION", "Unavailable capacity must be between 0 and 100 percent with at most two decimal places.");
  }
  return basisPoints;
}

export function parseRequestImpactForm(
  formData: FormData,
  options: { source: ImpactSource; required: boolean },
): RequestImpactAssessmentDraft | undefined {
  const storeOperatingState = formText(formData, "storeOperatingState", { max: 40 });
  const safetyConcern = formText(formData, "safetyConcern", { max: 40 });
  const productInventoryRisk = formText(formData, "productInventoryRisk", { max: 40 });
  const customersAffected = formText(formData, "customersAffected", { max: 20 });
  const complianceImpact = formText(formData, "complianceImpact", { max: 40 });
  const redundantEquipment = formText(formData, "redundantEquipment", { max: 20 });
  const confidence = formText(formData, "confidence", { max: 20 });
  const hasImpactInput = [storeOperatingState, safetyConcern, productInventoryRisk, customersAffected, complianceImpact, redundantEquipment, confidence].some(Boolean);
  if (!hasImpactInput && !options.required) return undefined;
  if (![storeOperatingState, safetyConcern, productInventoryRisk, customersAffected, complianceImpact, redundantEquipment, confidence].every(Boolean)) {
    throw new OpsDomainError("VALIDATION", "Complete each required business-impact answer.");
  }

  const revenueFunctionImpact = formText(formData, "revenueFunctionImpact", { max: 50 });
  return {
    storeOperatingState: enumValue(storeOperatingState, operatingStates, "store operating state"),
    safetyConcern: enumValue(safetyConcern, safetyConcerns, "safety impact"),
    productInventoryRisk: enumValue(productInventoryRisk, inventoryRisks, "product or inventory risk"),
    productInventoryValueMinor: optionalMoneyMinor(formText(formData, "productInventoryValue", { max: 30 })),
    productInventoryCurrency: "USD",
    customersAffected: enumValue(customersAffected, answers, "customer-impact answer"),
    complianceImpact: enumValue(complianceImpact, complianceImpacts, "compliance impact"),
    capacityUnavailableBps: optionalCapacityBps(formText(formData, "capacityUnavailablePercent", { max: 20 })),
    redundantEquipment: enumValue(redundantEquipment, answers, "redundant-equipment answer"),
    revenueFunctionImpact: revenueFunctionImpact ? enumValue(revenueFunctionImpact, revenueFunctions, "revenue function") : undefined,
    estimatedDailyRevenueExposureMinor: optionalMoneyMinor(formText(formData, "estimatedDailyRevenueExposure", { max: 30 })),
    estimatedDailyRevenueExposureCurrency: "USD",
    estimatedDowntimeMinutes: optionalWholeNumber(formText(formData, "estimatedDowntimeMinutes", { max: 20 }), "Estimated downtime"),
    confidence: enumValue(confidence, confidences, "confidence"),
    source: options.source,
    notes: formText(formData, "impactNotes", { max: 2_000 }) || undefined,
  };
}
