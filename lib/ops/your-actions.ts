import type { AttentionAccess, AttentionQueueRow } from "./attention-query";
import type { OpsRepository, OrganizationScope } from "./repository";

const otherKind = (row: AttentionQueueRow) =>
  row.sourceKind === "inspection_review" ? "inspection sign-off"
  : row.sourceKind === "exception" ? "record to check"
  : row.sourceKind === "vendor_reminder" ? "vendor follow-up"
  : row.sourceKind === "quote_round" ? "quote round"
  : row.sourceKind === "held_work" ? "next-visit item"
  : row.taskType === "other" ? "task" : "follow-up";

const SHOWN = 100;

/**
 * "Needs your action" and what it is made of, e.g. 14 = "8 in Review · 1 task · 5 follow-ups".
 * Two bounded reads whatever the queue size: an exact count of your items in Review, and your items outside
 * Review (named by kind; past the first 100 they are counted as "other items"). The tile shows their sum,
 * so the number and its parts always come from the same reads.
 */
export async function yourActionBreakdown(repository: OpsRepository, scope: OrganizationScope, access: AttentionAccess, asOf: string) {
  const [inReview, outside] = await Promise.all([
    repository.listAttention(scope, access, { asOf, lane: "mine", stage: "decide", limit: 1 }),
    repository.listAttention(scope, access, { asOf, lane: "mine", stage: "outside_review", limit: SHOWN }),
  ]);
  const kinds = new Map<string, number>();
  for (const row of outside.items) kinds.set(otherKind(row), (kinds.get(otherKind(row)) ?? 0) + 1);
  const unnamed = outside.totalCount - outside.items.length;
  const plural = (n: number, kind: string) => `${n} ${kind}${n === 1 ? "" : "s"}`;
  const parts = [
    ...(inReview.totalCount ? [`${inReview.totalCount} in Review`] : []),
    ...[...kinds].map(([kind, n]) => plural(n, kind)),
    ...(unnamed > 0 ? [plural(unnamed, "other item")] : []),
  ];
  return { total: inReview.totalCount + outside.totalCount, text: parts.join(" · ") };
}
