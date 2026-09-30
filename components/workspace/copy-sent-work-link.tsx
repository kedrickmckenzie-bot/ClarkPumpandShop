"use client";
import { useState } from "react";
import styles from "./sent-work-orders.module.css";
export function CopySentWorkLink({workOrderId,issuanceId}:{workOrderId:string;issuanceId:string}) {
  const [link,setLink]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  async function copy() {
    setBusy(true);setError("");setMessage("");
    try {
      let url=link;
      if(!url) {
        const response=await fetch(`/api/ops/work-orders/${encodeURIComponent(workOrderId)}/sent/${encodeURIComponent(issuanceId)}/link`,{method:"POST"});
        const result=await response.json() as {error?:string;publicPath?:string};
        if(!response.ok || !result.publicPath?.startsWith("/public/service/")) throw new Error(result.error ?? "Could not get the vendor link.");
        url=new URL(result.publicPath,window.location.origin).toString();setLink(url);
      }
      try { await navigator.clipboard.writeText(url);setMessage("Link copied. Opens this same sent version."); }
      catch {setMessage("Select and copy the link below.");}
    } catch(cause) {setError(cause instanceof Error ? cause.message : "Could not get the vendor link.");}
    finally {setBusy(false);}
  }
  return <div className={styles.linkActions}>
    <button type="button" disabled={busy} onClick={copy}>{busy?"Getting link…":"Copy vendor link"}</button>
    {message?<p role="status">{message}</p>:null}
    {error?<p role="alert">{error}</p>:null}
    {link?<><label>Vendor link<input readOnly value={link} onFocus={event=>event.currentTarget.select()}/></label><a href={link} target="_blank" rel="noopener noreferrer">Open vendor work order ↗</a><small>Fresh link · valid for 30 days. No email is sent.</small></>:null}
  </div>;
}
