import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import { issueWorkOrderToVendor } from "@/lib/server/work-order-issuance";
import { offerResponseKey, resolveOfferedWork } from "@/lib/ops/optional-work-policy";
import { skipOfferedWork } from "@/lib/ops/commands";
import { OpsDomainError } from "@/lib/ops/errors";
import type { ServiceAuthorizationSnapshot } from "@/lib/ops/view-models";
import { opsApiError } from "@/lib/server/ops-request-context";
import { isWorkspaceOrigin } from "@/lib/server/request-origin";
async function capability(token:string) {
  if (!token || token.length > 200) throw new OpsDomainError("NOT_FOUND","Service link unavailable.");
  const repository=await getServerOpsRepository();
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token));
  const tokenHash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
  const view=await repository.getServiceAuthorizationByToken({tokenHash,purpose:"service_authorization",now:new Date().toISOString()});
  if (!view) throw new OpsDomainError("NOT_FOUND","Service link unavailable.");
  const issuance=await repository.getIssuance(view.organizationId,view.issuanceId);
  const snapshot=JSON.parse(issuance!.immutablePayloadJson) as ServiceAuthorizationSnapshot;
  return {repository,view,offered:snapshot.offeredWork ?? []};
}
export async function GET(request:Request) {
  try {
    const c=await capability(new URL(request.url).searchParams.get("token") ?? "");
    const rows=await Promise.all(c.offered.map(async job=>{
      const prior=await c.repository.getIdempotencyKey(c.view.organizationId,offerResponseKey(c.view.issuanceId,job.id));
      let unavailable:string|undefined;
      if (!prior) try { await resolveOfferedWork(c.repository,c.view.organizationId,c.view.issuanceId,job.id,c.view.vendor.id,new Date().toISOString()); } catch { unavailable="No longer available. Contact the operator."; }
      return {id:job.id,number:job.number,problem:job.problem,scope:job.scope,status:prior?.resultId ?? "offered",unavailable};
    }));
    return Response.json({rows},{headers:{"Cache-Control":"no-store"}});
  } catch(error) {return opsApiError(error);}
}
export async function POST(request:Request) {
  try {
    if (!isWorkspaceOrigin(request)) throw new OpsDomainError("FORBIDDEN","Open this action from your service link.");
    const body=await request.json() as {token:string;workId:string;decision:"accepted"|"skipped";name:string};
    if (!body || typeof body.token!=="string" || typeof body.workId!=="string" || !["accepted","skipped"].includes(body.decision) || typeof body.name!=="string" || !body.name.trim() || body.name.length>120) throw new OpsDomainError("VALIDATION","Enter your name and choose accept or skip.");
    const c=await capability(body.token); const now=new Date().toISOString();
    const result=await resolveOfferedWork(c.repository,c.view.organizationId,c.view.issuanceId,body.workId,c.view.vendor.id,now);
    if (result.prior) return Response.json({status:result.prior.resultId});
    const actor={actorType:"vendor_link" as const,actorName:body.name.trim(),organizationId:c.view.organizationId};
    if (body.decision==="accepted") {
      const latest=await c.repository.getLatestIssuanceForWorkOrder(c.view.organizationId,body.workId);
      await issueWorkOrderToVendor({repository:c.repository,organizationId:c.view.organizationId,organizationName:c.view.organizationName,workOrderId:body.workId,vendorId:c.view.vendor.id,expectedRevision:latest?.revision ?? 0,channel:"manual",message:result.offered.scope,actor,offerAcceptance:{issuanceId:c.view.issuanceId,responderName:body.name.trim()}});
    } else {
      await skipOfferedWork({repository:c.repository},{organizationId:c.view.organizationId,issuanceId:c.view.issuanceId,workOrderId:body.workId,vendorId:c.view.vendor.id,actor});
    }
    return Response.json({status:body.decision});
  } catch(error) {return opsApiError(error);}
}
