import type { Metadata } from "next";
import { ListSurface } from "@/components/ops/views";
import { loadListModel } from "../_data/operator-loader";

export const metadata: Metadata = { title: "Stores" };
type Query = Record<string, string | string[] | undefined>;

export default async function StoresPage({ searchParams }: { searchParams: Promise<Query> }) {
  const params = await searchParams;
  return <ListSurface model={await loadListModel("stores", params)} surface="stores" searchParams={params} />;
}