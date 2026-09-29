import {LinkedStoreTasks} from "@/components/workspace/linked-store-tasks";
import { RecordFiles } from "@/components/workspace/record-files";
import type { Metadata } from "next";
import { DetailView } from "@/components/ops/views";
import { loadDetailModel } from "../../_data/operator-loader";

export const metadata: Metadata = { title: "Service visit" };

export default async function VisitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DetailView beforeSections={<><RecordFiles kind="visit" id={id} /><LinkedStoreTasks kind="visit" id={id} /></>} model={await loadDetailModel("visit", id)} />;
}
