import type { OpsRepository, OrganizationScope } from "./repository";
import { invoiceReporting } from "./invoice-reporting";

export interface WorkCostPrompt { id:string; title:string; detail:string; action:string; href:string; }
const money = (amountMinor:number,currency:string) => new Intl.NumberFormat("en-US",{style:"currency",currency}).format(amountMinor/100);

export async function loadWorkCostPrompts(repository:OpsRepository,scope:OrganizationScope,workId:string,now:string):Promise<WorkCostPrompt[]> {
  const work = await repository.getWorkOrderDetail(scope,workId);
  if (!work) return [];
  const org = scope.organizationId;
  const from = new Date(Date.parse(now)-180*86400000).toISOString();
  const [warranty,peers,held,authorizations,invoices] = await Promise.all([
    work.asset ? repository.getAssetWarrantySources(org,work.asset.id) : undefined,
    work.asset ? repository.listWorkOrders(scope,{storeId:work.storeId,assetId:work.asset.id,componentId:work.component?.id,createdFrom:`${from.slice(0,10)}T00:00:00.000Z`,createdTo:`${now.slice(0,10)}T23:59:59.999Z`,limit:6}) : undefined,
    repository.listWorkOrders(scope,{storeId:work.storeId,heldOnly:true,limit:6}),
    repository.listAuthorizationsForWorkOrder(org,workId),repository.getWorkOrderInvoiceSources(org,workId),
  ]);
  const prompts:WorkCostPrompt[] = [];
  const base = `/app/work-orders/${workId}`;
  const day = now.slice(0,10);
  const covered = warranty?.manufacturerWarranties.some(row => (!work.component || !row.componentId || row.componentId === work.component.id) && row.startDate.slice(0,10) <= day && row.expirationDate.slice(0,10) >= day)
    || warranty?.appliedWarranties.some(row => row.startDate.slice(0,10) <= day && row.endDate.slice(0,10) >= day && warranty.repairItems.some(repair => repair.id === row.repairItemId && (!work.component || repair.componentId === work.component.id)))
    || work.asset?.warrantyEndsAt && work.asset.warrantyEndsAt.slice(0,10) >= day;
  if (covered) prompts.push({id:"warranty",title:"Check warranty before authorizing repair",detail:"A recorded warranty term is current. Confirm coverage for this problem.",action:"Review warranty",href:`${base}#work-warranty`});
  const related = peers?.items.filter(row => row.id !== workId && row.status !== "cancelled") ?? [];
  if (related.length >= 2) prompts.push({id:"repeat",title:`${related.length}${peers?.nextCursor ? "+" : ""} other recent jobs on this equipment`,detail:"Past 180 days · Review the problem and repair history before another callout.",action:"Review history",href:`/app/work-orders?${new URLSearchParams({store:work.storeId,asset:work.asset!.id,createdFrom:from.slice(0,10),createdThrough:now.slice(0,10),...(work.component ? {component:work.component.id} : {})})}`});
  const otherHeld = held.items.filter(row => row.id !== workId);
  if (otherHeld.length) prompts.push({id:"combine",title:"Other approved work at this store",detail:`${otherHeld.length}${held.nextCursor ? "+" : ""} ${otherHeld.length === 1 && !held.nextCursor ? "job" : "jobs"} held for a suitable visit. Check trade and vendor eligibility.`,action:"Review work",href:`/app/work-orders?store=${work.storeId}&visitPlan=ready`});
  const superseded = new Set(authorizations.flatMap(row => row.supersedesAuthorizationId ? [row.supersedesAuthorizationId] : []));
  const active = authorizations.filter(row => !superseded.has(row.id));
  const allocations = invoiceReporting(invoices,org).allocations.filter(row => row.workOrderId === workId);
  const currencies = [...new Set(allocations.map(row => row.amount.currency))];
  for (const currency of currencies) {
    const matching = active.filter(row => row.authorizedAmount.currency === currency);
    const approved = matching.length ? matching.reduce((sum,row) => sum+row.authorizedAmount.amountMinor,0) : undefined;
    const linked = allocations.filter(row => row.amount.currency === currency);
    const total = linked.reduce((sum,row) => sum+row.amount.amountMinor,0);
    const limit = approved ?? (work.nte?.currency === currency ? work.nte.amountMinor : undefined);
    if (limit !== undefined && total > limit) prompts.push({id:`amount-${currency}`,title:`Linked invoice amount exceeds ${approved === undefined ? "the NTE limit" : "approved amount"}`,detail:`${money(total,currency)} linked · ${money(limit,currency)} ${approved === undefined ? "limit" : "approved"}. Review scope and changes.`,action:"Review invoice",href:linked[0].href});
  }
  return prompts;
}
