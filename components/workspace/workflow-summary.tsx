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
  const [review, needs, stuck, overdue, waiting] = await Promise.all([
    repository.listAttention(scope, access, { asOf, stage: "decide", limit: 1 }),
    repository.listWorkOrders(dispatchScope, {
      internalOnly: true,
      maintenanceTeamOnly: true,
      dispatchQueue: true,
      dispatchReadiness: "ready",
      excludeHeld: true,
      statuses: ["approved", "issued", "accepted", "scheduled"],
      limit: 1,
    }),
    repository.listAttention(scope, access, { asOf, stage: "stuck", limit: 1 }),
    repository.listAttention(scope, access, {
      asOf,
      stage: "confirmation_overdue",
      limit: 1,
    }),
    repository.countWorkOrders(scope, { stage: "vendor-or-parts" }),
  ]);
  return (
    <nav aria-label="Work to arrange" className={styles.lines}>
      <Link href="/app/action-center">
        <strong>{review.totalCount}</strong> to review <span>Review →</span>
      </Link>
      <Link href="/app/dispatch?view=plan">
        <strong>{needs.totalCount ?? 0}</strong> need a tech{" "}
        <span>Dispatch →</span>
      </Link>
      <Link href="/app/action-center?lane=all&stage=stuck">
        <strong>{stuck.totalCount}</strong> stuck <span>Review →</span>
      </Link>
      <Link href="/app/action-center?lane=all&stage=confirmation_overdue">
        <strong>{overdue.totalCount}</strong> confirmations overdue{" "}
        <span>Review →</span>
      </Link>
      <Link href="/app/work-orders?stage=vendor-or-parts">
        <strong>{waiting}</strong> waiting on a vendor or parts{" "}
        <span>Work orders →</span>
      </Link>
    </nav>
  );
}
