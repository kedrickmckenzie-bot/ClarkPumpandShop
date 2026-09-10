import Link from "next/link";
import { redirect } from "next/navigation";
import { loadListModel } from "../../_data/operator-loader";
import { safeReviewQueue, selectNextReview } from "@/lib/ops/review-navigation";

export default async function NextReviewPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const queueHref = safeReviewQueue(params.queue);
  const queue = new URL(queueHref, "https://ops.invalid");
  const query = Object.fromEntries(queue.searchParams);
  const model = await loadListModel("action-center", query);
  const next = selectNextReview(model.table.rows, params.previous, params.following ?? params.preferred);
  if (next) redirect(next.href);
  return <div><h1>Review saved</h1><p>No more items from this review selection are available on the current page. Completed items and items outside your current scope are left out.</p><Link href={queueHref}>Return to your review queue</Link>{model.pagination?.nextHref ? <p><Link href={model.pagination.nextHref}>Continue to the next page</Link></p> : null}</div>;
}
