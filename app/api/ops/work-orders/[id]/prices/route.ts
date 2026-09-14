import { NextResponse } from "next/server";
import { recordWorkPrice } from "@/lib/ops/work-price-commands";
import { OpsDomainError } from "@/lib/ops/commands";
import { getOpsRequestContext, assertStoreInSessionScope, formText, optionalMoneyMinor, opsApiError } from "@/lib/server/ops-request-context";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
  try {
    const context = await getOpsRequestContext(["facilities","regional"], undefined, request);
    const {id} = await params; const work = await context.repository.getWorkOrder(context.session.organizationId,id);
    if (!work) throw new OpsDomainError("NOT_FOUND","Work order not found.");
    await assertStoreInSessionScope(context.session,work.storeId);
    const form = await request.formData(); const amount = optionalMoneyMinor(formText(form,"amount",{required:true,max:25}));
    const kind = formText(form,"kind"), scopeKind = formText(form,"scopeKind");
    if (amount === undefined || kind !== "repair" && kind !== "replace" || !["whole","part","job"].includes(scopeKind)) throw new OpsDomainError("VALIDATION","Check the price.");
    const price = await recordWorkPrice({repository:context.repository},{organizationId:context.session.organizationId,workOrderId:id,
      vendorId:formText(form,"vendorId",{required:true,max:160}),kind,scopeKind:scopeKind as "whole"|"part"|"job",amountMinor:amount,
      currency:formText(form,"currency",{required:true,max:3}).toUpperCase(),scope:formText(form,"scope",{required:true,max:2000}),
      expectedVersion:Number(formText(form,"expectedVersion",{required:true,max:15})),submissionKey:formText(form,"submissionKey",{required:true,max:160}),actor:context.actor});
    return NextResponse.json({ok:true,id:price.id});
  } catch(error) { return opsApiError(error); }
}
