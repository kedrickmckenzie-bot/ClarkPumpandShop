import { notFound } from "next/navigation";
import { StoreDetail } from "@/components/portfolio-pages";
import { demoData } from "@/lib/demo/data";
export default async function Page({ params }: { params: Promise<{ storeId: string }> }) { const { storeId } = await params; const store = demoData.stores.find((item) => item.id === storeId); if (!store) notFound(); return <StoreDetail store={store} />; }

