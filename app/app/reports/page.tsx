import type { Metadata } from "next";
import { ListView } from "@/components/ops/views";
import { loadListModel } from "../_data/operator-loader";

export const metadata: Metadata = { title: "Reports" };
type Query = Record<string, string | string[] | undefined>;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Query> }) {
  return <ListView model={await loadListModel("reports", await searchParams)} />;
}
