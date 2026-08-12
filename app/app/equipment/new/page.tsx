import type { Metadata } from "next";
import { CreateAssetSetupForm } from "@/components/ops/setup-forms";
import { loadCreateAssetSetupModel } from "../../_data/setup-loader";

export const metadata: Metadata = { title: "Add equipment" };
type Query = Record<string, string | string[] | undefined>;

export default async function NewEquipmentPage({ searchParams }: { searchParams: Promise<Query> }) {
  return <CreateAssetSetupForm model={await loadCreateAssetSetupModel(await searchParams)} />;
}
