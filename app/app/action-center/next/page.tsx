import Link from "next/link";
import { redirect } from "next/navigation";
import { loadListModel, loadReviewSelection } from "../../_data/operator-loader";
import { safeReviewQueue, selectNextReview } from "@/lib/ops/review-navigation";

export default async function NextReviewPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const queueHref = safeReviewQueue(params.queue);
  const queue = new URL(queueHref, "https://ops.invalid");
  const query = Object.fromEntries(queue.searchParams);
  const following=params.following ?? params.preferred;
  const selection=await loadReviewSelection(query,(following??"").split(",").filter(id=>id.length>0&&id.length<=200).slice(0,25));
  const next = selectNextReview(selection.table.rows, params.previous, following);
  if (next) redirect(next.href);
  const model = await loadListModel("action-center", query);
  return <div><h1>Review saved</h1><p>No more items remain in this selection.</p><Link href={queueHref}>Return to your review queue</Link>{model.pagination?.nextHref ? <p><Link href={model.pagination.nextHref}>Continue to the next page</Link></p> : null}</div>;
}
