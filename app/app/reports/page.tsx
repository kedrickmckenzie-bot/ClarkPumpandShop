import type { Metadata } from "next";
import { ReportingCenter } from "@/components/workspace/reporting-center";
import { loadListModel } from "../_data/operator-loader";

export const metadata: Metadata = { title: "Reports" };
type Query = Record<string, string | string[] | undefined>;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Query> }) {
  return <ReportingCenter model={await loadListModel("reports", await searchParams)} />;
}
