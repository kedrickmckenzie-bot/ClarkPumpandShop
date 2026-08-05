import { SystemRecord } from "@/components/equipment-platform";

export default async function Page({ params }: { params: Promise<{ storeId: string; systemId: string }> }) {
  const { storeId, systemId } = await params;
  return <SystemRecord storeId={storeId} systemId={systemId} />;
}
