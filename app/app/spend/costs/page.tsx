import type { Metadata } from "next";
import { PlanningWorkspace } from "@/components/workspace/planning-workspace";
import { loadProgramModel } from "../../_data/operator-loader";

export const metadata: Metadata = { title: "Spending · Costs" };
type Query = Record<string, string | string[] | undefined>;
export default async function SpendCostsPage({ searchParams }: { searchParams: Promise<Query> }) {
  return <PlanningWorkspace kind="spend" model={await loadProgramModel("spend", await searchParams)} />;
}
