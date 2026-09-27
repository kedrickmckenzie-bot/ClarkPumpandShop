"use client";
import {useRouter} from "next/navigation";
import {useState} from "react";
import type {CapitalPlan,CapitalPrice} from "@/lib/ops/capital-planning";
import styles from "./compliance.module.css";
export function CapitalPlanForm({assetId,plan,prices,owner,editable,returnTo}:{assetId:string;plan:CapitalPlan|null;prices:CapitalPrice[];owner:string;editable:boolean;returnTo:string}) {
 const router=useRouter();
 const [source,setSource]=useState(plan?.version?"keep-saved":""),[saving,setSaving]=useState(false),[error,setError]=useState("");
 return <form className={styles.form} onSubmit={async e=>{e.preventDefault();const body=new FormData(e.currentTarget);setSaving(true);setError("");try{const response=await fetch("/api/ops/capital-plans",{method:"POST",body});const result=await response.json() as {error?:string;redirectTo?:string};if(!response.ok)throw new Error(result.error??"Could not save this plan.");router.push(result.redirectTo!);router.refresh();}catch(failure){setError(failure instanceof Error?failure.message:"Try again.");setSaving(false);}}}>
 <input type="hidden" name="returnTo" value={returnTo}/><input type="hidden" name="assetId" value={assetId}/><input type="hidden" name="version" value={plan?.version??0}/>
 <fieldset disabled={!editable||saving} className={styles.form}><legend>Replacement plan</legend>
 <div className={styles.pair}><label>Target month · optional<input type="month" name="targetMonth" defaultValue={plan?.targetMonth} min="2000-01" max="2200-12"/></label><label>Owner<input name="owner" required maxLength={200} defaultValue={plan?.owner??owner}/></label></div>
 <label>Cost source<select name="sourceId" value={source} onChange={e=>setSource(e.target.value)}>{plan?.version?<option value="keep-saved">Keep saved cost · {plan.costBasis}</option>:null}<option value="">Enter a planning estimate</option>{prices.map(p=><option key={p.id} value={p.id}>{p.label} · {p.currency} {(p.amountMinor/100).toLocaleString()}</option>)}</select></label>
 <div className={styles.pair}><label>Installed cost · optional<input type="number" name="amount" min="0" step="0.01" disabled={Boolean(source)} defaultValue={plan?.amountMinor===undefined?"":(plan.amountMinor/100).toFixed(2)}/></label><label>Currency<input name="currency" pattern="[A-Z]{3}" required maxLength={3} defaultValue={plan?.currency??"USD"}/></label></div>
 {plan?<small>Saved basis: {plan.costBasis}. Select a source to refresh its price, or enter a new planning estimate.</small>:null}
 <div className={styles.pair}><label>Priority<select name="priority" defaultValue={plan?.priority??"flexible"}><option value="flexible">Flexible</option><option value="soon">Soon</option><option value="urgent">Urgent</option></select></label><label>Status<select name="status" defaultValue={plan?.status??"planned"}><option value="planned">Planned</option>{plan?<option value="cancelled">Remove from plan</option>:null}</select></label></div>
 <label>Reason / notes<textarea name="reason" rows={3} maxLength={2000} defaultValue={plan?.reason} placeholder="Age, renovation, reliability, standardization…"/></label>
 <small>Planning does not authorize work. A repair history is not required.</small>
 {editable?<button disabled={saving}>{saving?"Saving…":"Save replacement plan"}</button>:null}</fieldset>{error?<p role="alert">{error}</p>:null}
 </form>;
}
