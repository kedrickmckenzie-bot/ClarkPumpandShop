import { updateVendorCoverage } from "@/lib/ops/vendor-coverage";
import { getQuoteUploadStore } from "@/components/ops-public/server-file-store";
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
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

const documentTypes = new Set(["insurance", "license", "certification", "tax", "safety", "other"] as const);
const reviewStatuses = new Set(["pending", "approved", "rejected", "expired"] as const);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getOpsRequestContext(["facilities"], undefined, request, true);
    const { id: vendorId } = await params;
    const vendor = await context.repository.getVendor(context.session.organizationId, vendorId);
    if (!vendor) throw new OpsDomainError("NOT_FOUND", "Vendor not found in organization");
    const formData = await request.formData();
    const operation = formText(formData, "operation", { required: true, max: 40 });

    if (operation === "update_coverage") {
      if (context.session.storeIds !== undefined || context.session.regionIds !== undefined) throw new OpsDomainError("FORBIDDEN", "Company access is required to edit coverage.");
      const values = formData.getAll("coverageScopeIds");
      if (values.some(value => typeof value !== "string")) throw new OpsDomainError("VALIDATION", "Choose valid coverage areas.");
      await updateVendorCoverage({ repository: context.repository }, {
        organizationId: context.session.organizationId, vendorId,
        scopeIds: values as string[], expectedVersion: formText(formData, "coverageVersion", { max: 20000 }), actor: context.actor,
      });
      return relativeRedirect303(`/app/vendors/${encodeURIComponent(vendorId)}?notice=Coverage+updated&tab=contact#coverage-evidence`);
    }

    if (operation === "record_compliance") {
      const documentType = formText(formData, "documentType", { required: true, max: 40 }) as "insurance" | "license" | "certification" | "tax" | "safety" | "other";
      const reviewStatus = formText(formData, "reviewStatus", { required: true, max: 40 }) as "pending" | "approved" | "rejected" | "expired";
      if (!documentTypes.has(documentType)) throw new OpsDomainError("VALIDATION", "Document type is invalid");
      if (!reviewStatuses.has(reviewStatus)) throw new OpsDomainError("VALIDATION", "Review status is invalid");
      const attachment=formData.get("attachment");
      let file;
      if(attachment instanceof File&&attachment.size) {
        if(attachment.size>8*1024*1024||!["application/pdf","image/jpeg","image/png","image/webp","text/plain"].includes(attachment.type))throw new OpsDomainError("VALIDATION","Choose a PDF, JPG, PNG, WebP or text file up to 8 MB.");
        const [stored]=await getQuoteUploadStore(context.session.accessMode==="preview").store({organizationId:context.session.organizationId,subjectType:"vendor_document",subjectId:vendorId,uploads:[{name:attachment.name.slice(0,180),mediaType:attachment.type,size:attachment.size,bytes:await attachment.arrayBuffer()}]});
        if(!stored?.stored)throw new OpsDomainError("VALIDATION","The document could not be saved. Please try again.");
        file={id:`file-${crypto.randomUUID()}`,organizationId:context.session.organizationId,storageKey:stored.key,sha256:stored.sha256,originalName:stored.originalName,contentType:stored.mediaType,byteLength:stored.size,status:"available" as const,createdAt:new Date().toISOString()};
      }
      await recordVendorComplianceDocument(
        { repository: context.repository },
        {
          organizationId: context.session.organizationId,
          vendorId,
          documentType,
          file,
          issuer: formText(formData, "issuer", { max: 160 }) || undefined,
          reference: formText(formData, "reference", { required: true, max: 200 }),
          effectiveAt: optionalIsoDate(formText(formData, "effectiveAt", { max: 40 })),
          expiresAt: optionalIsoDate(formText(formData, "expiresAt", { max: 40 })),
          reviewStatus,
          blocking: formData.get("blocking") === "true",
          actor: context.actor,
        },
      );
      return relativeRedirect303(`/app/vendors/${encodeURIComponent(vendorId)}?notice=Compliance+record+added&tab=documents#compliance-evidence`);
    }

    if (operation === "record_qualification") {
      const tradeKey = formText(formData, "tradeKey", { required: true, max: 120 });
      const approvedTradeKeys = new Set((await context.repository.listVendorSpecialties(context.session.organizationId, vendorId))
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
      return relativeRedirect303(`/app/vendors/${encodeURIComponent(vendorId)}?notice=Routing+qualification+added&tab=documents#compliance-evidence`);
    }

    throw new OpsDomainError("VALIDATION", "Vendor relationship operation is invalid");
  } catch (error) {
    return opsApiError(error);
  }
}
