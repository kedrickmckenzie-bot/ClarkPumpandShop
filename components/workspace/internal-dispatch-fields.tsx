import { randomUUID } from "node:crypto";
import type { WorkOrderListRow } from "@/lib/ops/view-models";

/** Hidden fields that stop a save from overwriting someone else's newer change. */
export function DispatchVersionFields({ row, returnTo }: { row: Pick<WorkOrderListRow, "version" | "assignmentId">; returnTo: string }) {
  return <>
    <input type="hidden" name="expectedVersion" value={row.version ?? 0}/>
    <input type="hidden" name="expectedAssignmentId" value={row.assignmentId ?? ""}/>
    <input type="hidden" name="submissionKey" value={randomUUID()}/>
    <input type="hidden" name="returnTo" value={returnTo}/>
  </>;
}
