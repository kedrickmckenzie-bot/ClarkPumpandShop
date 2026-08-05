import type { Metadata } from "next";
import { WorkOrderCreator } from "@/components/work-order-creator";

export const metadata: Metadata = { title: "Create Work Order" };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const value = (key: string) => typeof query[key] === "string" ? query[key] as string : "";
  return <WorkOrderCreator initialStoreId={value("storeId")} initialSystemId={value("systemId")} initialAssetId={value("assetId")} initialComponentId={value("componentId")} />;
}
