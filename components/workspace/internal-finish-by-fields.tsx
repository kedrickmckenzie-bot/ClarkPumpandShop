import { cachedDateTimeFormat } from "@/lib/ops/intl-format-cache";
import { friendlyZone } from "@/lib/ops/dispatch-board";

export function InternalFinishByFields({ value, storeZone, organizationZone }: { value?: string; storeZone: string; organizationZone: string }) {
  const local = value ? cachedDateTimeFormat("sv-SE", { timeZone: storeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value)).replace(" ", "T") : undefined;
  return <>
    <label>Finish by{storeZone !== organizationZone ? ` (${friendlyZone(storeZone)})` : ""}<input type="datetime-local" name="localTarget" defaultValue={local}/></label>
    <p>Leave blank to remove it. The planned date stays the same.</p>
    <details><summary>Clocks change that night?</summary><label>If this time happens twice<select name="disambiguation" defaultValue=""><option value="">Ask me</option><option value="earlier">The first time</option><option value="later">The second time</option></select></label></details>
    <label>Why?<textarea name="reason" required rows={2} maxLength={1000}/></label><button type="submit">Save finish-by date</button>
  </>;
}
