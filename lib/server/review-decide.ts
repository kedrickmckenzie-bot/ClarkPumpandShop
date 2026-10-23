import "server-only";
import { attentionAccess } from "@/app/app/_data/attention-presenter";
import type { OperatorSession } from "@/components/ops/data-contract";
import type { OpsRepository } from "@/lib/ops/repository";
import { attentionSortKey, compareAttentionKeys, type AttentionQueueRow } from "@/lib/ops/attention-query";
import { reviewBucket, waitingOn, type ReviewBucket } from "@/lib/ops/review-buckets";

export type DecideStage = "new" | "stuck" | "done";
export interface DecideRow extends AttentionQueueRow {
  problem?: string; reportedAt?: string;
  /** The technician who found this problem on site, when a tech reported it. */ foundBy?: string;
  /** Other open items on the same job, shown on one row. */ alsoNeeds?: string[];
  /** When a stuck job last stopped: the unfinished result a technician recorded. */ stuckSince?: string;
}
/** A Review item with where it belongs for this person and who it waits on. */
export interface ReviewItem extends DecideRow { stage: DecideStage; bucket: ReviewBucket; waitingOn: string; waitingSince?: string }
export interface DecideSection { stage: DecideStage; rows: ReviewItem[]; totalCount: number }
/** A problem a technician found and sent to a manager, still waiting for someone to choose who handles it. */
export interface SentRow { id: string; number: string; problem: string; storeLabel: string; foundBy: string; reportedAt: string; dueAt?: string }
export interface StoreGroup { storeId: string; storeLabel: string; rows: ReviewItem[]; oldest?: string }

const OPEN_STATUSES = ["awaiting_approval", "approved", "issued", "accepted", "scheduled", "in_progress", "waiting_on_parts", "waiting_on_vendor"];
const PAGE = 100, MAX_PAGES = 10;
const STAGES = ["new", "stuck", "done"] as const;

/** Mine is exactly the "assigned to me" items, so the sidebar, Overview and Review always show the same number. */
export async function reviewMineCount(repository: OpsRepository, session: OperatorSession, asOf: string) {
  const scope = { organizationId: session.organizationId, storeIds: session.storeIds, regionIds: session.regionIds };
  const [mine, all] = await Promise.all([
    repository.listAttention(scope, attentionAccess(session), { asOf, stage: "decide", lane: "mine", limit: 1 }),
    repository.listAttention(scope, attentionAccess(session), { asOf, stage: "decide", limit: 1 }),
  ]);
  return { mine: mine.totalCount, stores: Math.max(0, all.totalCount - mine.totalCount) };
}

/**
 * Review for a manager: what needs them (Mine), and everything else open in their stores, sorted into what they can
 * help with from anywhere, what needs someone at the store, and what is waiting on others.
 */
