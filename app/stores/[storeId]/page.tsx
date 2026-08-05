import { StoreDashboard } from "@/components/store-platform";

export default async function Page({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  return <StoreDashboard storeId={storeId} />;
}
