import {safeCapitalReturn} from "@/lib/ops/review-navigation";
import {saveCapitalPlan,type CapitalPlan} from "@/lib/ops/capital-planning";
import {OpsDomainError} from "@/lib/ops/commands";
import {getOpsRequestContext,assertStoreInSessionScope,formText,optionalMoneyMinor,opsApiError} from "@/lib/server/ops-request-context";
export async function POST(request:Request) {
 try {const {session,repository,actor}=await getOpsRequestContext(["facilities","regional"],undefined,request),form=await request.formData();
 const assetId=formText(form,"assetId",{required:true,max:120}),asset=await repository.getAsset(session.organizationId,assetId);
 if(!asset)throw new OpsDomainError("NOT_FOUND","Equipment was not found.");await assertStoreInSessionScope(session,asset.storeId);
 await saveCapitalPlan({repository},{organizationId:session.organizationId,assetId,version:Number(formText(form,"version",{required:true})),targetMonth:formText(form,"targetMonth")||undefined,amountMinor:optionalMoneyMinor(formText(form,"amount")),currency:formText(form,"currency"),sourceId:formText(form,"sourceId")||undefined,priority:formText(form,"priority") as CapitalPlan["priority"],owner:formText(form,"owner"),reason:formText(form,"reason"),status:formText(form,"status") as CapitalPlan["status"],actor});
 return Response.json({ok:true,redirectTo:safeCapitalReturn(formText(form,"returnTo"))});
 }catch(error){return opsApiError(error);}
}
