import type { Metadata } from "next";
import { VendorPerformanceList } from "@/components/ops/vendor-performance-workspace";
import { VendorScorecardsSection } from "@/components/workspace/vendor-scorecards";
import { loadVendorPerformanceListModel, loadVendorScorecardsModel } from "../_data/operator-loader";

export const metadata: Metadata = { title: "Vendors" };
type Query = Record<string, string | string[] | undefined>;

export default async function VendorsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const [model, scorecards] = await Promise.all([loadVendorPerformanceListModel(await searchParams), loadVendorScorecardsModel()]);
  return (
    <>
      <VendorScorecardsSection scorecards={scorecards} />
      <details className="vendor-technical">
        <summary>Detailed vendor performance workspace</summary>
        <div className="vendor-technical-body">
          <VendorPerformanceList model={model} />
        </div>
      </details>
    </>
  );
}
