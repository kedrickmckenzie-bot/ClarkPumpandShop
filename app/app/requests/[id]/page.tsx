import type { Metadata } from "next";
import { MutationReceipt, RequestReviewPanel } from "@/components/ops/service-control-panels";
import { DetailView } from "@/components/ops/views";
import styles from "@/components/ops/ops.module.css";
import { loadDetailModel, loadRequestReviewModel } from "../../_data/operator-loader";

export const metadata: Metadata = { title: "Service request" };

export default async function RequestDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ updated?: string | string[] }> }) {
  const { id } = await params;
  const query = await searchParams;
  const updated = Array.isArray(query.updated) ? query.updated[0] : query.updated;
  const [model, review] = await Promise.all([
    loadDetailModel("request", id),
    loadRequestReviewModel(id),
  ]);
  return <DetailView model={model} beforeSections={<div className={styles.controlStack}><MutationReceipt code={updated} /><RequestReviewPanel model={review} /></div>} />;
}
