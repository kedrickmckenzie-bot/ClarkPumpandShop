import { OpsDomainError } from "@/lib/ops/errors";
import { createFutureWarrantyRule,type FutureWarrantyCoverageInput } from "@/lib/ops/warranty-commands";
import type { WarrantyRoutingRule } from "@/lib/ops/types";
import { formText,getOpsRequestContext,opsApiError,optionalMoneyMinor } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

const routingRules=new Set<WarrantyRoutingRule>(["original_vendor_mandatory","original_vendor_first_right_to_cure","manufacturer_authorized_provider","any_approved_provider","manual_review"]);

export async function POST(request:Request){
  try{
    const context=await getOpsRequestContext(["executive","facilities"]);const form=await request.formData();
    const profileId=formText(form,"profileId",{required:true,max:160});const profile=await context.repository.getVendorWarrantyProfile(context.session.organizationId,profileId);
    if(!profile||profile.status!=="active")throw new OpsDomainError("NOT_FOUND","Active Vendor Warranty Profile not found");
    const coverages:FutureWarrantyCoverageInput[]=[];
    for(const coverageType of ["labor","part","travel","diagnostic"] as const){
      const raw=formText(form,`${coverageType}Duration`);if(!raw)continue;const duration=Number(raw);
      if(!Number.isInteger(duration)||duration<0)throw new OpsDomainError("VALIDATION",`${coverageType} duration must be a non-negative whole number`);
      const routingRule=formText(form,`${coverageType}Routing`,{required:true}) as WarrantyRoutingRule;if(!routingRules.has(routingRule))throw new OpsDomainError("VALIDATION",`${coverageType} routing is invalid`);
      coverages.push({coverageType,duration,durationUnit:"days",startEvent:"repair_completion",provider:"vendor",obligatedVendorId:profile.vendorId,routingRule,deductible:{amountMinor:optionalMoneyMinor(formText(form,`${coverageType}Deductible`))??0,currency:"USD"}});
    }
    const effectiveStart=formText(form,"effectiveStart",{required:true});const effectiveEnd=formText(form,"effectiveEnd");
    const result=await createFutureWarrantyRule({organizationId:context.session.organizationId,vendorId:profile.vendorId,vendorWarrantyProfileId:profile.id,actor:context.actor,priority:Number(formText(form,"priority",{required:true})),effectiveStartsAt:`${effectiveStart}T00:00:00.000Z`,effectiveEndsAt:effectiveEnd?`${effectiveEnd}T23:59:59.999Z`:undefined,selectors:{tradeKey:formText(form,"tradeKey",{max:120})||undefined,workType:formText(form,"workType",{max:160})||undefined,assetType:formText(form,"assetType",{max:160})||undefined,componentType:formText(form,"componentType",{max:160})||undefined},coverages,reason:formText(form,"reason",{required:true,max:2000})},{repository:context.repository});
    return relativeRedirect303(`/app/warranties?createdRule=${encodeURIComponent(result.rule.id)}`);
  }catch(error){return opsApiError(error)}
}
