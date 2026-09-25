"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import styles from "./ops.module.css";
type Job={id:string;number:string;problem:string;eligible:boolean;reason?:string;status?:string};
export function SavedWorkSuggestions({storeId,vendorId,workOrderId,preview=false,summaryOnly=false}:{storeId?:string;vendorId?:string;workOrderId?:string;preview?:boolean;summaryOnly?:boolean}) {
  const query=new URLSearchParams({...storeId?{storeId}:{},...vendorId?{vendorId}:{},...workOrderId?{workOrderId}:{}}).toString();
  return <Summary key={query} query={query} enabled={!!workOrderId||!!storeId&&!!vendorId} preview={preview} summaryOnly={summaryOnly}/>;
}
function Summary({query,enabled,preview,summaryOnly}:{query:string;enabled:boolean;preview:boolean;summaryOnly:boolean}){
 const [data,setData]=useState<{vendor:string;rows:Job[];offered:Job[]}>(),[error,setError]=useState("");
 useEffect(()=>{if(!enabled)return;const c=new AbortController();fetch(`/api/ops/saved-work?${query}`,{signal:c.signal}).then(async r=>{const d=await r.json() as {vendor:string;rows:Job[];offered:Job[];error?:string};if(!r.ok)throw new Error();setData(d);}).catch(e=>{if(e.name!=="AbortError")setError("Saved jobs could not be checked. Try again before sending.");});return()=>c.abort();},[query,enabled]);
 if(!enabled)return null;
 if(error)return <p role="alert">{error}</p>;
 if(!data)return <p role="status">Checking saved jobs…</p>;
 if((summaryOnly||!data.rows.length)&&!data.offered.length)return null;
 return <section id="saved-jobs" className={styles.formSection}><h3>{data.offered.length&&!preview?"Extras offered with this visit":"Saved jobs at this store"}</h3>{!preview&&data.offered.map(j=><p key={j.id}><Link href={`/app/work-orders/${j.id}`}>{j.number}</Link> · {j.problem} · <strong>{j.status==="accepted"?"Vendor accepted":j.status==="skipped"?"Vendor skipped · saved for later":j.status}</strong></p>)}{!summaryOnly&&data.rows.length?<><p>{data.rows.filter(j=>j.eligible).length} eligible for {data.vendor}. You’ll choose which to include when you send.</p><details><summary>Review saved jobs</summary>{data.rows.map(j=><p key={j.id}><Link href={`/app/work-orders/${j.id}`} target="_blank">{j.number}</Link> · {j.problem} · {j.eligible?"Eligible":j.reason}</p>)}</details></>:null}</section>;
}
