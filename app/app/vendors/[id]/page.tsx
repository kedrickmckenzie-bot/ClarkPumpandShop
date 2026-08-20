import type { Metadata } from "next";
import { VendorPerformanceDetail } from "@/components/ops/vendor-performance-workspace";
import { loadVendorPerformanceDetailModel } from "../../_data/operator-loader";

export const metadata: Metadata = { title: "Vendor" };

export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VendorPerformanceDetail model={await loadVendorPerformanceDetailModel(id)} />;
}
