"use client";
import {useRouter} from "next/navigation";
import {useState} from "react";
import styles from "./compliance.module.css";
export function LifecycleDecisionForm({assetId,workOrderId}:{assetId:string;workOrderId?:string}) {
 const router=useRouter();
 const [saving,setSaving]=useState(false),[error,setError]=useState("");
 return <details className={styles.panel}><summary>Record a decision</summary><form className={`${styles.page} ${styles.form}`} onSubmit={async e=>{e.preventDefault();const body=new FormData(e.currentTarget);setSaving(true);setError("");try{const response=await fetch(`/api/ops/equipment/${encodeURIComponent(assetId)}/replacement`,{method:"POST",headers:{"x-ops-client":"replacement-intelligence"},body});if(!response.ok){const result=await response.json() as {error?:string};throw new Error(result.error??"Could not save decision.");}router.push("/app/lifecycle?view=history");router.refresh();}catch(failure){setError(failure instanceof Error?failure.message:"Try again.");setSaving(false);}}}>
 <input type="hidden" name="workOrderId" value={workOrderId??""}/><input type="hidden" name="operation" value="record-recommendation"/><label>Decision<select name="userDecision"><option value="repair">Choose repair</option><option value="investigate">Keep under review</option></select></label><label>Reason<textarea name="userReason" required maxLength={2000} rows={2}/></label><small>Records your decision. Work authorization stays on the work order.</small>{error?<p role="alert">{error}</p>:null}<button disabled={saving}>{saving?"Saving…":"Save decision"}</button></form></details>;
}
