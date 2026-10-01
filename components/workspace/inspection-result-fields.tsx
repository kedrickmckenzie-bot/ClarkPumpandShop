"use client";
import { useState } from "react";
import styles from "./compliance.module.css";

/** Result choice; corrective work is offered only when the result is Failed. */
export function InspectionResultFields({ defaultStatus, canReview, canCreateCorrection, defaultDate, today }: { defaultStatus: string; canReview: boolean; canCreateCorrection: boolean; defaultDate: string; today: string }) {
  const [status, setStatus] = useState(defaultStatus);
  return <>
    <div className={styles.pair}>
      <label>Result<select name="status" value={status} onChange={(event) => setStatus(event.target.value)}>
        <option value="performed">Performed — paperwork / review pending</option>
        <option value="action_needed">Failed / corrective action needed</option>
        {canReview ? <option value="passed">Passed — reviewed and close</option> : null}
      </select></label>
      <label>Performed date<input type="date" name="performedDate" required defaultValue={defaultDate} max={today}/></label>
    </div>
    {canCreateCorrection && status === "action_needed" ? <label><input type="checkbox" name="createCorrection"/> Create corrective work for this finding</label> : null}
  </>;
}
