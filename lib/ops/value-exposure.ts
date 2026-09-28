import type { ValueEvent } from "./types";
/** Findings on the same invoice line overlap; use the largest flagged amount once. */
export function uniqueExposureTotal(events: Pick<ValueEvent,"id"|"organizationId"|"invoiceLineId"|"amount">[]) {
 const totals=new Map<string,number>();
 for(const e of events){const key=`${e.organizationId}:${e.amount.currency}:${e.invoiceLineId??e.id}`;totals.set(key,Math.max(totals.get(key)??0,e.amount.amountMinor));}
 return [...totals.values()].reduce((a,b)=>a+b,0);
}
