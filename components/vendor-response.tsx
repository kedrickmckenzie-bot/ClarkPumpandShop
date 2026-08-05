"use client";

import { Building2, CheckCircle2, HelpCircle, XCircle } from "lucide-react";
import Link from "@/components/site-link";
import { useState } from "react";
import { demoData, STORY_WORK_ORDER_ID, VENDOR_ACCEPT_TOKEN } from "@/lib/demo/data";

type Response = "accepted" | "declined" | "clarification";

export function VendorResponsePage({ token }: { token: string }) {
  const valid = token === VENDOR_ACCEPT_TOKEN;
  const workOrder = demoData.workOrders.find((item) => item.id === STORY_WORK_ORDER_ID)!;
  const store = demoData.stores.find((item) => item.id === workOrder.storeId)!;
  const [response, setResponse] = useState<Response | null>(null);
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState<Response | null>(null);
  async function submit() {
    if (!response) return;
    await fetch("/api/vendor-response", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, response, note }) });
    setSubmitted(response);
  }
  if (!valid) return <div className="mobile-surface"><div className="mobile-frame"><div className="mobile-body"><h1>Link unavailable</h1><p>This response link is invalid or expired. Contact Clark’s Facilities and reference the work-order number from your email.</p></div></div></div>;
  return <div className="mobile-surface"><div className="mobile-frame"><div className="mobile-head"><div className="mobile-head-row"><div className="brand-copy"><strong>Clark&apos;s Operations</strong><span>Vendor work-order response</span></div><Building2 /></div></div><div className="mobile-body">
    {submitted ? <><div className="result-state"><CheckCircle2 size={27} color="#0e6255" /><h1>Response recorded</h1><p>{submitted === "accepted" ? "Clark’s has been told your company accepts this work. Dispatch the job in your own system; no technician assignment is needed here." : submitted === "declined" ? "Clark’s Facilities will retain accountability and select the next action." : "Clark’s Facilities will review your question and reply through the normal communication channel."}</p></div><Link className="mobile-action secondary" href="/email-outbox">Return to demo outbox</Link></> : <>
      <span className="step-label">{workOrder.number} · Response requested</span><h1>{workOrder.title}</h1><p>{store.name} · {store.city}, {store.state}<br />Requested service: May 18, 2026 · NTE $5,000</p>
      <div className="callout"><strong>Scope</strong><p>{workOrder.description}</p></div>
      <div className="form-stack" style={{ marginTop: 14 }}><div className="option-list">{[["accepted", "Accept work", "We will dispatch this in our own system", CheckCircle2], ["clarification", "Request clarification", "We need more scope or access information", HelpCircle], ["declined", "Decline work", "We cannot accept this request", XCircle]].map(([value, label, help, Icon]) => { const SelectionIcon = Icon as typeof CheckCircle2; return <button className="option-card" style={{ textAlign: "left" }} key={String(value)} onClick={() => setResponse(value as Response)}><input type="radio" readOnly checked={response === value} /><span><strong><SelectionIcon size={13} style={{ verticalAlign: "middle", marginRight: 5 }} />{String(label)}</strong><span>{String(help)}</span></span></button>;})}</div>
        {response && response !== "accepted" && <label className="form-field"><span>{response === "declined" ? "Reason" : "Question"}</span><textarea value={note} required onChange={(event) => setNote(event.target.value)} placeholder="Add enough detail for Clark’s Facilities to act." /></label>}
        <button className="mobile-action" disabled={!response || (response !== "accepted" && !note.trim())} onClick={() => void submit()}>Submit response</button><small style={{ color: "#7a8987", textAlign: "center" }}>No login required · single-use opaque link · response is audit logged</small>
      </div></>}
  </div></div></div>;
}
