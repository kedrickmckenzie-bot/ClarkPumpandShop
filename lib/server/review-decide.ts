import "server-only";
import { attentionAccess } from "@/app/app/_data/attention-presenter";
import type { OperatorSession } from "@/components/ops/data-contract";
import type { OpsRepository } from "@/lib/ops/repository";
import type { AttentionQueueRow } from "@/lib/ops/attention-query";

export type DecideStage = "new" | "stuck" | "done";
export interface DecideRow extends AttentionQueueRow { problem?: string; reportedAt?: string; /** Other open items on the same job, shown on one row. */ alsoNeeds?: string[] }
export interface DecideSection { stage: DecideStage; rows: DecideRow[]; totalCount: number }

const SECTION_LIMIT = 10;

/** The three Review sections a manager works from: New, Stuck and Done (needs a check). */
export async function loadReviewDecide(repository: OpsRepository, session: OperatorSession, asOf: string, store?: string) {
  const scope = { organizationId: session.organizationId, storeIds: session.storeIds, regionIds: session.regionIds };
  const access = attentionAccess(session);
  const [sections, all] = await Promise.all([
    Promise.all((["new", "stuck", "done"] as const).map(async stage => {
      const page = await repository.listAttention(scope, access, { asOf, stage, store, limit: SECTION_LIMIT });
      const rows = await Promise.all(page.items.map(async row => {
        const work = row.workOrderId ? await repository.getWorkOrder(session.organizationId, row.workOrderId) : null;
        const request = !work && row.serviceRequestId ? await repository.getRequest(session.organizationId, row.serviceRequestId) : null;
        // "Store 114 · North Market" reads faster than "Store 114 · Clark Pump and Shop - North Market".
        const storeLabel = row.storeLabel?.replace(`${session.organizationName} - `, "");
        return { ...row, storeLabel, problem: work?.problem ?? request?.problem, reportedAt: work?.createdAt ?? request?.submittedAt };
      }));
      // One row per job: a second open item on the same job joins the first row.
      const merged: DecideRow[] = [];
      for (const row of rows) {
        const same = row.workOrderId ? merged.find(item => item.workOrderId === row.workOrderId) : undefined;
        if (same) same.alsoNeeds = [...(same.alsoNeeds ?? []), row.title];
        else merged.push(row);
      }
      return { stage, rows: merged, totalCount: page.totalCount } satisfies DecideSection;
    })),
    repository.listAttention(scope, access, { asOf, store, limit: 1 }),
  ]);
  return { sections, allOpenCount: all.totalCount };
}
