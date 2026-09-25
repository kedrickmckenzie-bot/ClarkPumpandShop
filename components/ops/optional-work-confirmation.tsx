"use client";
import styles from "./ops.module.css";
import { useEffect, useRef, useState } from "react";
type Job={id:string;number:string;problem:string;scope:string;eligible:boolean};
export function useOptionalWorkConfirmation() {
  const [review,setReview]=useState<{vendor:string;rows:Job[]}>();
  const [selected,setSelected]=useState<string[]>([]);
  const resolve=useRef<((ids:string[]|null)=>void)|null>(null);
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{if(review)dialog.current?.showModal();},[review]);
  function done(ids:string[]|null){dialog.current?.close();setReview(undefined);resolve.current?.(ids);resolve.current=null;}
  async function confirm(action:string,data:FormData):Promise<string[]|null> {
    const issue=action.match(/^\/api\/ops\/work-orders\/([^/]+)\/issue$/);
    const create=data.get("intent")==="create_and_send" && action==="/api/ops/work-orders";
    if(!issue&&!create)return [];
    const query=new URLSearchParams({vendorId:String(data.get("vendorId")??""),...(issue?{workOrderId:decodeURIComponent(issue[1])}:{storeId:String(data.get("storeId")??"")})});
    const response=await fetch(`/api/ops/saved-work?${query}`);
    const result=await response.json() as {vendor:string;rows:Job[];error?:string};
    if(!response.ok)throw new Error(result.error??"Saved jobs could not be checked. Try again before sending.");
    const rows=result.rows.filter(j=>j.eligible);
    if(!rows.length)return [];
    setSelected([]);setReview({vendor:result.vendor,rows});
    return new Promise(r=>{resolve.current=r;});
  }
  const modal=review?<dialog ref={dialog} onCancel={e=>{e.preventDefault();done(null);}} aria-labelledby="optional-work-title" style={{maxWidth:620,width:"calc(100% - 32px)",maxHeight:"85vh",border:"1px solid #d8dee8",borderRadius:8,padding:24,color:"#172033"}}>
    <h2 id="optional-work-title">Don’t forget these saved jobs</h2><p>{review.vendor} can handle {review.rows.length} saved {review.rows.length===1?"job":"jobs"} at this store. Include any with this visit?</p>
    {review.rows.map(job=><label key={job.id} htmlFor={`optional-${job.id}`} aria-label={`${job.number}: ${job.problem}`} style={{display:"flex",gap:12,padding:"14px 0",borderTop:"1px solid #e2e8f0"}}><input id={`optional-${job.id}`} type="checkbox" checked={selected.includes(job.id)} onChange={e=>setSelected(ids=>e.target.checked?[...ids,job.id]:ids.filter(id=>id!==job.id))}/><span><strong>{job.number} · {job.problem}</strong><small style={{display:"block",marginTop:5}}>{job.scope}</small></span></label>)}
    <p>The vendor chooses which extras to accept. Skipped jobs stay saved.</p><div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button className={styles.primaryButton} type="button" disabled={!selected.length} onClick={()=>done(selected)}>Include selected and send</button><button className={styles.secondaryButton} type="button" onClick={()=>done([])}>Send original only</button><button className={styles.secondaryButton} type="button" onClick={()=>done(null)}>Back</button></div>
  </dialog>:null;
  return {confirm,modal};
}
