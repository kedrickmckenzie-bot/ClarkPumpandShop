import type { Metadata } from "next";
import { SearchView } from "@/components/ops/views";
import { loadSearchModel } from "../_data/operator-loader";

export const metadata: Metadata = { title: "Search" };
type Query = Record<string, string | string[] | undefined>;

export default async function SearchPage({ searchParams }: { searchParams: Promise<Query> }) {
  return <SearchView model={await loadSearchModel(await searchParams)} />;
}
