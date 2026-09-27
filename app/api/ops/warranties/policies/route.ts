import { OpsDomainError } from "@/lib/ops/errors";
import { createFutureWarrantyRule,ensureVendorWarrantyProfile,retireStoreWarrantyPolicy,type FutureWarrantyCoverageInput } from "@/lib/ops/warranty-commands";
import { assertStoreInSessionScope,formText,getOpsRequestContext,opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";
export async function POST(request:Request){try{
 const form=await request.formData();
 const context=await getOpsRequestContext(["executive","facilities","regional"],undefined,request,!formText(form,"storeId"));
 const vendorId=formText(form,"vendorId",{required:true,max:160}),storeId=formText(form,"storeId",{max:160})||undefined,mode=formText(form,"mode"),ruleId=formText(form,"ruleId",{max:160})||undefined;
 if(storeId)await assertStoreInSessionScope(context.session,storeId);else if(context.session.role==="regional")throw new OpsDomainError("FORBIDDEN","Company rules require facilities access");
 if(!["custom","exclude","inherit"].includes(mode)||mode!=="custom"&&!storeId)throw new OpsDomainError("VALIDATION","Choose a valid policy");
 const reason=formText(form,"reason",{required:true,max:2000}),common={organizationId:context.session.organizationId,vendorId,actor:context.actor};
 const href=`/app/warranties/rules?vendor=${encodeURIComponent(vendorId)}${storeId?`&store=${encodeURIComponent(storeId)}`:""}`;
 if(mode==="inherit"){if(!ruleId||!storeId)throw new OpsDomainError("VALIDATION","Choose an existing store exception");await retireStoreWarrantyPolicy({...common,storeId,ruleId,reason},{repository:context.repository});return relativeRedirect303(href);}
 const date=formText(form,"effectiveStart",{required:true,max:10});if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date<new Date().toISOString().slice(0,10))throw new OpsDomainError("VALIDATION","Enter a valid start date");
 const coverages:FutureWarrantyCoverageInput[]=[];
 for(const coverageType of ["labor","part","travel","diagnostic"] as const){const raw=formText(form,coverageType+"Duration");if(mode==="exclude")continue;const duration=raw?Number(raw):0;if(!Number.isInteger(duration)||duration<0||duration>36500)throw new OpsDomainError("VALIDATION","Coverage days must be between 1 and 36,500");coverages.push({coverageType,duration,durationUnit:"days",startEvent:"repair_completion",provider:"vendor",obligatedVendorId:vendorId,routingRule:"original_vendor_first_right_to_cure",deductible:{amountMinor:0,currency:"USD"},conditions:formText(form,"terms",{max:3000})||undefined});}
 if(mode==="custom"&&!coverages.some(c=>c.duration>0))throw new OpsDomainError("VALIDATION","Enter at least one coverage duration");
 const profiles=await context.repository.listVendorWarrantyProfiles(common.organizationId,vendorId);const profile=profiles.find(p=>p.status==="active")??await ensureVendorWarrantyProfile(common,{repository:context.repository});
 await createFutureWarrantyRule({...common,vendorWarrantyProfileId:profile.id,selectors:{storeId},supersedesId:ruleId,excludeCoverage:mode==="exclude",priority:0,effectiveStartsAt:date+"T00:00:00.000Z",coverages,reason},{repository:context.repository});
 return relativeRedirect303(href);
}catch(error){return opsApiError(error);}}
