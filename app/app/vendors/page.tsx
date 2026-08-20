import type { Metadata } from "next";
import { VendorPerformanceList } from "@/components/ops/vendor-performance-workspace";
import { loadVendorPerformanceListModel } from "../_data/operator-loader";

export const metadata: Metadata = { title: "Vendors" };
type Query = Record<string, string | string[] | undefined>;

export default async function VendorsPage({ searchParams }: { searchParams: Promise<Query> }) {
  return <VendorPerformanceList model={await loadVendorPerformanceListModel(await searchParams)} />;
}
