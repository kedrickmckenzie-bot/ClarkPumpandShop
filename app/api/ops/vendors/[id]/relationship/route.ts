import {
  OpsDomainError,
  recordVendorComplianceDocument,
  recordVendorQualification,
} from "@/lib/ops/commands";
import {
  formText,
  getOpsRequestContext,
  opsApiError,
  optionalIsoDate,
  optionalMoneyMinor,
} from "@/lib/server/ops-request-context";
import { getServerOpsFixtureSnapshot } from "@/lib/server/ops-repository-provider";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

const documentTypes = new Set(["insurance", "license", "certification", "tax", "safety", "other"] as const);
const reviewStatuses = new Set(["pending", "approved", "rejected", "expired"] as const);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getOpsRequestContext(["facilities"]);
    const { id: vendorId } = await params;
    const vendor = await context.repository.getVendor(context.session.organizationId, vendorId);
    if (!vendor) throw new OpsDomainError("NOT_FOUND", "Vendor not found in organization");
    const formData = await request.formData();
    const operation = formText(formData, "operation", { required: true, max: 40 });

    if (operation === "record_compliance") {
      const documentType = formText(formData, "documentType", { required: true, max: 40 }) as "insurance" | "license" | "certification" | "tax" | "safety" | "other";
      const reviewStatus = formText(formData, "reviewStatus", { required: true, max: 40 }) as "pending" | "approved" | "rejected" | "expired";
      if (!documentTypes.has(documentType)) throw new OpsDomainError("VALIDATION", "Document type is invalid");
      if (!reviewStatuses.has(reviewStatus)) throw new OpsDomainError("VALIDATION", "Review status is invalid");
      await recordVendorComplianceDocument(
        { repository: context.repository },
        {
          organizationId: context.session.organizationId,
          vendorId,
          documentType,
          issuer: formText(formData, "issuer", { max: 160 }) || undefined,
          reference: formText(formData, "reference", { required: true, max: 200 }),
          effectiveAt: optionalIsoDate(formText(formData, "effectiveAt", { max: 40 })),
          expiresAt: optionalIsoDate(formText(formData, "expiresAt", { max: 40 })),
          reviewStatus,
          blocking: formData.get("blocking") === "true",
          actor: context.actor,
        },
      );
      return relativeRedirect303(`/app/vendors/${encodeURIComponent(vendorId)}?notice=Compliance+record+added#compliance-evidence`);
    }

    if (operation === "record_qualification") {
      const snapshot = await getServerOpsFixtureSnapshot(context.session.organizationId);
      const tradeKey = formText(formData, "tradeKey", { required: true, max: 120 });
      const approvedTradeKeys = new Set(snapshot.vendorSpecialties
        .filter((specialty) => specialty.organizationId === context.session.organizationId && specialty.vendorId === vendorId)
        .map((specialty) => specialty.canonicalKey));
      if (!approvedTradeKeys.has(tradeKey)) throw new OpsDomainError("VALIDATION", "Choose a trade already approved on this vendor profile");
      await recordVendorQualification(
        { repository: context.repository },
        {
          organizationId: context.session.organizationId,
          vendorId,
          tradeKey,
          serviceType: formText(formData, "serviceType", { max: 160 }) || undefined,
          pmWork: formData.get("pmWork") === "true",
          emergencyResponse: formData.get("emergencyResponse") === "true",
          warrantyWork: formData.get("warrantyWork") === "true",
          afterHours: formData.get("afterHours") === "true",
          maximumJobAmountMinor: optionalMoneyMinor(formText(formData, "maximumJobAmount", { max: 30 })),
          requiredLicense: formText(formData, "requiredLicense", { max: 160 }) || undefined,
          requiredCertification: formText(formData, "requiredCertification", { max: 160 }) || undefined,
          effectiveAt: optionalIsoDate(formText(formData, "effectiveAt", { max: 40 })),
          expiresAt: optionalIsoDate(formText(formData, "expiresAt", { max: 40 })),
          actor: context.actor,
        },
      );
      return relativeRedirect303(`/app/vendors/${encodeURIComponent(vendorId)}?notice=Routing+qualification+added#compliance-evidence`);
    }

    throw new OpsDomainError("VALIDATION", "Vendor relationship operation is invalid");
  } catch (error) {
    return opsApiError(error);
  }
}
