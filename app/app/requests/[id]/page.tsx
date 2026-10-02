import { RecordFiles } from "@/components/workspace/record-files";
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
  // The decision comes first; facts, files and the record history follow, the history folded.
  return <DetailView model={model} foldOverview beforeFacts={<div className={styles.controlStack}><MutationReceipt code={updated} /><RequestReviewPanel model={review} /></div>} beforeSections={<div className={styles.controlStack}><RecordFiles kind="request" id={id} /></div>} />;
}
