import type { Metadata } from "next";
import { VendorPerformanceList } from "@/components/ops/vendor-performance-workspace";
import { loadOperatorSession, loadVendorPerformanceListModel } from "../_data/operator-loader";

export const metadata: Metadata = { title: "Vendors" };
type Query = Record<string, string | string[] | undefined>;

export default async function VendorsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const [model, session] = await Promise.all([
    loadVendorPerformanceListModel(query),
    loadOperatorSession(),
  ]);
  return <VendorPerformanceList model={model} edition={session.demoEdition} />;
}
