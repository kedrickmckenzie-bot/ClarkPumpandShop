import type { Metadata } from "next";
import { SpendEquipmentPage } from "@/components/workspace/spend-dashboard";
import { buildSpendEquipment } from "../../_data/spend-dashboard";
import { loadSpendPage } from "../../_data/operator-loader";

export const metadata: Metadata = { title: "Spending · Equipment" };
type Query = Record<string, string | string[] | undefined>;
export default async function SpendEquipmentRoute({ searchParams }: { searchParams: Promise<Query> }) {
  return <SpendEquipmentPage model={await loadSpendPage(buildSpendEquipment, await searchParams)} />;
}
