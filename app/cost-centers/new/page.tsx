import { EquipmentSetupForm } from "@/components/admin-platform";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  return <EquipmentSetupForm entity="cost-center" initialStoreId={typeof query.storeId === "string" ? query.storeId : undefined} />;
}
