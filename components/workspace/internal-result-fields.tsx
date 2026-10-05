"use client";
import { useCallback, useId, useState } from "react";
import { SearchPicker } from "@/components/ops/search-picker";
import { storeVendorPickPage } from "@/components/ops/work-routing-fields";
import type { StoreVendorPage } from "@/lib/ops/store-vendors";
import { checkoutChoices, type CheckoutMode } from "@/lib/ops/checkout-choices";

export function InternalResultFields({ problem = false, prefix = "", visit = false, lookAndReport = false, ai }: { problem?: boolean; prefix?: string; visit?: boolean; lookAndReport?: boolean; /** Shows "Fill it in for me" when AI help is turned on for this job. */ ai?: { workOrderId: string } }) {
  const mode: CheckoutMode = visit ? "visit" : problem ? "problem" : "job";
  const [value, setValue] = useState<string>(problem ? "parts_required" : lookAndReport ? "return_visit_required" : "completed");
  const [notes, setNotes] = useState(""), [working, setWorking] = useState("");
  const choices = checkoutChoices(mode, lookAndReport);
  const blocker = problem || visit ? ({parts_required:"parts",diagnosis_only:"help",quote_required:"vendor",not_addressed:"cannot_today"} as Record<string,string>)[value] : value === "quote_required" ? "vendor" : "";
  return <>
    {ai ? <AiCheckoutHelper workOrderId={ai.workOrderId} mode={mode} lookAndReport={lookAndReport} onDraft={draft => { setValue(draft.outcome); setNotes(draft.notes); if (!problem && draft.workingWhenLeft !== "unknown") setWorking(draft.workingWhenLeft); }}/> : null}
    <fieldset><legend>{problem ? "What do you need?" : "How did it go?"}</legend><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:8}}>{choices.map(([id,label])=><label key={id} style={{display:"flex",alignItems:"center",gap:10,minHeight:48,border:"1px solid #c7d2e2",borderRadius:5,padding:12,background:value===id?"#edf3ff":"white"}}><input style={{width:20,height:20,minWidth:20,minHeight:20,flex:"0 0 20px",padding:0}} type="radio" name={`${prefix}outcome`} value={id} checked={value===id} onChange={()=>setValue(id)}/>{label}</label>)}</div></fieldset>
    <input type="hidden" name={`${prefix}blocker`} value={blocker ?? ""}/>
    <label>{value === "completed" ? "Notes (optional)" : value === "parts_required" ? "Which parts are needed?" : value === "diagnosis_only" ? "What help is needed?" : "What still needs to be done?"}<textarea name={`${prefix}notes`} rows={3} required={value !== "completed"} maxLength={2900} value={notes} onChange={event => setNotes(event.target.value)}/></label>
    {!problem?<label>Quick check: working when I left?<select name={`${prefix}workingWhenLeft`} value={working} onChange={event => setWorking(event.target.value)} required><option value="" disabled>Choose</option><option value="yes">Yes</option><option value="no">No</option><option value="not_checked">Could not check</option></select></label>:null}
    <label>Photos or files (optional)<input type="file" name={`${prefix}attachments`} multiple accept="image/jpeg,image/png,image/webp,application/pdf,text/plain"/><small>Up to 5 photos or files.</small></label>
  </>;
}

type CheckoutDraft = { outcome: string; notes: string; workingWhenLeft: string; question: string };
/** The tech says what happened in their own words; the AI fills the form below for them to check. Nothing is saved until they submit. */
function AiCheckoutHelper({ workOrderId, mode, lookAndReport, onDraft }: { workOrderId: string; mode: CheckoutMode; lookAndReport: boolean; onDraft: (draft: CheckoutDraft) => void }) {
  const helpId = useId();
  const [text, setText] = useState(""), [state, setState] = useState<"idle" | "working" | "done" | "error">("idle"), [message, setMessage] = useState("");
  async function fill() {
    if (state === "working") return;
    setState("working"); setMessage("");
    try {
      const response = await fetch("/api/ops/ai/checkout-draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workOrderId, description: text, mode, lookAndReport }) });
      const result = await response.json() as { draft?: CheckoutDraft; error?: string };
      if (!response.ok || !result.draft) throw new Error(result.error ?? "The AI couldn't fill this in. Please fill the form in yourself.");
      onDraft(result.draft);
      setState("done");
      setMessage(result.draft.question ? result.draft.question : "");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "The AI couldn't fill this in. Please fill the form in yourself.");
    }
  }
  return <div style={{display:"grid",gap:10,padding:14,border:"1px solid #c9d7f5",borderRadius:6,background:"#f5f8ff"}}>
    <label style={{display:"grid",gap:6,fontWeight:600}}>
      Tell us what you did
      <textarea rows={3} maxLength={4000} value={text} onChange={event => setText(event.target.value)} aria-describedby={helpId} placeholder="For example: replaced the condenser fan motor, cooler is back to 36"/>
    </label>
    <small id={helpId} style={{marginTop:-4,color:"#52627a"}}>Type, or tap your keyboard&apos;s microphone to talk. We&apos;ll fill in the form below for you to check.</small>
    <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"center"}}>
      <button type="button" onClick={() => void fill()} disabled={state === "working" || text.trim().length < 3} style={{minHeight:44,padding:"8px 16px",borderRadius:5,border:"1px solid #2457d6",background:"#2457d6",color:"white",fontWeight:600}}>{state === "working" ? "Filling it in…" : state === "done" ? "Fill it in again" : "Fill it in for me"}</button>
      {state === "done" ? <span role="status" style={{color:"#17643a",fontWeight:600}}>Filled in below. Check it before you finish.</span> : null}
    </div>
    {state === "done" && message ? <p role="status" style={{margin:0,padding:"8px 12px",borderRadius:5,background:"#fff4e0",color:"#7a4600"}}><strong>One question:</strong> {message}</p> : null}
    {state === "error" ? <p role="alert" style={{margin:0,color:"#8c3427"}}>{message}</p> : null}
  </div>;
}

export function InternalVendorHandoffFields({storeId}:{storeId:string}) {
  const load=useCallback(async(query:string,signal:AbortSignal,cursor?:string)=>{
    const offset=Number(cursor??0),response=await fetch(`/api/ops/stores/${encodeURIComponent(storeId)}/vendors?${new URLSearchParams({q:query,offset:String(offset)})}`,{signal});
    if(!response.ok)throw new Error("Could not load vendors for this store.");
    return storeVendorPickPage(await response.json() as StoreVendorPage,offset);
  },[storeId]);
  return <><SearchPicker name="vendorId" label="Outside vendor" required options={[]} load={load} placeholder="Search by name or specialty"/><p>Pick the vendor. You&apos;ll review the work order before it is sent.</p></>;
}
