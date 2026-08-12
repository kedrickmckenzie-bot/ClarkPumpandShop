import type { Metadata } from "next";
import { ListView } from "@/components/ops/views";
import { loadListModel } from "../_data/operator-loader";

export const metadata: Metadata = { title: "Requests" };
type Query = Record<string, string | string[] | undefined>;

export default async function RequestsPage({ searchParams }: { searchParams: Promise<Query> }) {
  return <ListView model={await loadListModel("requests", await searchParams)} />;
}
