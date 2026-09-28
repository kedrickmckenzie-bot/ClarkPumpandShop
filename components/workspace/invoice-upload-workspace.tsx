"use client";
import Link from "next/link";
import { useRef,useState } from "react";
import type { InvoiceUpload } from "@/lib/ops/invoice-upload-types";
import styles from "./invoice-upload-workspace.module.css";
type Item={key:string;name:string;state:string;row?:InvoiceUpload;error?:string};
export function InvoiceUploadWorkspace({readerEnabled=true}:{readerEnabled?:boolean}){
 const input=useRef<HTMLInputElement>(null),busy=useRef(false);
 const [items,setItems]=useState<Item[]>([]),[drag,setDrag]=useState(false),[working,setWorking]=useState(false),[error,setError]=useState("");
 const update=(key:string,patch:Partial<Item>)=>setItems(previous=>previous.map(i=>i.key===key?{...i,...patch}:i));
 async function upload(files:File[]){
  if(busy.current)return;if(files.length>10){setError("Choose up to 10 invoices at a time.");return;}
  busy.current=true;setWorking(true);setError("");
  const batch=files.map(file=>({file,key:crypto.randomUUID()}));setItems(previous=>[...previous,...batch.map(({file,key})=>({key,name:file.name,state:"Waiting"}))]);
  for(const {file,key} of batch){try{
   if(file.size>15*1024*1024)throw new Error("File must be 15 MB or smaller.");
   update(key,{state:"Uploading"});const form=new FormData();form.set("file",file);
   let response=await fetch("/api/ops/invoice-uploads",{method:"POST",body:form});let result=await response.json() as InvoiceUpload & {error?:string;hasFlags?:boolean};if(!response.ok)throw new Error(result.error??"Upload failed.");
   update(key,{row:result,state:"Reading invoice"});
   if(result.status==="queued"||result.status==="recorded"){response=await fetch(`/api/ops/invoice-uploads/${encodeURIComponent(result.id)}/process`,{method:"POST"});result=await response.json() as InvoiceUpload & {error?:string;hasFlags?:boolean};if(!response.ok)throw new Error(result.error??"Reading interrupted. Open the saved upload to retry.");}
   update(key,{row:result,state:result.status==="recorded"?(result.hasFlags?"Recorded · needs review":"Recorded"):result.status==="dismissed"?"Already dismissed":"Needs review"});
  }catch(e){update(key,{state:"Needs attention",error:e instanceof Error?e.message:"Connection lost. Check saved uploads before retrying."});}}
  busy.current=false;setWorking(false);if(input.current)input.current.value="";
 }
 return <div className={styles.page}><header className={styles.header}><div><p>Spend & planning / Invoices</p><h1>Upload invoices</h1><p>Clear matches are recorded. Only exceptions need review.</p></div><Link href="/app/invoices">All invoices →</Link></header>
 <section className={styles.surface}>{!readerEnabled?<p className={styles.issue}>Automatic reading is not connected yet. Uploads are saved for manual entry.</p>:null}<div className={`${styles.drop} ${drag?styles.drag:""}`} onDragOver={e=>{e.preventDefault();if(!working)setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);if(!working)void upload(Array.from(e.dataTransfer.files));}}>
 <strong>{working?"Processing your invoices…":"Drop invoices here"}</strong><p>PDF, JPEG, PNG or WebP · Up to 15 MB each<br/>One invoice per file · Up to 10 files at once</p>
 <input ref={input} type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" hidden aria-label="Invoice files" onChange={e=>void upload(Array.from(e.target.files??[]))}/><button type="button" disabled={working} onClick={()=>input.current?.click()}>Choose files</button></div>
 {error?<p role="alert" className={styles.error}>{error}</p>:null}<p className={styles.muted}>Checks the work order, vendor, store, totals and internal flag amount. Recording an invoice does not approve payment.</p><Link href="/app/invoices/new?manual=1">Enter an invoice manually</Link></section>
 {items.length?<section className={styles.surface} aria-live="polite"><h2>This upload</h2><ul className={styles.list}>{items.map(i=><li key={i.key}><div><strong>{i.name}</strong><span>{i.state}</span>{i.error?<span className={styles.error}>{i.error}</span>:null}</div>{i.row?<div className={styles.actions}><a href={`/api/ops/invoice-uploads/${encodeURIComponent(i.row.id)}/file`} target="_blank" rel="noreferrer">Open file</a><Link href={i.row.invoiceId?`/app/invoices/${encodeURIComponent(i.row.invoiceId)}`:`/app/invoices/new?upload=${encodeURIComponent(i.row.id)}`}>{i.row.invoiceId?"View invoice":"Review upload"}</Link></div>:null}</li>)}</ul></section>:null}</div>;
}
export function InvoiceUploadActions({id}:{id:string}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[dismissing,setDismissing]=useState(false);
 async function action(kind:"process"|"dismiss",form?:FormData){setBusy(true);setError("");try{const response=await fetch(`/api/ops/invoice-uploads/${encodeURIComponent(id)}/${kind}`,{method:"POST",body:form});const data=await response.json() as {error?:string;invoiceId?:string};if(!response.ok)throw new Error(data.error??"Could not update this upload.");window.location.assign(data.invoiceId?`/app/invoices/${encodeURIComponent(data.invoiceId)}`:kind==="dismiss"?"/app/invoices":`/app/invoices/new?upload=${encodeURIComponent(id)}`);}catch(e){setError(e instanceof Error?e.message:"Connection lost. Try again.");setBusy(false);}}
 return <div><div className={styles.actions}><button type="button" disabled={busy} onClick={()=>void action("process")}>{busy?"Working…":"Retry automatic reading"}</button><button type="button" disabled={busy} onClick={()=>setDismissing(v=>!v)}>Dismiss upload</button></div>{dismissing?<form onSubmit={e=>{e.preventDefault();void action("dismiss",new FormData(e.currentTarget));}}><label>Reason <input name="reason" required maxLength={2000}/></label><button disabled={busy}>Save dismissal</button></form>:null}{error?<p role="alert">{error}</p>:null}</div>;
}
