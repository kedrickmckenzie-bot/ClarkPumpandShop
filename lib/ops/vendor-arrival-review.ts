import { OpsDomainError, type OpsCommandServices } from "./commands";
import { communicationAudit, insertRecord } from "./email-intake";
import type { ActorContext } from "./types";
export const ARRIVAL_TRADES: Record<string,string> = { refrigeration:"Refrigeration", hvac:"HVAC", plumbing:"Plumbing", electrical:"Electrical", foodservice:"Foodservice equipment", fuel:"Fuel systems", exterior:"Exterior and grounds", roofing:"Roofing", other:"Other services" };
export async function approveArrivingVendor(svc:OpsCommandServices,input:{organizationId:string;vendorId:string;storeId:string;trade:string;name:string;email:string;phone?:string;actor:ActorContext}) {
 if(input.actor.organizationId!==input.organizationId)throw new OpsDomainError("FORBIDDEN","Organization access required");
 const vendor=await svc.repository.getVendor(input.organizationId,input.vendorId),store=await svc.repository.getStore(input.organizationId,input.storeId);
 if(!vendor||!store)throw new OpsDomainError("NOT_FOUND","Vendor or store not found");
 if(!vendor.code.startsWith("vendor-arrival-")||vendor.status!=="restricted")throw new OpsDomainError("CONFLICT","This vendor is not awaiting arrival review");
 if(!ARRIVAL_TRADES[input.trade]||!input.name.trim()||input.name.length>160||!/^\S+@\S+\.\S+$/.test(input.email)||input.email.length>254||(input.phone?.length??0)>60)throw new OpsDomainError("VALIDATION","Check the company name, email and service area");
 const now=svc.clock?.now()??new Date().toISOString();
 await svc.repository.atomicWrite([
 {sql:"UPDATE ops_vendors SET name = ?, dispatch_email = ?, dispatch_phone = ?, status = ?, search_text = ? WHERE organization_id = ? AND id = ? AND status = ?",params:[input.name.trim(),input.email.trim(),input.phone??null,"approved",`${input.name} ${ARRIVAL_TRADES[input.trade]}`.toLowerCase(),input.organizationId,vendor.id,"restricted"]},
 insertRecord("ops_vendor_specialties",{id:`specialty-${vendor.id}`,organization_id:input.organizationId,vendor_id:vendor.id,canonical_key:input.trade,display_name:ARRIVAL_TRADES[input.trade],search_aliases_json:"[]"}),
 insertRecord("ops_vendor_coverage",{id:`coverage-${vendor.id}`,organization_id:input.organizationId,vendor_id:vendor.id,scope_kind:"store",scope_id:store.id}),
 communicationAudit(input.organizationId,vendor.id,"vendor.arrival_review_approved",input.actor,now,{before:vendor,after:{name:input.name,email:input.email,phone:input.phone,status:"approved",storeId:store.id,trade:input.trade}},"vendor"),
 ]);
}
