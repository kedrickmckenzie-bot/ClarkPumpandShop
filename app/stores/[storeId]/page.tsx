import { StoreDetail } from "@/components/portfolio-pages";
import { CreatedStoreDetail } from "@/components/created-portfolio-detail";
import { demoData } from "@/lib/demo/data";
export default async function Page({ params }: { params: Promise<{ storeId: string }> }) { const { storeId } = await params; const store = demoData.stores.find((item) => item.id === storeId); if (!store) return <CreatedStoreDetail storeId={storeId} />; return <StoreDetail store={store} />; }