export async function loadReviewDecide(repository: OpsRepository, session: OperatorSession, asOf: string, store?: string) {
  const org = session.organizationId;
  const scope = { organizationId: org, storeIds: session.storeIds, regionIds: session.regionIds };
  const access = attentionAccess(session);
  const names = new Map<string, Promise<string | undefined>>();
  const nameOf = (membershipId: string) => {
    if (!names.has(membershipId)) names.set(membershipId, repository.getMembership(org, membershipId).then(m => m ? repository.getUserInOrganization(org, m.userId) : null).then(u => u?.displayName));
    return names.get(membershipId)!;
  };
  const shortStore = (label?: string) => label?.replace(`${session.organizationName} - `, "");

  const pages = async (stage: DecideStage) => {
    const rows: AttentionQueueRow[] = [];
    let cursor: string | undefined;
    for (let i = 0; i < MAX_PAGES; i++) {
      const page = await repository.listAttention(scope, access, { asOf, stage, store, limit: PAGE, cursor });
      rows.push(...page.items);
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
    return rows;
  };

  const [staged, found] = await Promise.all([
    Promise.all(STAGES.map(async stage => (await pages(stage)).map(row => ({ row, stage })))),
    repository.listWorkOrders(scope, { foundByTechnician: true, statuses: OPEN_STATUSES, limit: 50 }),
  ]);

  const items: ReviewItem[] = await Promise.all(staged.flat().map(async ({ row, stage }) => {
    const [work, task, inspection] = await Promise.all([
      row.workOrderId ? repository.getWorkOrder(org, row.workOrderId) : null,
      row.sourceKind === "workflow_task" ? repository.getWorkflowTask(org, row.id) : null,
      // A result check on an inspection's job is reviewing findings and paperwork, not a site visit.
      row.workOrderId && row.taskType && ["verify_repair", "record_service_outcome"].includes(row.taskType) ? repository.inspectionForWork(org, row.workOrderId) : null,
    ]);
    const request = !work && row.serviceRequestId ? await repository.getRequest(org, row.serviceRequestId) : null;
    const latest = stage === "stuck" && work ? (await repository.listWorkResults(org, work.id))[0] : undefined;
    const stuckSince = latest && !["completed", "no_issue_found"].includes(latest.outcome) ? latest.outcomeRecordedAt : undefined;
    const assignee = task ? { assigneeType: task.assigneeType, assigneeRole: task.assigneeRole } : undefined;
    return {
      ...row, stage, storeLabel: shortStore(row.storeLabel),
      problem: work?.problem ?? request?.problem, reportedAt: work?.createdAt ?? request?.submittedAt, stuckSince,
      foundBy: work?.foundByMembershipId ? await nameOf(work.foundByMembershipId) ?? "a technician" : undefined,
      // A store manager acts only on their own items; everything else at their store is shown as who it waits on.
      bucket: access.role === "store_manager" && row.lane !== "mine" ? "waiting" : reviewBucket({ lane: row.lane, taskType: row.taskType, assignee, inspectionReview: Boolean(inspection) || row.linkHref.startsWith("/app/compliance/") }, access.role),
      waitingOn: waitingOn(row.owner, assignee),
      waitingSince: task?.createdAt ?? work?.createdAt ?? request?.submittedAt,
    };
  }));

  // One row per job and place: a second open item on the same job joins the first row.
  const merge = (rows: ReviewItem[]) => {
    const out: ReviewItem[] = [];
    for (const row of [...rows].sort((a, b) => compareAttentionKeys(attentionSortKey(a, asOf), attentionSortKey(b, asOf)))) {
      const same = row.workOrderId ? out.find(item => item.workOrderId === row.workOrderId) : undefined;
      if (same) same.alsoNeeds = [...(same.alsoNeeds ?? []), row.title];
      else out.push({ ...row });
    }
    return out;
  };
  const inBucket = (bucket: ReviewBucket) => items.filter(item => item.bucket === bucket);

  // Problems techs found lead Mine for whoever decides who handles them.
  const wanted = store?.trim().toLowerCase();
  const sentJobs = found.items.filter(job => job.assignmentKind === "choose_later"
    && (!wanted || job.storeId === store || job.storeNumber.toLowerCase() === wanted || job.storeName.toLowerCase().includes(wanted)))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const mineJobIds = new Set(inBucket("mine").map(item => item.workOrderId).filter(Boolean));
  const sent: SentRow[] = await Promise.all(sentJobs.filter(job => mineJobIds.has(job.id)).map(async job => ({
    id: job.id, number: job.number, problem: job.shortName ?? job.problem, reportedAt: job.createdAt, dueAt: job.dueAt,
    storeLabel: `Store ${job.storeNumber} · ${shortStore(job.storeName)}`,
    foundBy: await nameOf(job.foundByMembershipId!) ?? "a technician",
  })));
  const sentIds = new Set(sent.map(row => row.id));

  const mineRows = merge(inBucket("mine").filter(item => !item.workOrderId || !sentIds.has(item.workOrderId)));
  const sections: DecideSection[] = STAGES.map(stage => {
    const rows = mineRows.filter(row => row.stage === stage);
    return { stage, rows, totalCount: rows.reduce((n, row) => n + 1 + (row.alsoNeeds?.length ?? 0), 0) };
  });

  const onsite = merge(inBucket("onsite"));
  const groups = new Map<string, StoreGroup>();
  for (const row of onsite) {
    const key = row.storeId ?? "companywide";
    const group = groups.get(key) ?? { storeId: key, storeLabel: row.storeLabel ?? "Companywide", rows: [] };
    group.rows.push(row);
    if (row.waitingSince && (!group.oldest || row.waitingSince < group.oldest)) group.oldest = row.waitingSince;
    groups.set(key, group);
  }
  const onsiteByStore = [...groups.values()].sort((a, b) => b.rows.length - a.rows.length || (a.oldest ?? "").localeCompare(b.oldest ?? "") || a.storeLabel.localeCompare(b.storeLabel));

  const counts = { mine: inBucket("mine").length, help: inBucket("help").length, onsite: inBucket("onsite").length, waiting: inBucket("waiting").length };
  return {
    sections, sent, help: merge(inBucket("help")), onsiteByStore, waiting: merge(inBucket("waiting")),
    counts: { ...counts, stores: counts.help + counts.onsite + counts.waiting },
    allOpenCount: items.length,
  };
}
