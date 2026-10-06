import type { AttentionAccess, AttentionQueueRow } from "./attention-query";
import type { OpsRepository, OrganizationScope } from "./repository";

const otherKind = (row: AttentionQueueRow) =>
  row.sourceKind === "inspection_review" ? "inspection sign-off"
  : row.sourceKind === "exception" ? "record to check"
  : row.sourceKind === "vendor_reminder" ? "vendor follow-up"
  : row.sourceKind === "quote_round" ? "quote round"
  : row.sourceKind === "held_work" ? "next-visit item"
  : row.taskType === "other" ? "task" : "follow-up";

/** "8 in Review · 1 task · 1 inspection sign-off": the parts always add up to the "Needs your action" number. */
export async function yourActionBreakdown(repository: OpsRepository, scope: OrganizationScope, access: AttentionAccess, asOf: string) {
  const [mine, inReview] = await Promise.all([
    repository.listAttention(scope, access, { asOf, lane: "mine", limit: 200 }),
    repository.listAttention(scope, access, { asOf, lane: "mine", stage: "decide", limit: 200 }),
  ]);
  const reviewIds = new Set(inReview.items.map(row => row.id));
  const others = new Map<string, number>();
  for (const row of mine.items) if (!reviewIds.has(row.id)) others.set(otherKind(row), (others.get(otherKind(row)) ?? 0) + 1);
  const parts = [...(inReview.totalCount ? [`${inReview.totalCount} in Review`] : []), ...[...others].map(([kind, n]) => `${n} ${kind}${n === 1 ? "" : "s"}`)];
  return parts.join(" · ");
}
