import { getOpsRequestContext, opsApiError, assertStoreInSessionScope } from "@/lib/server/ops-request-context";
import { OpsDomainError } from "@/lib/ops/errors";
export async function GET(request:Request) {
  try {
    const {session,repository}=await getOpsRequestContext(["executive","facilities","regional","store_manager","finance"],undefined,request);
    const query=new URL(request.url).searchParams, assetId=query.get("asset")??"", componentId=query.get("component")||undefined;
    const asset=await repository.getAsset(session.organizationId,assetId);
    if(!asset) throw new OpsDomainError("NOT_FOUND","Equipment not found");
    await assertStoreInSessionScope(session,asset.storeId);
    if(componentId && (await repository.getComponent(session.organizationId,componentId))?.assetId!==assetId) throw new OpsDomainError("VALIDATION","Component does not belong to this equipment");
    const result=await repository.listWarrantyDirectory(session,{today:new Date().toISOString().slice(0,10),view:"active",assetId,componentId,limit:25});
    return Response.json({count:result.totalCount,items:result.items.map(c=>({id:c.id,provider:c.provider,end:c.end,component:c.component}))},{headers:{"Cache-Control":"no-store"}});
  } catch(error) { return opsApiError(error); }
}
