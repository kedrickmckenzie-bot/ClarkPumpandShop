import type { Metadata } from "next";
import { ListView } from "@/components/ops/views";
import { loadListModel } from "../_data/operator-loader";

export const metadata: Metadata = { title: "Bid requests" };
type Query = Record<string, string | string[] | undefined>;

export default async function EstimatesPage({ searchParams }: { searchParams: Promise<Query> }) {
  return <ListView model={await loadListModel("estimates", await searchParams)} />;
}
