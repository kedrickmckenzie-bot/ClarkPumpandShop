import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TaxonomyManager } from "@/components/ops/taxonomy-manager";
import { loadTaxonomyManagerModel } from "../../_data/taxonomy-loader";

export const metadata: Metadata = { title: "Service areas and equipment groups" };

export default async function ServiceAreasPage() {
  const model = await loadTaxonomyManagerModel();
  if (!model.permitted) notFound();
  return <TaxonomyManager model={model} />;
}
