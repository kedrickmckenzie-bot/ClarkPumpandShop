import { notFound } from "next/navigation";
import { AssetDetail } from "@/components/portfolio-pages";
import { demoData } from "@/lib/demo/data";
export default async function Page({ params }: { params: Promise<{ assetId: string }> }) { const { assetId } = await params; const asset = demoData.assets.find((item) => item.id === assetId); if (!asset) notFound(); return <AssetDetail asset={asset} />; }

