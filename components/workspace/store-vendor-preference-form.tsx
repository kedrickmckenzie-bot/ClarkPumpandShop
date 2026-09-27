"use client";
import {useState} from "react";
import type {StoreVendorRow} from "@/lib/ops/store-vendors";
import styles from "./compliance.module.css";
export function StoreVendorPreferenceForm({storeId,vendor}:{storeId:string;vendor:StoreVendorRow}) {
  const [keys,setKeys]=useState(vendor.preferenceKeys),[saving,setSaving]=useState(false),[error,setError]=useState("");
  return <details><summary>{vendor.preferenceKeys.length?"Edit preference":"Set preference"}</summary><form className={styles.form} action={`/api/ops/stores/${encodeURIComponent(storeId)}/vendors`} method="post" onSubmit={async e=>{
    e.preventDefault();const body=new FormData(e.currentTarget);setSaving(true);setError("");
    try {const response=await fetch(e.currentTarget.action,{method:"POST",body});if(!response.ok){const result=await response.json() as {error?:string};throw new Error(result.error??"Could not save preferences.");}window.location.assign(response.url);}catch(failure){setError(failure instanceof Error?failure.message:"Try again.");setSaving(false);}
  }}>
    <input type="hidden" name="vendorId" value={vendor.id}/><input type="hidden" name="version" value={vendor.version}/>
    {keys.map(key=><input key={key} type="hidden" name="tradeKeys" value={key}/>)}
    <fieldset><legend>Preferred at this store for</legend>
      <label className={styles.check}><input type="checkbox" checked={keys.includes("*")} disabled={!vendor.covered} onChange={e=>setKeys(e.target.checked?["*"]:[])}/>All services</label>
      {vendor.specialties.map(s=><label className={styles.check} key={s.key}><input type="checkbox" checked={keys.includes(s.key)} disabled={!vendor.covered||keys.includes("*")} onChange={e=>setKeys(e.target.checked?[...keys,s.key]:keys.filter(k=>k!==s.key))}/>{s.label}</label>)}
    </fieldset>
    <small>Optional. Leave unchecked for no preference.</small>
    {error?<p role="alert">{error}</p>:null}
    <div className={styles.bar}><button type="submit" disabled={saving}>{saving?"Saving…":"Save preference"}</button>{vendor.preferenceKeys.length?<button type="submit" disabled={saving} onClick={e=>{e.preventDefault();setKeys([]);}}>Clear selection</button>:null}</div>
  </form></details>;
}
