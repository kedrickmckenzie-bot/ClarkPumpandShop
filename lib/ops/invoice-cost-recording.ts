import type { OpsRepository, OpsStatement } from "./repository";
import type { ActorContext, WorkOrder } from "./types";
import type { WorkOrderDetailView } from "./view-models";
import { OpsDomainError } from "./errors";

type Cost = WorkOrderDetailView["costs"][number];
export function unmatchedCostGroups(costs: Cost[], vendorId: string) {
  const reversed = new Set(costs.map(c=>c.reversesCostId).filter(Boolean));
  const groups = new Map<string,Cost[]>();
  for (const cost of costs) {
    if (cost.invoiceId || cost.reversesCostId || reversed.has(cost.id) || cost.providerType === "internal" || cost.vendorId && cost.vendorId !== vendorId) continue;
    const key = cost.costGroupId ?? "legacy";
    groups.set(key,[...(groups.get(key) ?? []),cost]);
  }
  return [...groups].map(([id,rows])=>({id,rows,amountMinor:rows.reduce((sum,c)=>sum+c.amountMinor,0),currency:rows[0].currency,knownVendor:rows.every(c=>c.providerType === "vendor" && c.vendorId === vendorId),sameCurrency:rows.every(c=>c.currency === rows[0].currency)}));
}
function insert(table:string,values:Record<string,unknown>):OpsStatement {const entries=Object.entries(values).filter(([,v])=>v!==undefined);return {sql:`INSERT INTO ${table} (${entries.map(([k])=>k).join(", ")}) VALUES (${entries.map(()=>"?").join(", ")})`,params:entries.map(([,v])=>v)};}
export async function invoiceCostPlan(repository:OpsRepository,input:{organizationId:string;work:WorkOrder;invoiceId:string;vendorId:string;number:string;amountMinor:number;currency:string;date:string;now:string;actor:ActorContext;choice?:string;lines?:Array<{description:string;amountMinor:number}>}) {
  const costs=(await repository.getWorkOrderDetail({organizationId:input.organizationId},input.work.id))?.costs ?? [];
  if(costs.some(c=>c.invoiceId===input.invoiceId)) return {needsReview:false,statements:[] as OpsStatement[],groups:[] as ReturnType<typeof unmatchedCostGroups>};
  const groups=unmatchedCostGroups(costs,input.vendorId);
  const exact=groups.length===1 && groups[0].knownVendor && groups[0].sameCurrency && groups[0].currency===input.currency && groups[0].amountMinor===input.amountMinor ? groups[0] : undefined;
  const selected=input.choice && input.choice!=="new" ? groups.find(g=>g.id===input.choice) : !input.choice ? exact : undefined;
  if(input.choice && input.choice!=="new" && !selected) throw new OpsDomainError("CONFLICT","The earlier cost changed. Refresh and choose it again.");
  if(selected && (!selected.sameCurrency || selected.currency!==input.currency)) throw new OpsDomainError("VALIDATION","These costs use different currencies. Record the invoice separately.");
  if(groups.length && !selected && input.choice!=="new")return {needsReview:true,statements:[] as OpsStatement[],groups};
  const statements:OpsStatement[]=[];
  for(const row of selected?.rows ?? []) {
    statements.push({sql:"UPDATE ops_cost_lines SET invoice_id = ? WHERE organization_id = ? AND id = ?",params:[input.invoiceId,input.organizationId,row.id]});
    if(selected!.amountMinor!==input.amountMinor) statements.push(insert("ops_cost_lines",{id:`cost-reversal-${input.invoiceId}-${row.id}`,organization_id:input.organizationId,work_order_id:input.work.id,kind:row.kind,description:`Replaced by invoice ${input.number}: ${row.description}`,amount_minor:-row.amountMinor,currency:row.currency,service_date:row.serviceDate,recorded_at:input.now,provider_type:row.providerType,vendor_id:row.vendorId,invoice_id:input.invoiceId,cost_group_id:row.costGroupId,reverses_cost_id:row.id}));
  }
  if(!selected || selected.amountMinor!==input.amountMinor) {
    const lines=input.lines ?? (await repository.listInvoiceLines(input.organizationId,input.invoiceId)).map(line=>({description:line.description,amountMinor:line.lineAmount.amountMinor}));
    const entries=lines.length ? lines : [{description:`Invoice ${input.number}`,amountMinor:input.amountMinor}];
    if(entries.some(line=>!Number.isSafeInteger(line.amountMinor) || line.amountMinor<0) || entries.reduce((sum,line)=>sum+line.amountMinor,0)!==input.amountMinor) throw new OpsDomainError("VALIDATION","Invoice line items must add up to the invoice total.");
    entries.forEach((line,index)=>statements.push(insert("ops_cost_lines",{id:`cost-invoice-${input.invoiceId}${index ? `-${index}` : ""}`,organization_id:input.organizationId,work_order_id:input.work.id,kind:"other",description:line.description,amount_minor:line.amountMinor,currency:input.currency,service_date:selected?.rows[0].serviceDate ?? input.date,recorded_at:input.now,provider_type:"vendor",vendor_id:input.vendorId,invoice_id:input.invoiceId,cost_group_id:`cost-invoice-${input.invoiceId}`})));
  }
  const payloadJson=JSON.stringify({invoiceId:input.invoiceId,workOrderId:input.work.id,costBasis:"recorded_work_cost",source:"vendor_invoice",amountMinor:input.amountMinor,currency:input.currency,matchedCostIds:selected?.rows.map(c=>c.id) ?? [],choice:input.choice ?? (exact?"exact_vendor_amount":"no_prior_cost"),paymentExecuted:false});
  statements.push(insert("ops_audit_events",{id:`audit-cost-${input.invoiceId}`,organization_id:input.organizationId,aggregate_type:"work_order",aggregate_id:input.work.id,event_type:"work_order.invoice_cost_recorded",actor_type:input.actor.actorType,actor_id:input.actor.actorId,actor_name:input.actor.actorName,occurred_at:input.now,payload_json:payloadJson}),insert("ops_outbox_messages",{id:`outbox-cost-${input.invoiceId}`,organization_id:input.organizationId,topic:"ops.work_order.invoice_cost_recorded",aggregate_type:"work_order",aggregate_id:input.work.id,payload_json:payloadJson,status:"pending",available_at:input.now,created_at:input.now,attempt_count:0}));
  return {needsReview:false,statements,groups};
}
export async function invoiceWork(repository:OpsRepository,organizationId:string,invoiceId:string) {
 const invoice=await repository.getInvoice(organizationId,invoiceId);
 const lines=await repository.listInvoiceLines(organizationId,invoiceId);
 if(!invoice || invoice.status === "void" || !lines.length || lines.some(l=>l.lineAmount.currency!==invoice.total.currency) || lines.reduce((sum,l)=>sum+l.lineAmount.amountMinor,0)!==invoice.total.amountMinor)return null;
 const allocations=(await Promise.all(lines.map(l=>repository.listInvoiceLineAllocations(organizationId,l.id)))).flat();
 const ids=[...new Set(allocations.map(a=>a.workOrderId))];
 if(ids.length!==1 || allocations.some(a=>a.amount.currency!==invoice.total.currency) || lines.some(l=>allocations.filter(a=>a.invoiceLineId===l.id).reduce((sum,a)=>sum+a.amount.amountMinor,0)!==l.lineAmount.amountMinor))return null;
 return repository.getWorkOrder(organizationId,ids[0]);
}
