import type { Metadata } from "next";
import { WorkOrderCreator } from "@/components/work-order-creator";

export const metadata: Metadata = { title: "Create Work Order" };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const value = (key: string) => typeof query[key] === "string" ? query[key] as string : "";
  const assignment = ["internal", "vendor", "blended", "unassigned"].includes(value("assignment")) ? value("assignment") as "internal" | "vendor" | "blended" | "unassigned" : undefined;
  return <WorkOrderCreator initialReportId={value("reportId")} initialStoreId={value("storeId")} initialCategoryId={value("categoryId")} initialSystemId={value("systemId")} initialAssetId={value("assetId")} initialComponentId={value("componentId")} initialFulfillmentMode={assignment} initialProviderId={value("providerId")} />;
}
