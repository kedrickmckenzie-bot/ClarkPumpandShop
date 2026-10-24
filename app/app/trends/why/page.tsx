import type { Metadata } from "next";
import { TrendWhyPage } from "@/components/workspace/trends-dashboard";
import { buildTrendWhy } from "../../_data/trends-dashboard";
import { loadTrendsDashboard } from "../../_data/operator-loader";

export const metadata: Metadata = { title: "Trends · Why" };
type Query = Record<string, string | string[] | undefined>;
export default async function TrendsWhyRoute({ searchParams }: { searchParams: Promise<Query> }) {
  return <TrendWhyPage model={await loadTrendsDashboard(buildTrendWhy, await searchParams)} />;
}
