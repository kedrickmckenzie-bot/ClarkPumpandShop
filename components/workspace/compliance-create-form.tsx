"use client";
import { InspectionAssigneePicker } from "./inspection-assignee-picker";
import { StorePicker } from "@/components/ops/store-picker";
import { useState } from "react";
import styles from "./compliance.module.css";
export function ComplianceCreateForm({stores,defaultStoreId}:{defaultStoreId?:string;stores:Array<{id:string;storeNumber:string;name:string;formattedAddress?:string}>}) {
 const [storeId,setStoreId]=useState(defaultStoreId??""),[unit,setUnit]=useState("months");
 return <form action="/api/ops/compliance" method="post" encType="multipart/form-data" className={styles.form}>
 <input type="hidden" name="action" value="create"/>
 <label>Inspection or renewal name<input name="name" required maxLength={160} placeholder="e.g. Fire extinguisher inspection"/></label>
 <div className={styles.pair}><StorePicker onSelect={setStoreId} searchable defaultStoreId={defaultStoreId} initial={stores.map(s=>({value:s.id,label:`Store ${s.storeNumber} · ${s.name}`,description:s.formattedAddress}))}/><label>Type<select name="kind"><option value="inspection">Inspection</option><option value="permit">Permit / renewal</option></select></label></div>
 <div className={styles.pair}><label>First due date<input type="date" name="firstDueDate" required/></label><label>Repeat<select name="intervalUnit" value={unit} onChange={e=>setUnit(e.target.value)}><option value="once">One time</option><option value="days">Every number of days</option><option value="months">Every number of months</option></select></label></div>
 {unit!=="once"?<label>Every<input type="number" name="intervalCount" min="1" max="365" defaultValue="12" required/><small>{unit} · Monthly = 1 month; annual = 12 months</small></label>:<input type="hidden" name="intervalCount" value="1"/>}
 <InspectionAssigneePicker key={storeId} storeId={storeId}/>
 <label>Prepare and remind this many days before due<input type="number" name="leadDays" min="0" max="90" defaultValue="30" required/><small>The assignee receives a work order with a secure inspection link. Open items get weekly reminders.</small></label>
 <label>Instructions & blank forms (optional)<input type="file" name="templates" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.txt"/><small>Included with each inspection work order. Download, print and upload the completed copy. Up to 5 files · 8 MB total.</small></label>
 <label>Required evidence<input name="evidenceLabel" required maxLength={300} defaultValue="Inspection report or photos"/></label>
 <label>Paperwork required to close?<select name="evidenceRequired" defaultValue="1"><option value="1">Yes</option><option value="0">No — result and notes are enough</option></select></label>
 <details><summary>Instructions, requirement and escalation</summary><div className={styles.form}>
 <label>Instructions<textarea name="instructions" rows={3} maxLength={4000}/></label>
 <label>Requirement / reference<input name="requirementSource" maxLength={500} placeholder="Agency, permit, company policy or reference URL"/></label>
 <label>Equipment tag (optional)<input name="assetTag" maxLength={100}/><small>Leave blank for a store-wide inspection.</small></label>
 <div className={styles.pair}><label>Escalate days before due<input name="escalationDays" type="number" min="0" max="90" defaultValue="0"/></label><label>Escalation owner<input name="escalationTo" defaultValue="Facilities coordinator" required maxLength={160}/></label></div><small>Escalations notify the facilities team and identify this owner.</small>
 </div></details><button type="submit">Create schedule</button>
 </form>;
}
