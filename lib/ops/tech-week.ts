import type { WorkOrderListRow } from "./view-models";
import type { WorkResult } from "./types";

/** Why a technician's job can't move, in the order the "No day yet" list shows them. */
export type StuckReason = "parts" | "vendor" | "approval" | "help" | "manager";
export const STUCK_GROUPS: { reason: StuckReason; label: string }[] = [
  { reason: "parts", label: "Parts" },
  { reason: "vendor", label: "Vendor" },
  { reason: "approval", label: "Approval" },
  { reason: "help", label: "Needs help" },
  { reason: "manager", label: "Sent to manager" },
];

export interface StuckJob { job: WorkOrderListRow; reason: StuckReason; since: string; note?: string }

/** The reason a job assigned to the tech is held up, or undefined when nothing blocks it. */
export function stuckReason(job: WorkOrderListRow, latest?: WorkResult): StuckReason | undefined {
  if (job.status === "waiting_on_parts") return "parts";
  if (job.status === "waiting_on_vendor") return "vendor";
  if (job.status === "awaiting_approval") return "approval";
  if (!job.hasOpenFollowUp) return undefined;
  // An unfinished result leaves a follow-up open; its blocker says what the tech is waiting for.
  if (latest?.blocker === "parts") return "parts";
  if (latest?.blocker === "vendor") return "vendor";
  return "help";
}

/** When the job became stuck: the result that stopped it, else its last change. */
export function stuckSince(job: WorkOrderListRow, latest?: WorkResult) {
  return latest && !["completed", "no_issue_found"].includes(latest.outcome) ? latest.outcomeRecordedAt : job.updatedAt ?? job.createdAt;
}

/** Longest-stuck first, grouped in the fixed reason order; empty groups are dropped. */
export function groupStuck(jobs: StuckJob[]) {
  return STUCK_GROUPS.map(group => ({ ...group, jobs: jobs.filter(j => j.reason === group.reason).sort((a, b) => a.since.localeCompare(b.since) || a.job.id.localeCompare(b.job.id)) }))
    .filter(group => group.jobs.length);
}

/** "today", "1 day", "5 days" — whole calendar days between two ISO instants. */
export function stuckFor(since: string, now: string) {
  const days = Math.max(0, Math.floor((Date.parse(now) - Date.parse(since)) / 86_400_000));
  return days === 0 ? "since today" : days === 1 ? "1 day" : `${days} days`;
}
