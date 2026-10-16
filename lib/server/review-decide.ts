import "server-only";
import { attentionAccess } from "@/app/app/_data/attention-presenter";
import type { OperatorSession } from "@/components/ops/data-contract";
import type { OpsRepository } from "@/lib/ops/repository";
import type { AttentionQueueRow } from "@/lib/ops/attention-query";

export type DecideStage = "new" | "stuck" | "done";
export interface DecideRow extends AttentionQueueRow { problem?: string; reportedAt?: string; /** The technician who found this problem on site, when a tech reported it. */ foundBy?: string; /** Other open items on the same job, shown on one row. */ alsoNeeds?: string[]; /** When a stuck job last stopped: the unfinished result a technician recorded. */ stuckSince?: string }
export interface DecideSection { stage: DecideStage; rows: DecideRow[]; totalCount: number }
/** A problem a technician found and sent to a manager, still waiting for someone to choose who handles it. */
export interface SentRow { id: string; number: string; problem: string; storeLabel: string; foundBy: string; reportedAt: string; dueAt?: string }

const OPEN_STATUSES = ["awaiting_approval", "approved", "issued", "accepted", "scheduled", "in_progress", "waiting_on_parts", "waiting_on_vendor"];

const SECTION_LIMIT = 10;

/** The three Review sections a manager works from: New, Stuck and Done (needs a check). */
export async function loadReviewDecide(repository: OpsRepository, session: OperatorSession, asOf: string, store?: string) {
  const scope = { organizationId: session.organizationId, storeIds: session.storeIds, regionIds: session.regionIds };
  const access = attentionAccess(session);
  const names = new Map<string, Promise<string | undefined>>();
  const nameOf = (membershipId: string) => {
    if (!names.has(membershipId)) names.set(membershipId, repository.getMembership(session.organizationId, membershipId).then(m => m ? repository.getUserInOrganization(session.organizationId, m.userId) : null).then(u => u?.displayName));
    return names.get(membershipId)!;
  };
  const [sections, all, found] = await Promise.all([
    Promise.all((["new", "stuck", "done"] as const).map(async stage => {
      const page = await repository.listAttention(scope, access, { asOf, stage, store, limit: SECTION_LIMIT });
      const rows = await Promise.all(page.items.map(async row => {
        const work = row.workOrderId ? await repository.getWorkOrder(session.organizationId, row.workOrderId) : null;
        const request = !work && row.serviceRequestId ? await repository.getRequest(session.organizationId, row.serviceRequestId) : null;
        // "Store 114 · North Market" reads faster than "Store 114 · Clark Pump and Shop - North Market".
        const storeLabel = row.storeLabel?.replace(`${session.organizationName} - `, "");
        const latest = stage === "stuck" && work ? (await repository.listWorkResults(session.organizationId, work.id))[0] : undefined;
        const stuckSince = latest && !["completed", "no_issue_found"].includes(latest.outcome) ? latest.outcomeRecordedAt : undefined;
        return { ...row, storeLabel, problem: work?.problem ?? request?.problem, reportedAt: work?.createdAt ?? request?.submittedAt, stuckSince, foundBy: work?.foundByMembershipId ? await nameOf(work.foundByMembershipId) ?? "a technician" : undefined };
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
    repository.listWorkOrders(scope, { foundByTechnician: true, statuses: OPEN_STATUSES, limit: 50 }),
  ]);
  const wanted = store?.trim().toLowerCase();
  const sentJobs = found.items.filter(job => job.assignmentKind === "choose_later"
    && (!wanted || job.storeNumber.toLowerCase() === wanted || job.storeName.toLowerCase().includes(wanted)))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const sent: SentRow[] = await Promise.all(sentJobs.map(async job => ({
    id: job.id, number: job.number, problem: job.shortName ?? job.problem, reportedAt: job.createdAt, dueAt: job.dueAt,
    storeLabel: `Store ${job.storeNumber} · ${job.storeName.replace(`${session.organizationName} - `, "")}`,
    foundBy: await nameOf(job.foundByMembershipId!) ?? "a technician",
  })));
  // Sent problems lead Review in their own section, so New lists the rest.
  const sentIds = new Set(sent.map(row => row.id));
  for (const section of sections) if (section.stage === "new") {
    const before = section.rows.length;
    section.rows = section.rows.filter(row => !row.workOrderId || !sentIds.has(row.workOrderId));
    section.totalCount = Math.max(section.rows.length, section.totalCount - Math.max(before - section.rows.length, sentIds.size));
  }
  return { sections, sent, allOpenCount: all.totalCount };
}
