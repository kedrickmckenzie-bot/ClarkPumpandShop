import type { Metadata } from "next";
import { ListSurface } from "@/components/ops/views";
import { loadListModel } from "../_data/operator-loader";

export const metadata: Metadata = { title: "Vendor quotes" };
type Query = Record<string, string | string[] | undefined>;

export default async function EstimatesPage({ searchParams }: { searchParams: Promise<Query> }) {
  const params = await searchParams;
  return <ListSurface model={await loadListModel("estimates", params)} surface="estimates" searchParams={params} />;
}
