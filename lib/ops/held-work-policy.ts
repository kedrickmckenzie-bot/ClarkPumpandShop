import type { OpsRepository } from "./repository";
import type { VendorComplianceDocument, WorkOrder } from "./types";

function normalize(value: string | undefined) {
  return value?.trim().toLocaleLowerCase("en-US") ?? "";
}

export function blockingVendorComplianceIssue(rows: VendorComplianceDocument[], now: string) {
  const byType = new Map<VendorComplianceDocument["documentType"], VendorComplianceDocument[]>();
  for (const row of rows) byType.set(row.documentType, [...(byType.get(row.documentType) ?? []), row]);
  for (const [documentType, records] of byType) {
    if (!records.some((row) => row.blocking)) continue;
    const hasCurrentApproved = records.some((row) => row.reviewStatus === "approved" && (!row.expiresAt || row.expiresAt > now));
    if (hasCurrentApproved) continue;
    const newest = [...records].sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id))[0];
    return { documentType, document: newest };
  }
  return undefined;
}

/**
 * Determines whether manager-approved held work may be disclosed to a vendor
 * already onsite. This is a customer-policy eligibility check, not a claim
 * that the platform certifies an individual technician's competence.
 */
export async function heldWorkVendorEligibility(input: {
  repository: OpsRepository;
  organizationId: string;
  vendorId: string;
  workOrder: WorkOrder;
  now: string;
}) {
  const { repository, organizationId, vendorId, workOrder, now } = input;
  const [vendor, store, specialties, qualifications, documents, asset] = await Promise.all([
    repository.getVendor(organizationId, vendorId),
    repository.getStore(organizationId, workOrder.storeId),
    repository.listVendorSpecialties(organizationId, vendorId),
    repository.listVendorQualifications(organizationId, vendorId),
    repository.listVendorComplianceDocuments(organizationId, vendorId),
    workOrder.assetId ? repository.getAsset(organizationId, workOrder.assetId) : Promise.resolve(null),
  ]);
  if (!vendor || vendor.status !== "approved") return { allowed: false, reason: "Vendor is not currently approved." };
  if (!store || !(await repository.vendorCoversStore(organizationId, vendorId, store.id))) return { allowed: false, reason: "Vendor does not cover this store." };

  const category = normalize(workOrder.categoryKey);
  if (!category) return { allowed: false, reason: "Work needs a service category before it can be offered onsite." };
  const activeQualifications = qualifications.filter((row) => row.status === "active"
    && (!row.expiresAt || row.expiresAt > now)
    && (!row.storeId || row.storeId === store.id)
    && (!row.regionId || row.regionId === store.regionId));
  const matchesServiceCategory = specialties.some((row) => normalize(row.canonicalKey) === category)
    || activeQualifications.some((row) => [row.tradeKey, row.workType, row.serviceType, row.assetType, row.componentType].some((value) => normalize(value) === category));
  if (!matchesServiceCategory) return { allowed: false, reason: "Work does not match this vendor's approved service categories." };

  const blockingDocument = blockingVendorComplianceIssue(documents, now);
  if (blockingDocument) return { allowed: false, reason: `Customer-required ${blockingDocument.documentType} record is not current.` };

  if (asset?.warrantyEndsAt && asset.warrantyEndsAt > now && !activeQualifications.some((row) => row.warrantyWork)) {
    return { allowed: false, reason: "Warranty-covered equipment requires an approved warranty service provider." };
  }
  return { allowed: true as const };
}
