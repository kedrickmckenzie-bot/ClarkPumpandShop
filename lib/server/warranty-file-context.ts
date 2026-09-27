import { OpsDomainError } from "@/lib/ops/errors";
import { assertStoreInSessionScope } from "./ops-request-context";
import type { OpsRepository, OrganizationScope } from "@/lib/ops/repository";
import type { loadOperatorSession } from "@/app/app/_data/operator-loader";
export async function warrantyFileContext(repository:OpsRepository,session:Awaited<ReturnType<typeof loadOperatorSession>>,id:string) {
 const coverage=(await repository.listWarrantyDirectory(session as OrganizationScope,{today:new Date().toISOString().slice(0,10),view:"all",id,limit:1})).items[0];
 const item=coverage?null:await repository.getWarrantyCase(session.organizationId,id),work=item?await repository.getWorkOrder(session.organizationId,item.workOrderId):null;
 if(!coverage&&!work)throw new OpsDomainError("NOT_FOUND","Warranty not found");
 await assertStoreInSessionScope(session,coverage?.storeId??work!.storeId);
 return {coverage,item,back:coverage?`/app/warranties/coverage/${encodeURIComponent(id)}`:`/app/warranties/${encodeURIComponent(id)}`};
}
