"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { SearchPicker } from "@/components/ops/search-picker";
import { storeVendorPickPage } from "@/components/ops/work-routing-fields";
import type { StoreVendorPage } from "@/lib/ops/store-vendors";
import { checkoutChoices, type CheckoutMode } from "@/lib/ops/checkout-choices";

export function InternalResultFields({ problem = false, prefix = "", visit = false, lookAndReport = false, ai }: { problem?: boolean; prefix?: string; visit?: boolean; lookAndReport?: boolean; /** Shows "Fill it in for me" when AI help is turned on for this job. */ ai?: { workOrderId: string; /** Submit the form after "Yes, that's right" (off when one form saves several jobs). */ autoSubmit?: boolean } }) {
  const mode: CheckoutMode = visit ? "visit" : problem ? "problem" : "job";
  const [value, setValue] = useState<string>(problem ? "parts_required" : lookAndReport ? "return_visit_required" : "completed");
  const [notes, setNotes] = useState(""), [working, setWorking] = useState("");
  const choices = checkoutChoices(mode, lookAndReport);
  const blocker = problem || visit ? ({parts_required:"parts",diagnosis_only:"help",quote_required:"vendor",not_addressed:"cannot_today"} as Record<string,string>)[value] : value === "quote_required" ? "vendor" : "";
  return <>
    {ai ? <AiCheckoutChat workOrderId={ai.workOrderId} mode={mode} lookAndReport={lookAndReport} autoSubmit={ai.autoSubmit !== false} onDraft={draft => { setValue(draft.outcome); setNotes(draft.notes); if (!problem && draft.workingWhenLeft !== "unknown") setWorking(draft.workingWhenLeft); }}/> : null}
    <fieldset><legend>{problem ? "What do you need?" : "How did it go?"}</legend><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:8}}>{choices.map(([id,label])=><label key={id} style={{display:"flex",alignItems:"center",gap:10,minHeight:48,border:"1px solid #c7d2e2",borderRadius:5,padding:12,background:value===id?"#edf3ff":"white"}}><input style={{width:20,height:20,minWidth:20,minHeight:20,flex:"0 0 20px",padding:0}} type="radio" name={`${prefix}outcome`} value={id} checked={value===id} onChange={()=>setValue(id)}/>{label}</label>)}</div></fieldset>
    <input type="hidden" name={`${prefix}blocker`} value={blocker ?? ""}/>
    <label>{value === "completed" ? "Notes (optional)" : value === "parts_required" ? "Which parts are needed?" : value === "diagnosis_only" ? "What help is needed?" : "What still needs to be done?"}<textarea name={`${prefix}notes`} rows={3} required={value !== "completed"} maxLength={2900} value={notes} onChange={event => setNotes(event.target.value)}/></label>
    {!problem?<label>Quick check: working when I left?<select name={`${prefix}workingWhenLeft`} value={working} onChange={event => setWorking(event.target.value)} required><option value="" disabled>Choose</option><option value="yes">Yes</option><option value="no">No</option><option value="not_checked">Could not check</option></select></label>:null}
    <label>Photos or files (optional)<input type="file" name={`${prefix}attachments`} multiple accept="image/jpeg,image/png,image/webp,application/pdf,text/plain"/><small>Up to 5 photos or files.</small></label>
  </>;
}

type CheckoutDraft = { outcome: string; notes: string; workingWhenLeft: string };
type ChatMessage = { from: "tech" | "ai"; text: string };
type ChatTurn = CheckoutDraft & { reply: string; ready: boolean };

/**
 * Checkout by chat: the AI asks what happened until it has what the form needs, then reads back a short
 * summary. "Yes, that's right" fills the form below and submits it; nothing is saved before that.
 */
