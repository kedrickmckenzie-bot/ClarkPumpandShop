import { AssetRecord } from "@/components/equipment-platform";

export default async function Page({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  return <AssetRecord assetId={assetId} />;
}
