import type { Metadata } from "next";
import { loadOperatorSession } from "../../_data/operator-loader";
import { CreatePmProgramSetupForm, CreatePmSetupForm } from "@/components/ops/setup-forms";
import { loadCreatePmProgramSetupModel, loadCreatePmSetupModel } from "../../_data/setup-loader";

export const metadata: Metadata = { title: "Create PM plan" };
type Query = Record<string, string | string[] | undefined>;

export default async function NewPmPlanPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const session = await loadOperatorSession();
  if (!query.asset && (session.role === "executive" || session.role === "facilities") && session.storeIds === undefined && session.regionIds === undefined) {
    const model = await loadCreatePmProgramSetupModel();
    const store = Array.isArray(query.store) ? query.store[0] : query.store;
    if (store && model.stores.some(s => s.value === store)) model.defaultStoreIds = [store];
    return <CreatePmProgramSetupForm model={model} />;
  }
  return <CreatePmSetupForm model={await loadCreatePmSetupModel(query)} />;
}
