import type { Metadata } from "next";
import { SpendDashboard } from "@/components/workspace/spend-dashboard";
import { buildSpendDashboard } from "../_data/spend-dashboard";
import { loadSpendPage } from "../_data/operator-loader";

export const metadata: Metadata = { title: "Spending" };
type Query = Record<string, string | string[] | undefined>;
export default async function SpendPage({ searchParams }: { searchParams: Promise<Query> }) {
  return <SpendDashboard model={await loadSpendPage(buildSpendDashboard, await searchParams)} />;
}
