"use client";
import { useCallback, useState } from "react";
import { SearchPicker } from "@/components/ops/search-picker";
import { storeVendorPickPage } from "@/components/ops/work-routing-fields";
import type { StoreVendorPage } from "@/lib/ops/store-vendors";

export function InternalResultFields({ problem = false, prefix = "", visit = false, lookAndReport = false }: { problem?: boolean; prefix?: string; visit?: boolean; lookAndReport?: boolean }) {
  const [value, setValue] = useState(problem ? "parts_required" : lookAndReport ? "return_visit_required" : "completed");
  const choices = (visit ? [["completed","Fixed"],["return_visit_required","Needs more work"],["parts_required","Need parts"],["diagnosis_only","Need help"],["quote_required","Needs an outside vendor"],["not_addressed","Cannot get to it today"]] : problem ? [["parts_required","Need parts"],["diagnosis_only","Need help"],["quote_required","Need a vendor"],["not_addressed","Cannot get to it today"]] : [["completed","Fixed"],["return_visit_required","Needs more work"],["quote_required","Needs an outside vendor"]]).filter(([id]) => !lookAndReport || id !== "completed");
  const blocker = problem || visit ? ({parts_required:"parts",diagnosis_only:"help",quote_required:"vendor",not_addressed:"cannot_today"} as Record<string,string>)[value] : value === "quote_required" ? "vendor" : "";
  return <>
    <label>{problem ? "What do you need?" : "How did it go?"}<select name={`${prefix}outcome`} value={value} onChange={event => setValue(event.target.value)}>{choices.map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label>
    <input type="hidden" name={`${prefix}blocker`} value={blocker ?? ""}/>
    <label>{value === "completed" ? "Notes (optional)" : value === "parts_required" ? "Which parts are needed?" : value === "diagnosis_only" ? "What help is needed?" : "What still needs to be done?"}<textarea name={`${prefix}notes`} rows={3} required={value !== "completed"} maxLength={3000}/></label>
    <label>Photos or files (optional)<input type="file" name={`${prefix}attachments`} multiple accept="image/jpeg,image/png,image/webp,application/pdf,text/plain"/><small>Up to 5 photos or files.</small></label>
  </>;
}

export function InternalVendorHandoffFields({storeId}:{storeId:string}) {
  const load=useCallback(async(query:string,signal:AbortSignal,cursor?:string)=>{
    const offset=Number(cursor??0),response=await fetch(`/api/ops/stores/${encodeURIComponent(storeId)}/vendors?${new URLSearchParams({q:query,offset:String(offset)})}`,{signal});
    if(!response.ok)throw new Error("Could not load vendors for this store.");
    return storeVendorPickPage(await response.json() as StoreVendorPage,offset);
  },[storeId]);
  return <><SearchPicker name="vendorId" label="Outside vendor" required options={[]} load={load} placeholder="Search by name or specialty"/><p>Pick the vendor. You&apos;ll review the work order before it is sent.</p></>;
}
