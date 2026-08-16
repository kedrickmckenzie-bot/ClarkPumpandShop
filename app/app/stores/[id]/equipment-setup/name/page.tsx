import type { Metadata } from "next";
import { StoreEquipmentNaming } from "@/components/ops/store-equipment-setup";
import { loadStoreEquipmentNamingModel } from "../../../../_data/store-equipment-loader";

export const metadata: Metadata = { title: "Name store equipment" };

export default async function NameStoreEquipmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ assets?: string | string[] }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const rawAssets = Array.isArray(query.assets) ? query.assets.join(",") : query.assets ?? "";
  const assetIds = rawAssets.split(",").map((assetId) => decodeURIComponent(assetId));
  return <StoreEquipmentNaming model={await loadStoreEquipmentNamingModel(id, assetIds)} />;
}
