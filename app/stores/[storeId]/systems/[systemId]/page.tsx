import { notFound } from "next/navigation";
import { SystemDetail } from "@/components/portfolio-pages";
import { demoData } from "@/lib/demo/data";
export default async function Page({ params }: { params: Promise<{ storeId: string; systemId: string }> }) { const { storeId, systemId } = await params; const system = demoData.systems.find((item) => item.id === systemId && item.storeId === storeId); if (!system) notFound(); return <SystemDetail system={system} />; }

