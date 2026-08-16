import type { Metadata } from "next";
import { PlanningWorkspace } from "@/components/workspace/planning-workspace";
import { loadProgramModel } from "../_data/operator-loader";
import { ReplacementProfileManager } from "@/components/ops/replacement-intelligence-panel";
import { loadReplacementProfileManagerModel } from "../_data/replacement-loader";

export const metadata: Metadata = { title: "Lifecycle & CapEx" };
type Query = Record<string, string | string[] | undefined>;
export default async function LifecyclePage({ searchParams }: { searchParams: Promise<Query> }) {
  const [model, profiles] = await Promise.all([loadProgramModel("lifecycle", await searchParams), loadReplacementProfileManagerModel()]);
  return <PlanningWorkspace kind="lifecycle" model={model} administration={<ReplacementProfileManager model={profiles} />} />;
}
