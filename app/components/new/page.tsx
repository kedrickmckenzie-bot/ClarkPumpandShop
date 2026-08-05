import { EquipmentSetupForm } from "@/components/admin-platform";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  return <EquipmentSetupForm entity="component" initialStoreId={typeof query.storeId === "string" ? query.storeId : undefined} initialSystemId={typeof query.systemId === "string" ? query.systemId : undefined} initialAssetId={typeof query.assetId === "string" ? query.assetId : undefined} />;
}
