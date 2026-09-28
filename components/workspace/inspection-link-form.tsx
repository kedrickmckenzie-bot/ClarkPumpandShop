"use client";
import {useRouter} from "next/navigation";
import {useState} from "react";
import styles from "./compliance.module.css";
export function InspectionLinkForm({token,version,date}:{token:string;version:number;date:string}) {
 const router=useRouter();
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 return <form className={styles.form} onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError("");try{const response=await fetch(`/api/ops-public/inspection/${token}`,{method:"POST",body:new FormData(e.currentTarget)});const data=await response.json() as {error?:string};if(!response.ok)throw new Error(data.error??"Could not save the inspection.");router.push(`/public/inspection/${token}?saved=yes`);router.refresh();}catch(error){setError(error instanceof Error?error.message:"Could not save. Try again.");setBusy(false);}}}>
 <input type="hidden" name="version" value={version}/>
 <label>Result<select name="status"><option value="performed">Inspection completed</option><option value="action_needed">Issues found</option></select></label>
 <label>Inspection date<input name="performedDate" type="date" required defaultValue={date} max={new Date().toISOString().slice(0,10)}/></label>
 <label>Notes<textarea name="note" required maxLength={4000} rows={3} placeholder="What did you find or complete?"/></label>
 <label>Photos & completed paperwork<input type="file" name="attachments" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.txt"/><small>Up to 5 files · 8 MB total. Earlier uploads stay on record.</small></label>
 <label>Document expiration (optional)<input type="date" name="documentExpiresOn"/></label>
 {error?<p role="alert">{error}</p>:null}<button type="submit" disabled={busy}>{busy?"Submitting…":"Submit inspection"}</button><small>Submitted results go to maintenance for review.</small>
 </form>;
}
