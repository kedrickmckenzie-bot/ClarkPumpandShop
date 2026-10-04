"use client";
import { useState } from "react";
import type { InternalSchedule } from "@/lib/ops/internal-schedule-types";
import styles from "./internal-dispatch.module.css";

export function InternalScheduleFields({plan,manager,storeZone,planningZone,date,today,waiting}:{plan?:InternalSchedule|null;manager:boolean;storeZone:string;planningZone:string;date:string;today:string;waiting:boolean}) {
  const [precision,setPrecision]=useState(plan?.precision==="removed"?"day":plan?.precision??"day");
  const [tentative,setTentative]=useState(plan?.tentative??waiting);
  const [calendarValue,setCalendarValue]=useState(plan?.day??plan?.week??date);
  return <div className={styles.form}>
    <button type="button" onClick={()=>{setPrecision("week");setCalendarValue(today);}}>This week</button>
    <label>When?<select name="precision" value={precision} onChange={event=>setPrecision(event.target.value as typeof precision)}><option value="week">Choose week</option><option value="day">Choose day · Anytime</option>{manager?<option value="appointment">Appointment</option>:null}</select></label>
    {precision==="appointment"?<>
      <label>Store appointment · {storeZone}<input type="datetime-local" name="localStart" required defaultValue={plan?.localStart}/></label>
      <label>If the clocks repeat this time<select name="disambiguation" defaultValue={plan?.disambiguation??""}><option value="">Ask me if this time occurs twice</option><option value="earlier">Earlier occurrence</option><option value="later">Later occurrence</option></select></label>
    </>:<label>{precision==="week"?"Week containing this date":"Planned day"} · {planningZone}<input type="date" name="date" required value={calendarValue} onChange={event=>setCalendarValue(event.target.value)}/></label>}
    <label>Estimated repair minutes (optional)<input type="number" name="durationMinutes" min={1} max={1440} step={1} defaultValue={plan?.durationMinutes}/></label>
    <p className={styles.muted}>Leave unknown estimates blank. They cannot establish appointment availability.</p>
    {manager?<><label><input type="checkbox" name="tentative" value="yes" checked={tentative} onChange={event=>setTentative(event.target.checked)}/> Tentative · waiting for a required action</label>{tentative?<label>Review reason<textarea name="reviewReason" required rows={2} maxLength={1000} defaultValue={plan?.reviewReason}/></label>:null}</>:null}
    <label><input type="checkbox" name="keepConflicts" value="yes"/> Keep this plan after reviewing target or appointment warnings</label>
    <button type="submit">Save schedule</button>
  </div>;
}
