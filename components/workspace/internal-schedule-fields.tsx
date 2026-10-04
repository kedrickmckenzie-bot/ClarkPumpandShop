"use client";
import { useState } from "react";
import type { InternalSchedule } from "@/lib/ops/internal-schedule-types";
import styles from "./internal-dispatch.module.css";

export function InternalScheduleFields({plan,manager,storeZone,planningZone,date,today,waiting}:{plan?:InternalSchedule|null;manager:boolean;storeZone:string;planningZone:string;date:string;today:string;waiting:boolean}) {
  const [precision,setPrecision]=useState(plan?.precision==="removed"?"day":plan?.precision??"day");
  const [tentative,setTentative]=useState(plan?.tentative??waiting);
  const [calendarValue,setCalendarValue]=useState(plan?.day??plan?.week??date);
  return <div className={styles.form}>
        <label>When?<select name="precision" value={precision} onChange={event=>setPrecision(event.target.value as typeof precision)}><option value="day">On a day (any time)</option><option value="week">Sometime that week</option>{manager?<option value="appointment">At a set time</option>:null}</select></label>
    {precision==="week"?<p><button type="button" className={styles.linkButton} onClick={()=>setCalendarValue(today)}>Use this week</button></p>:null}
    {precision==="appointment"?<>
      <label>Date and time (store time{storeZone!==planningZone?`, ${storeZone.split("/").pop()!.replaceAll("_"," ")}`:""})<input type="datetime-local" name="localStart" required defaultValue={plan?.localStart}/></label>
      <details><summary>Clocks change that night?</summary><label>If this time happens twice<select name="disambiguation" defaultValue={plan?.disambiguation??""}><option value="">Ask me</option><option value="earlier">The first time</option><option value="later">The second time</option></select></label></details>
    </>:<label>{precision==="week"?"Any day in that week":"Day"}<input type="date" name="date" required value={calendarValue} onChange={event=>setCalendarValue(event.target.value)}/></label>}
    <label>About how long will it take? (minutes, optional)<input type="number" name="durationMinutes" min={1} max={1440} step={1} defaultValue={plan?.durationMinutes}/></label>
    <p className={styles.muted}>Leave blank if you&apos;re not sure.</p>
    {manager?<><label><input type="checkbox" name="tentative" value="yes" checked={tentative} onChange={event=>setTentative(event.target.checked)}/> Not confirmed yet (waiting on something)</label>{tentative?<label>Waiting on what?<textarea name="reviewReason" required rows={2} maxLength={1000} defaultValue={plan?.reviewReason}/></label>:null}</>:null}
    <label><input type="checkbox" name="keepConflicts" value="yes"/> Save even if there is a date warning</label>
    <button type="submit">Save date</button>
  </div>;
}
