import type { Metadata } from "next";
import { ListSurface } from "@/components/ops/views";
import { loadListModel } from "../_data/operator-loader";

export const metadata: Metadata = { title: "Service visits" };
type Query = Record<string, string | string[] | undefined>;

export default async function VisitsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const params = await searchParams;
  return <ListSurface model={await loadListModel("visits", params)} surface="visits" searchParams={params} />;
}