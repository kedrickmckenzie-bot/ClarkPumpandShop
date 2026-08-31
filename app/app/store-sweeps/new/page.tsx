import type { Metadata } from "next";
import { StoreSweepPlanner } from "@/components/ops/store-sweep-planner";
import { loadStoreSweepPlanner } from "../../_data/store-sweep-loader";

export const metadata: Metadata = { title: "Send approved jobs together" };

export default async function StoreSweepPlannerPage({ searchParams }: { searchParams: Promise<{ store?: string; workOrder?: string; returnTo?: string; notice?: string }> }) {
  const query = await searchParams;
  const model = await loadStoreSweepPlanner(query.store, query.workOrder, query.returnTo);
  return <StoreSweepPlanner model={model} notice={query.notice} />;
}
