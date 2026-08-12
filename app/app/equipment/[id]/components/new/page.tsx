import type { Metadata } from "next";
import { AddComponentSetupForm } from "@/components/ops/setup-forms";
import { loadAddComponentSetupModel } from "../../../../_data/setup-loader";

export const metadata: Metadata = { title: "Add component" };
type Query = Record<string, string | string[] | undefined>;

export default async function NewComponentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Query>;
}) {
  const { id } = await params;
  return <AddComponentSetupForm model={await loadAddComponentSetupModel(id, await searchParams)} />;
}
