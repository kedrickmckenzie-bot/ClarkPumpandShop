import type { OperatorSession } from "@/components/ops/data-contract";
import type { WorkOrderListPage } from "@/lib/ops/view-models";
import { InternalJobSection } from "./internal-job-list";
import styles from "./internal-dispatch.module.css";

export { DispatchVersionFields } from "./internal-dispatch-fields";

/** A single job list, used where one queue is shown on its own. */
export function InternalDispatchWorkspace({ session, page, view, technician, heading, nextHref }: {
  session: OperatorSession; page: WorkOrderListPage; view: string; search?: string; technician: boolean; heading?: string; nextHref?: string;
}) {
  const base = technician ? "/app/my-work" : "/app/dispatch";
  return <div className={styles.workspace}>
    <InternalJobSection title={heading ?? (technician ? "My jobs" : "Team jobs")} page={page} session={session} technician={technician}
      returnTo={`${base}?view=${encodeURIComponent(view)}`} nextHref={nextHref}/>
  </div>;
}
