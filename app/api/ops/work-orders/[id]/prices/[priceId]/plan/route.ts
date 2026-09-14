import { NextResponse } from "next/server";
import { applyWorkPricePlan } from "@/lib/ops/work-price-planning";
import { OpsDomainError } from "@/lib/ops/commands";
import { getOpsRequestContext, formText, opsApiError } from "@/lib/server/ops-request-context";
export async function POST(request:Request,{params}:{params:Promise<{id:string;priceId:string}>}) {
  try {
    const context=await getOpsRequestContext(["facilities"], undefined, request, true);const {id,priceId}=await params;
    const price=await context.repository.getWorkPrice(context.session.organizationId,priceId);
    if(!price || price.workOrderId!==id)throw new OpsDomainError("NOT_FOUND","Price not found.");
    const form=await request.formData(); const signature=formText(form,"signature",{required:true,max:64});
    const result=await applyWorkPricePlan({repository:context.repository},{organizationId:context.session.organizationId,priceId,signature,actor:context.actor});
    return NextResponse.json({ok:true,id:result});
  }catch(error){return opsApiError(error);}
}
