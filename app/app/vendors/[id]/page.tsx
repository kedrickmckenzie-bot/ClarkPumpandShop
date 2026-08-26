import type { Metadata } from "next";
import { VendorPerformanceDetail } from "@/components/ops/vendor-performance-workspace";
import { loadOperatorSession, loadVendorPerformanceDetailModel } from "../../_data/operator-loader";

export const metadata: Metadata = { title: "Vendor" };

export default async function VendorDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string | string[] }> }) {
  const { id } = await params;
  const query = await searchParams;
  const notice = Array.isArray(query.notice) ? query.notice[0] : query.notice;
  const [model, session] = await Promise.all([
    loadVendorPerformanceDetailModel(id),
    loadOperatorSession(),
  ]);
  return <VendorPerformanceDetail model={{ ...model, notice }} edition={session.demoEdition} />;
}
