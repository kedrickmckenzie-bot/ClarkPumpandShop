import type { Metadata } from "next";
import { SpendVendorPage } from "@/components/workspace/spend-dashboard";
import { buildSpendVendor } from "../../_data/spend-dashboard";
import { loadSpendPage } from "../../_data/operator-loader";

export const metadata: Metadata = { title: "Spending · Vendor" };
type Query = Record<string, string | string[] | undefined>;
export default async function SpendVendorRoute({ searchParams }: { searchParams: Promise<Query> }) {
  return <SpendVendorPage model={await loadSpendPage(buildSpendVendor, await searchParams)} />;
}
