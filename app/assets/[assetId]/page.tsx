import { AssetDetail } from "@/components/portfolio-pages";
import { CreatedAssetDetail } from "@/components/created-portfolio-detail";
import { demoData } from "@/lib/demo/data";
export default async function Page({ params }: { params: Promise<{ assetId: string }> }) { const { assetId } = await params; const asset = demoData.assets.find((item) => item.id === assetId); if (!asset) return <CreatedAssetDetail assetId={assetId} />; return <AssetDetail asset={asset} />; }
