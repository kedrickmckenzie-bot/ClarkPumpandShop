import { sessionHasNoStores } from "@/components/ops/role-policy";
import { getOpsRequestContext, formText, opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";
import { receiveEmail, resolveEmail } from "@/lib/ops/email-intake";
import { OpsDomainError } from "@/lib/ops/commands";
import { storeEmailFiles } from "@/lib/server/email-intake-ingress";

export async function POST(request: Request) {
  try {
    const context = await getOpsRequestContext(["facilities"],"create_request",request,true);
    if (context.session.storeIds !== undefined || context.session.regionIds !== undefined || sessionHasNoStores(context.session)) throw new OpsDomainError("FORBIDDEN","Companywide inbox access is required.");
    const form = await request.formData();
    const org = context.session.organizationId;
    if (form.get("emailId")) {
      const dismiss = form.get("action") === "dismiss";
      const workNumber = dismiss ? "" : formText(form,"workNumber",{max:100});
      const storeNumber = dismiss ? "" : formText(form,"storeNumber",{max:50});
      const works = workNumber ? (await context.repository.listWorkOrders({organizationId:org},{search:workNumber,limit:100})).items.filter(work => work.number.toLowerCase() === workNumber.toLowerCase()) : [];
      const stores = storeNumber ? (await context.repository.searchStores({organizationId:org},storeNumber,{limit:100})).items.filter(store => store.storeNumber === storeNumber) : [];
      if (workNumber && works.length !== 1 || storeNumber && stores.length !== 1) throw new OpsDomainError("VALIDATION","Enter an exact work order or store number.");
      const result = await resolveEmail({repository:context.repository},{organizationId:org,emailId:formText(form,"emailId",{required:true,max:100}),workOrderId:works[0]?.id,storeId:stores[0]?.id,dismiss,actor:context.actor});
      return relativeRedirect303(result?.workOrderId ? `/app/work-orders/${result.workOrderId}?notice=Email+added` : result?.requestId ? `/app/requests/${result.requestId}` : "/app/work-orders/inbox?notice=Email+reviewed");
    }
    const messageKey = formText(form,"messageKey",{required:true,max:300});
    const uploads = await Promise.all(form.getAll("attachments").filter((item): item is File => item instanceof File && item.size > 0).map(async file => ({name:file.name.slice(0,180),mediaType:file.type,size:file.size,bytes:await file.arrayBuffer()})));
    const files = await storeEmailFiles(org,messageKey,uploads,context.session.accessMode === "preview");
    await receiveEmail({repository:context.repository},{organizationId:org,messageKey,sender:formText(form,"sender",{required:true,max:254}),subject:formText(form,"subject",{required:true,max:300}),body:formText(form,"body",{required:true,max:30000}),reportedDate:formText(form,"reportedDate",{max:300}) || undefined,files});
    return relativeRedirect303("/app/work-orders/inbox?notice=Email+saved+for+review");
  } catch (error) { if (error instanceof OpsDomainError && ["VALIDATION","CONFLICT"].includes(error.code)) return relativeRedirect303(`/app/work-orders/inbox?error=${encodeURIComponent(error.message)}`); return opsApiError(error); }
}
