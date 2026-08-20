"use client";

import { useState } from "react";
import type { ServiceRunPublicView } from "@/lib/ops/service-run-presenter";
import type { ServiceRunResponseKind } from "@/lib/ops/types";
import styles from "./public-workflows.module.css";

export function ServiceRunResponseForm({ token, view }: { token: string; view: ServiceRunPublicView }) {
  const [response, setResponse] = useState<ServiceRunResponseKind>("accepted");
  const [responderName, setResponderName] = useState("");
  const [requestedStartsAt, setRequestedStartsAt] = useState("");
  const [reasonCode, setReasonCode] = useState("");
  const [reasonDetail, setReasonDetail] = useState("");
  const [stopOrder, setStopOrder] = useState(view.stops.map((stop) => stop.storeId));
  const [removed, setRemoved] = useState<string[]>([]);
  const [state, setState] = useState<{ kind: "idle" | "working" | "success" | "error"; message?: string }>({ kind: "idle" });
  const needsReason = response !== "accepted";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setState({ kind: "working" });
    const requestedStopOrder = response === "stop_change_requested" || response === "countered" && stopOrder.some((id, index) => id !== view.stops[index]?.storeId) ? stopOrder : undefined;
    const removeWorkOrderIds = response === "work_order_change_requested" || response === "countered" && removed.length ? removed : undefined;
    try {
      const request = await fetch(`/api/ops-public/service-run/${encodeURIComponent(token)}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ response, responderName, requestedStartsAt: requestedStartsAt ? new Date(requestedStartsAt).toISOString() : undefined, requestedStopOrder, removeWorkOrderIds, reasonCode: needsReason ? reasonCode : undefined, reasonDetail: needsReason ? reasonDetail : undefined }),
      });
      const payload = await request.json() as { error?: string; message?: string; heading?: string };
      if (!request.ok) throw new Error(payload.error ?? "The response could not be recorded.");
      setState({ kind: "success", message: payload.message ?? "Your response was recorded." });
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : "The response could not be recorded." });
    }
  }

  if (state.kind === "success") return <section className={styles.receipt} aria-live="polite"><h2 className={styles.receiptTitle}>Response recorded</h2><p className={styles.receiptMessage}>{state.message}</p><p className={styles.disclaimer}>The original recommendation and this response are retained in the operator Audit timeline.</p></section>;

  return (
    <section className={styles.card} aria-labelledby="respond-run-title">
      <div className={styles.cardHeader}><div><span className={styles.eyebrow}>Your decision</span><h2 className={styles.cardTitle} id="respond-run-title">Respond to this Service Run</h2></div></div>
      <form className={styles.form} onSubmit={submit}>
        <label><span className={styles.detailLabel}>Responder name</span><input required maxLength={100} value={responderName} onChange={(event) => setResponderName(event.target.value)} /></label>
        <fieldset className={styles.fieldset}><legend className={styles.detailLabel}>Response</legend><div className={styles.choiceGrid}>{view.responseOptions.map((option) => <label className={`${styles.choiceCard} ${response === option.value ? styles.choiceCardSelected : ""}`} key={option.value}><span className={styles.visuallyHidden}>Service Run response option: </span><input className={styles.choiceInput} type="radio" name="response" value={option.value} checked={response === option.value} onChange={() => setResponse(option.value)} /><span><strong className={styles.choiceTitle}>{option.label}</strong><span className={styles.choiceDescription}>{option.description}</span></span></label>)}</div></fieldset>
        {response === "countered" ? <label><span className={styles.detailLabel}>Requested start</span><input type="datetime-local" value={requestedStartsAt} onChange={(event) => setRequestedStartsAt(event.target.value)} /></label> : null}
        {response === "stop_change_requested" || response === "countered" ? <fieldset className={styles.fieldset}><legend className={styles.detailLabel}>Requested stop order</legend>{stopOrder.map((storeId, index) => <label key={storeId}><span className={styles.helper}>Stop {index + 1}</span><select value={storeId} onChange={(event) => setStopOrder((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.value : value))}>{view.stops.map((stop) => <option value={stop.storeId} key={stop.storeId}>{stop.storeLabel}</option>)}</select></label>)}</fieldset> : null}
        {response === "work_order_change_requested" || response === "countered" ? <fieldset className={styles.fieldset}><legend className={styles.detailLabel}>Request Work Order removal</legend>{view.stops.flatMap((stop) => stop.workOrders).map((workOrder) => <label key={workOrder.id}><input type="checkbox" checked={removed.includes(workOrder.id)} onChange={(event) => setRemoved((current) => event.target.checked ? [...current, workOrder.id] : current.filter((id) => id !== workOrder.id))} /><span>{workOrder.number} · {workOrder.problem}</span></label>)}</fieldset> : null}
        {needsReason ? <><label><span className={styles.detailLabel}>Structured reason</span><select required value={reasonCode} onChange={(event) => setReasonCode(event.target.value)}><option value="">Choose a reason</option><option value="crew_start_window">Crew start window</option><option value="capacity_limit">Capacity limit</option><option value="route_order">Route order</option><option value="scope_question">Scope question</option><option value="equipment_unavailable">Required equipment unavailable</option><option value="other">Other</option></select></label><label><span className={styles.detailLabel}>Explanation</span><textarea required maxLength={2000} rows={4} value={reasonDetail} onChange={(event) => setReasonDetail(event.target.value)} /></label></> : null}
        {state.kind === "error" ? <p role="alert" className={styles.disclaimer}>{state.message}</p> : null}
        <button className={styles.button} type="submit" disabled={state.kind === "working"}>{state.kind === "working" ? "Recording…" : "Submit response"}</button>
      </form>
    </section>
  );
}
