"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./ops.module.css";
type Job = { id: string; number: string; problem: string; category: string; revision: number; scope: string; eligible: boolean; reason?: string };
type Result = { id: string; number?: string; ok: boolean; href?: string; message: string };
export function SavedWorkSuggestions({ storeId, vendorId, workOrderId, preview = false }: { storeId?: string; vendorId?: string; workOrderId?: string; preview?: boolean }) {
  const query = new URLSearchParams({ ...(storeId ? {storeId} : {}), ...(vendorId ? {vendorId} : {}), ...(workOrderId ? {workOrderId} : {}) }).toString();
  return <Suggestions key={query} query={query} enabled={!!workOrderId || !!storeId && !!vendorId} preview={preview} />;
}
function Suggestions({query, enabled, preview}: {query:string;enabled:boolean;preview:boolean}) {
  const [data, setData] = useState<{vendor:string;rows:Job[]}>();
  const [selected, setSelected] = useState<string[]>([]);
  const [channel, setChannel] = useState("manual");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    fetch(`/api/ops/saved-work?${query}`, {signal:controller.signal}).then(async response => { const result = await response.json() as {vendor:string;rows:Job[];error?:string}; if (!response.ok) throw new Error(result.error); setData(result); }).catch(e => { if (e.name !== "AbortError") setError("Saved jobs could not be checked. Open Work → Saved for later to review them."); });
    return () => controller.abort();
  }, [query,enabled]);
  if (!enabled) return null;
  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p role="status">Checking saved jobs at this store…</p>;
  if (!data.rows.length) return null;
  async function send() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/ops/saved-work?${query}`, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({channel,jobs:data!.rows.filter(j=>selected.includes(j.id)).map(j=>({id:j.id,revision:j.revision}))})});
      const result = await response.json() as {results:Result[];error?:string}; if (!response.ok) throw new Error(result.error);
      setResults(prior=>[...prior,...result.results]); setSelected([]);
    } catch { setError("Could not confirm the result. Refresh this work order before trying again."); }
    finally { setBusy(false); }
  }
  return <section id="saved-jobs" className={styles.formSection} aria-label="Saved jobs for this vendor">
    <h3>{data.rows.length} saved {data.rows.length === 1 ? "job" : "jobs"} at this store</h3>
    <p><strong>{data.vendor}</strong> · {data.rows.filter(j=>j.eligible).length} eligible</p><p>{preview ? "Eligible jobs can be sent after you create this work order." : "Add any of these jobs to the vendor’s visit. Each keeps its own work-order number."}</p>
    {data.rows.map(job => <div key={job.id} style={{padding:"10px 0",borderBottom:"1px solid #e2e8f0"}}>
      {!preview ? <input type="checkbox" aria-label={`Include ${job.number}`} checked={selected.includes(job.id)} disabled={!job.eligible || busy || results.some(r=>r.id===job.id&&r.ok)} onChange={e=>setSelected(s=>e.target.checked?[...s,job.id]:s.filter(id=>id!==job.id))} /> : null} <Link href={`/app/work-orders/${job.id}`} target="_blank">{job.number}</Link> · <strong>{job.problem}</strong><small style={{display:"block"}}>{job.category}{!job.eligible ? ` · ${job.reason}` : " · Eligible"}</small>
      {!preview ? <details><summary>Vendor scope</summary><p>{job.scope}</p></details> : null}
    </div>)}
    {!preview ? <><label className={styles.field}><span>Handoff</span><select value={channel} disabled={busy} onChange={e=>setChannel(e.target.value)}><option value="manual">Create links to share</option><option value="email">Email vendor</option></select></label><button className={styles.primaryButton} type="button" disabled={busy || !selected.length} onClick={send}>{busy ? "Preparing…" : channel === "email" ? `Send ${selected.length} selected jobs` : `Create links for ${selected.length} selected jobs`}</button><div role="status">{results.map((r,i)=><p key={i}>{r.number} {r.message} {r.href ? <a href={r.href} target="_blank" rel="noreferrer">Open vendor link →</a> : null}</p>)}</div></> : null}
  </section>;
}
