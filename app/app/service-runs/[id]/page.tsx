import type { Metadata } from "next";
import { ServiceRunDetailWorkspace } from "@/components/ops/service-run-workspace";
import { loadServiceRunWorkspace } from "../../_data/service-run-loader";

export const metadata: Metadata = { title: "Service Run" };
export default async function ServiceRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { fixture, selected, publicResponseHref } = await loadServiceRunWorkspace(id);
  return <ServiceRunDetailWorkspace fixture={fixture} run={selected!} publicResponseHref={publicResponseHref} />;
}
