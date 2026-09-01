import type { Metadata } from "next";
import { AttentionItemPanel, MutationReceipt } from "@/components/ops/service-control-panels";
import { DetailView } from "@/components/ops/views";
import styles from "@/components/ops/ops.module.css";
import { loadAttentionItemModel } from "../../_data/operator-loader";

export const metadata: Metadata = { title: "Attention item" };

export default async function AttentionItemPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ updated?: string | string[] }> }) {
  const { id } = await params;
  const query = await searchParams;
  const updated = Array.isArray(query.updated) ? query.updated[0] : query.updated;
  const model = await loadAttentionItemModel(id);
  return <DetailView model={model.detail} initialSection="service-visits" beforeSections={<div className={styles.controlStack}><MutationReceipt code={updated} /><AttentionItemPanel model={model.control} /></div>} />;
}
