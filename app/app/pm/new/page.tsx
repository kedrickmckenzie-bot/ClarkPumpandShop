import type { Metadata } from "next";
import { CreatePmSetupForm } from "@/components/ops/setup-forms";
import { loadCreatePmSetupModel } from "../../_data/setup-loader";

export const metadata: Metadata = { title: "Create PM plan" };
type Query = Record<string, string | string[] | undefined>;

export default async function NewPmPlanPage({ searchParams }: { searchParams: Promise<Query> }) {
  return <CreatePmSetupForm model={await loadCreatePmSetupModel(await searchParams)} />;
}
