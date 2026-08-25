import type { Metadata } from "next";
import { ListSurface } from "@/components/ops/views";
import { loadListModel } from "../_data/operator-loader";

export const metadata: Metadata = { title: "Requests" };
type Query = Record<string, string | string[] | undefined>;

export default async function RequestsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const params = await searchParams;
  return <ListSurface model={await loadListModel("requests", params)} surface="requests" searchParams={params} />;
}