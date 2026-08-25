import type { Metadata } from "next";
import { ListSurface } from "@/components/ops/views";
import { loadListModel } from "../_data/operator-loader";

export const metadata: Metadata = { title: "Action center" };
type Query = Record<string, string | string[] | undefined>;

export default async function ActionCenterPage({ searchParams }: { searchParams: Promise<Query> }) {
  const params = await searchParams;
  return <ListSurface model={await loadListModel("action-center", params)} surface="action-center" searchParams={params} />;
}