import type { Metadata } from "next";
import { SpendStoresPage } from "@/components/workspace/spend-dashboard";
import { buildSpendStores } from "../../_data/spend-dashboard";
import { loadSpendPage } from "../../_data/operator-loader";

export const metadata: Metadata = { title: "Spending · Stores" };
type Query = Record<string, string | string[] | undefined>;
export default async function SpendStoresRoute({ searchParams }: { searchParams: Promise<Query> }) {
  return <SpendStoresPage model={await loadSpendPage(buildSpendStores, await searchParams)} />;
}
