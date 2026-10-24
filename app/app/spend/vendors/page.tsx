import type { Metadata } from "next";
import { SpendVendorsPage } from "@/components/workspace/spend-dashboard";
import { buildSpendVendors } from "../../_data/spend-dashboard";
import { loadSpendPage } from "../../_data/operator-loader";

export const metadata: Metadata = { title: "Spending · Vendors" };
type Query = Record<string, string | string[] | undefined>;
export default async function SpendVendorsRoute({ searchParams }: { searchParams: Promise<Query> }) {
  return <SpendVendorsPage model={await loadSpendPage(buildSpendVendors, await searchParams)} />;
}
