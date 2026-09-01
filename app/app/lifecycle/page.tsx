import type { Metadata } from "next";
import { PlanningWorkspace } from "@/components/workspace/planning-workspace";
import { loadProgramModel } from "../_data/operator-loader";
import { ReplacementProfileManager } from "@/components/ops/replacement-intelligence-panel";
import { loadReplacementProfileManagerModel } from "../_data/replacement-loader";
import { LifecycleRecordStack } from "@/components/workspace/lifecycle-record-stack";
import { lifecycleDecisionHref, loadLifecycleRecordStack } from "../_data/lifecycle-workspace-loader";

export const metadata: Metadata = { title: "Repair or replace" };
type Query = Record<string, string | string[] | undefined>;
export default async function LifecyclePage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const selectedDecision = Array.isArray(query.decision) ? query.decision[0] : query.decision;
  const [model, profiles, recordStack] = await Promise.all([
    loadProgramModel("lifecycle", query),
    loadReplacementProfileManagerModel(),
    selectedDecision ? loadLifecycleRecordStack(selectedDecision, query) : Promise.resolve(null),
  ]);
  if (model.table) {
    model.table.rows = model.table.rows.map((row) => ({
      ...row,
      href: lifecycleDecisionHref(query, row.id),
    }));
  }
  return <>
    <PlanningWorkspace kind="lifecycle" model={model} administration={<ReplacementProfileManager model={profiles} />} />
    {recordStack ? <LifecycleRecordStack {...recordStack} /> : null}
  </>;
}
