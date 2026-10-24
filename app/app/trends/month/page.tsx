import type { Metadata } from "next";
import { TrendMonthPage } from "@/components/workspace/trends-dashboard";
import { buildTrendMonth } from "../../_data/trends-dashboard";
import { loadTrendsDashboard } from "../../_data/operator-loader";

export const metadata: Metadata = { title: "Trends · Month" };
type Query = Record<string, string | string[] | undefined>;
export default async function TrendsMonthRoute({ searchParams }: { searchParams: Promise<Query> }) {
  return <TrendMonthPage model={await loadTrendsDashboard(buildTrendMonth, await searchParams)} />;
}