function AiCheckoutChat({ workOrderId, mode, lookAndReport, autoSubmit, onDraft }: { workOrderId: string; mode: CheckoutMode; lookAndReport: boolean; autoSubmit: boolean; onDraft: (draft: CheckoutDraft) => void }) {
  const greeting = mode === "problem" ? "What's going on, and what do you need to finish it?" : "What did you do?";
  const [messages, setMessages] = useState<ChatMessage[]>([{ from: "ai", text: greeting }]);
  const [text, setText] = useState(""), [turn, setTurn] = useState<ChatTurn>(), [busy, setBusy] = useState(false), [error, setError] = useState(""), [closed, setClosed] = useState(false), [finished, setFinished] = useState("");
  const box = useRef<HTMLDivElement>(null), input = useRef<HTMLTextAreaElement>(null), log = useRef<HTMLOListElement>(null);
  useEffect(() => { log.current?.lastElementChild?.scrollIntoView({ block: "nearest" }); }, [messages, busy]);
  async function send(answer: string) {
    const said = answer.trim();
    if (!said || busy) return;
    const next = [...messages, { from: "tech" as const, text: said }];
    setMessages(next); setText(""); setBusy(true); setError(""); setTurn(undefined);
    try {
      const response = await fetch("/api/ops/ai/checkout-chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workOrderId, mode, lookAndReport, messages: next }) });
      const result = await response.json() as { turn?: ChatTurn; error?: string };
      if (!response.ok || !result.turn) throw new Error(result.error ?? "The AI couldn't answer. Use the form below.");
      setMessages([...next, { from: "ai", text: result.turn.reply }]);
      setTurn(result.turn);
      onDraft(result.turn);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The AI couldn't answer. Use the form below.");
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  }
  async function confirm() {
    if (!turn?.ready || busy) return;
    const finalMessages = [...messages, { from: "tech" as const, text: "Yes, that's right." }];
    setMessages(finalMessages); setBusy(true);
    onDraft(turn);
    // The conversation is kept with the job for history and later diagnostics; the job record is the form below.
    await fetch("/api/ops/ai/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workOrderId, kind: "checkout", messages: finalMessages, summary: turn.notes }) }).catch(() => undefined);
    setBusy(false);
    if (!autoSubmit) { setFinished("Filled in below. Finish the other jobs, then save."); return; }
    setFinished("Saving…");
    // Let the form show the confirmed answers, then submit it the normal way.
    window.setTimeout(() => {
      const form = box.current?.closest("form");
      // Press the form's own save button so its action goes with the answers.
      form?.requestSubmit(form.querySelector<HTMLButtonElement>('button[type="submit"][name="action"]') ?? undefined);
    }, 60);
  }
  if (closed) return <button type="button" onClick={() => setClosed(false)} style={{justifySelf:"start",minHeight:40,padding:"6px 14px",borderRadius:5,border:"1px solid #9fb4e8",background:"white",color:"#2457d6",fontWeight:600}}>Finish by chat instead</button>;
  return <div ref={box} style={{display:"grid",gap:10,padding:14,border:"1px solid #c9d7f5",borderRadius:6,background:"#f5f8ff"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:12}}>
      <strong>Finish by chat</strong>
      <button type="button" onClick={() => setClosed(true)} style={{minHeight:32,padding:"2px 8px",border:0,background:"transparent",color:"#2457d6",textDecoration:"underline"}}>Use the form instead</button>
    </div>
    <ol ref={log} aria-live="polite" style={{listStyle:"none",margin:0,padding:0,display:"grid",gap:8,maxHeight:320,overflowY:"auto"}}>
      {messages.map((message, index) => <li key={index} style={{justifySelf:message.from === "tech" ? "end" : "start",maxWidth:"85%",padding:"8px 12px",borderRadius:12,background:message.from === "tech" ? "#2457d6" : "white",color:message.from === "tech" ? "white" : "#1d2b3e",border:message.from === "tech" ? 0 : "1px solid #dbe2ec",whiteSpace:"pre-wrap"}}>{message.text}</li>)}
      {busy && !finished ? <li style={{justifySelf:"start",color:"#5b6b80"}}>…</li> : null}
    </ol>
    {error ? <p role="alert" style={{margin:0,color:"#8c3427"}}>{error}</p> : null}
    {finished ? <p role="status" style={{margin:0,color:"#17643a",fontWeight:600}}>{finished}</p>
      : turn?.ready ? <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
          <button type="button" onClick={() => void confirm()} disabled={busy} style={{minHeight:44,padding:"8px 18px",borderRadius:5,border:"1px solid #2457d6",background:"#2457d6",color:"white",fontWeight:600}}>Yes, that&apos;s right</button>
          <button type="button" onClick={() => { setTurn({ ...turn, ready: false }); input.current?.focus(); }} disabled={busy} style={{minHeight:44,padding:"8px 18px",borderRadius:5,border:"1px solid #9fb4e8",background:"white",color:"#2457d6",fontWeight:600}}>Change something</button>
        </div>
      : <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
          <label style={{flex:1,display:"grid",gap:4}}>
            <span style={{position:"absolute",width:1,height:1,overflow:"hidden",clip:"rect(0 0 0 0)"}}>Your answer</span>
            <textarea ref={input} rows={2} maxLength={2000} value={text} onChange={event => setText(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(text); } }} placeholder="Type, or tap your keyboard's microphone" disabled={busy}/>
          </label>
          <button type="button" onClick={() => void send(text)} disabled={busy || !text.trim()} style={{minHeight:44,padding:"8px 16px",borderRadius:5,border:"1px solid #2457d6",background:"#2457d6",color:"white",fontWeight:600}}>Send</button>
        </div>}
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
