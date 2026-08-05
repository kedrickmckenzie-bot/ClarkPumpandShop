"use client";

import { CheckCircle2, LocateFixed, MapPin, ShieldAlert, WifiOff, Wrench } from "lucide-react";
import Link from "@/components/site-link";
import { useState } from "react";
import { demoData, STORE_QR_TOKEN, STORY_STORE_ID, STORY_WORK_ORDER_ID } from "@/lib/demo/data";
import type { VerificationState, VisitOutcome } from "@/lib/domain/types";
import { verificationLabel, visitOutcomeLabel } from "@/lib/presentation";

type DemoLocation = "inside" | "outside" | "denied" | "inaccurate";

export function TechnicianVisitPage({ token }: { token: string }) {
  const store = demoData.stores.find((item) => item.id === STORY_STORE_ID)!;
  const workOrder = demoData.workOrders.find((item) => item.id === STORY_WORK_ORDER_ID)!;
  const [mode, setMode] = useState<DemoLocation>("inside");
  const [checkIn, setCheckIn] = useState<VerificationState | null>(null);
  const [outcome, setOutcome] = useState<VisitOutcome | "">("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const valid = token === STORE_QR_TOKEN;
  const simulatedState: Record<DemoLocation, VerificationState> = { inside: "verified", outside: "outside_geofence", denied: "permission_denied", inaccurate: "inaccurate" };
  async function simulateCheckIn() {
    setBusy(true);
    const state = simulatedState[mode];
    await fetch("/api/visits/check-in", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, workOrderId: STORY_WORK_ORDER_ID, simulated: true, state }) });
    setCheckIn(state); setBusy(false);
  }
  function realCheckIn() {
    setBusy(true);
    if (!navigator.geolocation) { setCheckIn("permission_denied"); setBusy(false); return; }
    navigator.geolocation.getCurrentPosition(async (position) => {
      const result = await fetch("/api/visits/check-in", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, workOrderId: STORY_WORK_ORDER_ID, latitude: position.coords.latitude, longitude: position.coords.longitude, accuracyM: position.coords.accuracy }) });
      const body = await result.json() as { state: VerificationState };
      setCheckIn(body.state); setBusy(false);
    }, () => { setCheckIn("permission_denied"); setBusy(false); }, { enableHighAccuracy: true, timeout: 12000 });
  }
  async function finish() { if (!outcome) return; await fetch("/api/visits/check-out", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, workOrderId: STORY_WORK_ORDER_ID, outcome, state: checkIn, simulated: true }) }); setDone(true); }
  if (!valid) return <div className="mobile-surface"><div className="mobile-frame"><div className="mobile-body"><h1>Store link unavailable</h1><p>This QR link is invalid. Ask the store manager for the current technician poster or contact dispatch.</p></div></div></div>;
  return <div className="mobile-surface"><div className="mobile-frame"><div className="mobile-head"><div className="mobile-head-row"><div className="brand-copy"><strong>{store.name}</strong><span>Technician visit proof</span></div><MapPin /></div></div><div className="mobile-body">
    {done ? <><div className="result-state"><CheckCircle2 size={27} color="#0e6255" /><h1>Visit recorded</h1><p>{visitOutcomeLabel[outcome as VisitOutcome]}. Time, location state and outcome are tied to {workOrder.number}.</p></div>{outcome !== "resolved" && outcome !== "no_issue_found" && <div className="callout warning"><strong>Follow-up created automatically</strong><p>Clark’s Facilities is accountable to document the next action, due date and escalation. The work order cannot silently close.</p></div>}<Link className="mobile-action secondary" style={{ marginTop: 14 }} href={`/work-orders/${STORY_WORK_ORDER_ID}`}>View Clark’s work order</Link></> : !checkIn ? <>
      <span className="step-label">Step 1 of 2 · Check in</span><h1>Verify this service visit</h1><p>{workOrder.number} · {workOrder.title}<br />This does not assign or dispatch you; it only records presence for Clark’s work order.</p>
      <div className="demo-controls"><div className="demo-title"><Wrench size={13} />Demo location controls</div><div className="demo-buttons">{(["inside", "outside", "denied", "inaccurate"] as DemoLocation[]).map((item) => <button className={mode === item ? "active" : ""} key={item} onClick={() => setMode(item)}>{item === "inside" ? "Inside geofence" : item === "outside" ? "Outside geofence" : item === "denied" ? "Permission denied" : "Low accuracy"}</button>)}</div><button className="mobile-action" style={{ marginTop: 9 }} disabled={busy} onClick={() => void simulateCheckIn()}>{busy ? "Checking…" : "Run demo check-in"}</button></div>
      <button className="mobile-action secondary" disabled={busy} onClick={realCheckIn}><LocateFixed size={15} /> Use my actual location</button><div className="callout" style={{ marginTop: 14 }}><strong><WifiOff size={13} style={{ verticalAlign: "middle", marginRight: 5 }} />Offline / fallback</strong><p>If location or data is unavailable, capture an exception reason and store-manager verification. The visit is marked unverified; it is never presented as geofence verified.</p></div>
    </> : <>
      <span className="step-label">Step 2 of 2 · Check out</span><h1>Record the outcome</h1><div className={checkIn === "verified" ? "result-state" : "result-state warning"}><strong>{checkIn === "verified" ? <CheckCircle2 size={14} /> : <ShieldAlert size={14} />} {verificationLabel[checkIn]}</strong><p>{checkIn === "verified" ? `Within ${store.geofenceRadiusM}m store radius.` : "This visit keeps its exception state and may require store-manager verification."}</p></div>
      <div className="option-list">{(["resolved", "temporary", "diagnosed_unresolved", "unable_to_diagnose", "no_issue_found", "unable_to_perform"] as VisitOutcome[]).map((item) => <label className="option-card" aria-label={visitOutcomeLabel[item]} key={item}><input type="radio" checked={outcome === item} onChange={() => setOutcome(item)} /><span><strong>{visitOutcomeLabel[item]}</strong><span>{item === "resolved" || item === "no_issue_found" ? "Eligible for customer verification" : "Creates a required follow-up automatically"}</span></span></label>)}</div><button className="mobile-action" style={{ marginTop: 14 }} disabled={!outcome} onClick={() => void finish()}>Check out and record outcome</button>
    </>}
  </div></div></div>;
}
