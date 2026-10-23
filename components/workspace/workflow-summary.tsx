import Link from "next/link";
import type { OperatorSession } from "@/components/ops/data-contract";
import type { OpsRepository } from "@/lib/ops/repository";
import { attentionAccess } from "@/app/app/_data/attention-presenter";
import { internalDispatchScope } from "@/lib/server/internal-dispatch-context";
import styles from "./workflow-summary.module.css";
export async function WorkflowSummary({
  session,
  repository,
}: {
  session: OperatorSession;
  repository: OpsRepository;
}) {
  if (!["facilities", "regional", "executive"].includes(session.role))
    return null;
  // Review counts use the same scope as the Review page and Overview tiles, so the numbers agree.
  const scope = { organizationId: session.organizationId, storeIds: session.storeIds, regionIds: session.regionIds },
    dispatchScope = await internalDispatchScope(repository, session),
    asOf = new Date().toISOString(),
    access = attentionAccess(session);
  // Managers see the to-do number on the Overview tile; the owner sees it here: only what needs the owner (Review's Mine).
  const owner = session.role === "executive";
  const [review, needs, waiting] = await Promise.all([
    owner ? repository.listAttention(scope, access, { asOf, stage: "decide", lane: "mine", limit: 1 }) : Promise.resolve(undefined),
    repository.listWorkOrders(dispatchScope, {
      internalOnly: true,
      maintenanceTeamOnly: true,
      dispatchQueue: true,
      dispatchReadiness: "ready",
      excludeHeld: true,
      statuses: ["approved", "issued", "accepted", "scheduled"],
      limit: 1,
    }),
    repository.countWorkOrders(scope, { stage: "vendor-or-parts" }),
  ]);
  return (
    <nav aria-label="Work to arrange" className={styles.lines}>
      {review ? <Link href="/app/action-center?view=mine">
        <strong>{review.totalCount}</strong> to do <span>Review →</span>
      </Link> : null}
      <Link href="/app/dispatch?view=plan">
        <strong>{needs.totalCount ?? 0}</strong> need a tech{" "}
        <span>Dispatch →</span>
      </Link>
      <Link href="/app/work-orders?stage=vendor-or-parts">
        <strong>{waiting}</strong> waiting on a vendor or parts{" "}
        <span>Work orders →</span>
      </Link>
    </nav>
  );
}
